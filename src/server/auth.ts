import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db, hasDb } from "./db";

export const SESSION_COOKIE = "kf_session";
const SESSION_DAYS = 30;

export interface User {
  id: string;
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  publishData: boolean;
  publishRationale: boolean;
  agentId: string;
  showLogin: boolean;
  /** Whether the user has answered the data-sharing question yet. */
  sharingDecided: boolean;
  /** Their active simulated account, fetched with the session so a trade needs one less query. */
  accountId: string | null;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export const devLoginEnabled = () => process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "1";
export const githubEnabled = () => !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

interface GithubProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
}

/** Creates or refreshes the user for a GitHub profile. */
export async function upsertUser(p: GithubProfile): Promise<string> {
  const [row] = await db()`
    insert into users (github_id, login, name, avatar_url)
    values (${p.id}, ${p.login}, ${p.name}, ${p.avatar_url})
    on conflict (github_id) do update
      set login = excluded.login, name = excluded.name, avatar_url = excluded.avatar_url
    returning id`;
  return row.id;
}

/** Starts a session and sets the httpOnly cookie. Only the token's hash is stored. */
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db()`insert into sessions (token_hash, user_id, expires_at) values (${sha256(token)}, ${userId}, ${expires})`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token && hasDb()) await db()`delete from sessions where token_hash = ${sha256(token)}`;
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. */
export async function currentUser(): Promise<User | null> {
  if (!hasDb()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [u] = await db()`
    select u.*,
           (select a.id from sim_accounts a where a.user_id = u.id and a.kind = 'human' and a.archived_at is null) as account_id
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now()`;
  if (!u) return null;
  return {
    id: u.id,
    githubId: Number(u.github_id),
    login: u.login,
    name: u.name,
    avatarUrl: u.avatar_url,
    publishData: u.publish_data,
    publishRationale: u.publish_rationale,
    agentId: u.agent_id,
    showLogin: u.show_login,
    sharingDecided: !!u.publish_decided_at,
    accountId: u.account_id ?? null,
  };
}

export interface SharingChoice {
  publishData?: boolean;
  showLogin?: boolean;
  publishRationale?: boolean;
}

/** Updates what this user shares in the open dataset. Choosing either way counts as deciding. */
export async function setSharing(userId: string, c: SharingChoice) {
  const sql = db();
  await sql`
    update users set
      publish_data = coalesce(${c.publishData ?? null}::boolean, publish_data),
      show_login = coalesce(${c.showLogin ?? null}::boolean, show_login),
      publish_rationale = coalesce(${c.publishRationale ?? null}::boolean, publish_rationale),
      publish_decided_at = case when ${c.publishData ?? null}::boolean is null then publish_decided_at
                                else coalesce(publish_decided_at, now()) end
    where id = ${userId}`;
}

/** Exchanges an OAuth code for the GitHub profile of the person who signed in. */
export async function githubProfile(code: string): Promise<GithubProfile> {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tok = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tok.access_token) throw new Error(tok.error || "GitHub did not return a token");
  const res = await fetch("https://api.github.com/user", {
    headers: { authorization: `Bearer ${tok.access_token}`, accept: "application/vnd.github+json", "user-agent": "kinfield" },
  });
  if (!res.ok) throw new Error(`GitHub profile request failed (${res.status})`);
  return res.json();
}
