import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildDataset, DATASET_REPO } from "./dataset";
import { db } from "./db";
import { commitToRepo, githubAppConfigured } from "./github-app";
import { planPublish } from "./publish-plan";

export interface PublishResult {
  agents: number;
  changed: number;
  renamed: number;
  withdrawn: number;
  trades: number;
  commit: string | null;
  dryRunDir?: string;
  /** Dry runs only: what a real publish would remove, and its commit message. */
  removed?: string[];
  message?: string;
}

/**
 * Publishes the open dataset. Only agents whose files changed since the last publish
 * are sent; agents whose owners stopped sharing are removed, and agents published
 * under an old id move to their KIN name. With `dryRunDir`, writes the whole dataset
 * to that folder instead of GitHub (for local checks).
 */
export async function publishDataset(opts: { dryRunDir?: string } = {}): Promise<PublishResult> {
  const sql = db();
  const [run] = await sql`insert into dataset_publishes default values returning id`;
  try {
    const build = await buildDataset();
    const prevRows = await sql`select id, dataset_hash from users where dataset_hash is not null`;
    const published = new Map(prevRows.map((r) => [r.id as string, r.dataset_hash as string]));
    const plan = planPublish(build, published);
    const { changed, trades } = plan;
    const counts = {
      agents: build.agents.length,
      changed: changed.length,
      renamed: build.renamed.length,
      withdrawn: build.withdrawn.length,
      trades,
    };

    if (opts.dryRunDir) {
      rmSync(opts.dryRunDir, { recursive: true, force: true });
      for (const [path, content] of [...build.root, ...build.agents.flatMap((a) => [...a.files])]) {
        const file = join(opts.dryRunDir, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
      }
      await sql`update dataset_publishes set finished_at = now(), agents = ${counts.agents}, changed = ${counts.changed},
                trades = ${trades}, error = 'dry run' where id = ${run.id}`;
      return { ...counts, commit: null, dryRunDir: opts.dryRunDir, removed: plan.deleteFolders, message: plan.message };
    }

    if (!githubAppConfigured()) throw new Error("GitHub App is not configured (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY)");
    const commit = await commitToRepo(DATASET_REPO, plan.changes, plan.deleteFolders, plan.message);

    for (const a of changed) await sql`update users set dataset_hash = ${a.hash} where id = ${a.userId}`;
    for (const r of build.renamed) await sql`update users set former_agent_id = null where id = ${r.userId}`;
    for (const w of build.withdrawn) {
      await sql`update users set dataset_hash = null where id = ${w.userId}`;
      if (w.formerAgentId) await sql`update users set former_agent_id = null where id = ${w.userId}`;
    }
    // Deleted accounts were kept only until their folders were gone
    await sql`delete from users where github_id < 0 and login = 'deleted' and dataset_hash is null and former_agent_id is null`;
    await sql`update dataset_publishes set finished_at = now(), commit_sha = ${commit}, agents = ${counts.agents},
              changed = ${counts.changed}, trades = ${trades} where id = ${run.id}`;
    return { ...counts, commit };
  } catch (e) {
    await sql`update dataset_publishes set finished_at = now(), error = ${(e as Error).message.slice(0, 1000)} where id = ${run.id}`;
    throw e;
  }
}
