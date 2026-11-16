import { createSign } from "node:crypto";

/**
 * Writes to the dataset repository as a GitHub App: commits are authored by the
 * app's bot account, and each token is short-lived and limited to that one repo.
 *
 * Env: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (the .pem contents).
 */

const API = "https://api.github.com";

export const githubAppConfigured = () => !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function appJwt(): string {
  const key = (process.env.GITHUB_APP_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: process.env.GITHUB_APP_ID }));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(key);
  return `${head}.${body}.${b64url(sig)}`;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function gh<T>(path: string, auth: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${auth}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "kinfield-dataset",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GitHubError(`GitHub ${init.method ?? "GET"} ${path} failed (${res.status}): ${text.slice(0, 300)}`, res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/** A token that can write contents to `repo` ("owner/name") and nothing else. */
async function repoToken(repo: string): Promise<string> {
  const jwt = appJwt();
  let installation: { id: number };
  try {
    installation = await gh(`/repos/${repo}/installation`, jwt);
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404)
      throw new Error(`The GitHub App is not installed on ${repo}. Install it on that repository first.`);
    throw e;
  }
  const tok = await gh<{ token: string }>(`/app/installations/${installation.id}/access_tokens`, jwt, {
    method: "POST",
    body: { repositories: [repo.split("/")[1]], permissions: { contents: "write" } },
  });
  return tok.token;
}

export interface FileChange {
  path: string;
  /** New contents, or null to delete the file. */
  content: string | null;
}

/**
 * Commits all changes in one commit on the default branch. Deletions are applied to
 * every file under the given folder prefixes. Returns the commit sha, or null when
 * nothing changed.
 */
export async function commitToRepo(
  repo: string,
  changes: FileChange[],
  deleteFolders: string[],
  message: string,
): Promise<string | null> {
  const token = await repoToken(repo);
  const meta = await gh<{ default_branch: string }>(`/repos/${repo}`, token);
  const branch = meta.default_branch;
  let head: { object: { sha: string } };
  try {
    head = await gh(`/repos/${repo}/git/ref/heads/${branch}`, token);
  } catch (e) {
    if (e instanceof GitHubError && (e.status === 409 || e.status === 404))
      throw new Error(`${repo} is empty. Create it with a README so it has a first commit.`);
    throw e;
  }
  const parent = await gh<{ tree: { sha: string } }>(`/repos/${repo}/git/commits/${head.object.sha}`, token);

  const entries: { path: string; mode: "100644"; type: "blob"; content?: string; sha?: null }[] = changes.map((c) =>
    c.content == null
      ? { path: c.path, mode: "100644", type: "blob", sha: null }
      : { path: c.path, mode: "100644", type: "blob", content: c.content },
  );
  if (deleteFolders.length) {
    const tree = await gh<{ tree: { path: string; type: string }[]; truncated: boolean }>(
      `/repos/${repo}/git/trees/${parent.tree.sha}?recursive=1`,
      token,
    );
    if (tree.truncated) throw new Error("Repository tree too large to list; withdrawals need a different strategy");
    for (const f of tree.tree)
      if (f.type === "blob" && deleteFolders.some((d) => f.path.startsWith(`${d}/`)))
        entries.push({ path: f.path, mode: "100644", type: "blob", sha: null });
  }
  if (!entries.length) return null;

  const tree = await gh<{ sha: string }>(`/repos/${repo}/git/trees`, token, {
    method: "POST",
    body: { base_tree: parent.tree.sha, tree: entries },
  });
  if (tree.sha === parent.tree.sha) return null;
  const commit = await gh<{ sha: string }>(`/repos/${repo}/git/commits`, token, {
    method: "POST",
    body: { message, tree: tree.sha, parents: [head.object.sha] },
  });
  await gh(`/repos/${repo}/git/refs/heads/${branch}`, token, { method: "PATCH", body: { sha: commit.sha } });
  return commit.sha;
}
