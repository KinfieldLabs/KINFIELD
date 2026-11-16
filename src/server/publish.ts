import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildDataset, DATASET_REPO } from "./dataset";
import { db } from "./db";
import { commitToRepo, githubAppConfigured, type FileChange } from "./github-app";

export interface PublishResult {
  agents: number;
  changed: number;
  withdrawn: number;
  trades: number;
  commit: string | null;
  dryRunDir?: string;
}

/**
 * Publishes the open dataset. Only agents whose files changed since the last publish
 * are sent; agents whose owners stopped sharing are removed. With `dryRunDir`, writes
 * the whole dataset to that folder instead of GitHub (for local checks).
 */
export async function publishDataset(opts: { dryRunDir?: string } = {}): Promise<PublishResult> {
  const sql = db();
  const [run] = await sql`insert into dataset_publishes default values returning id`;
  try {
    const build = await buildDataset();
    const trades = build.agents.reduce((n, a) => n + a.trades, 0);
    const prevRows = await sql`select id, dataset_hash from users where dataset_hash is not null`;
    const prev = new Map(prevRows.map((r) => [r.id as string, r.dataset_hash as string]));
    const changed = build.agents.filter((a) => prev.get(a.userId) !== a.hash);

    if (opts.dryRunDir) {
      rmSync(opts.dryRunDir, { recursive: true, force: true });
      for (const [path, content] of [...build.root, ...build.agents.flatMap((a) => [...a.files])]) {
        const file = join(opts.dryRunDir, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
      }
      const result = { agents: build.agents.length, changed: changed.length, withdrawn: build.withdrawn.length, trades, commit: null, dryRunDir: opts.dryRunDir };
      await sql`update dataset_publishes set finished_at = now(), agents = ${result.agents}, changed = ${result.changed},
                trades = ${trades}, error = 'dry run' where id = ${run.id}`;
      return result;
    }

    if (!githubAppConfigured()) throw new Error("GitHub App is not configured (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY)");
    const changes: FileChange[] = [
      ...[...build.root].map(([path, content]) => ({ path, content })),
      ...changed.flatMap((a) => [...a.files].map(([path, content]) => ({ path, content }))),
    ];
    const withdrawnFolders = build.withdrawn.map((w) => `agents/${w.agentId}`);
    const message =
      `Publish ${build.agents.length} agent${build.agents.length === 1 ? "" : "s"}, ${trades} trades` +
      (changed.length ? `\n\nUpdated: ${changed.map((a) => a.agentId).join(", ")}` : "") +
      (withdrawnFolders.length ? `\nWithdrawn: ${build.withdrawn.map((w) => w.agentId).join(", ")}` : "");
    const commit = await commitToRepo(DATASET_REPO, changes, withdrawnFolders, message);

    for (const a of changed) await sql`update users set dataset_hash = ${a.hash} where id = ${a.userId}`;
    for (const w of build.withdrawn) await sql`update users set dataset_hash = null where id = ${w.userId}`;
    await sql`update dataset_publishes set finished_at = now(), commit_sha = ${commit}, agents = ${build.agents.length},
              changed = ${changed.length}, trades = ${trades} where id = ${run.id}`;
    return { agents: build.agents.length, changed: changed.length, withdrawn: build.withdrawn.length, trades, commit };
  } catch (e) {
    await sql`update dataset_publishes set finished_at = now(), error = ${(e as Error).message.slice(0, 1000)} where id = ${run.id}`;
    throw e;
  }
}
