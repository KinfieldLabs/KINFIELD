import type { AgentBuild, DatasetBuild } from "./dataset";
import type { FileChange } from "./github-app";

export interface PublishPlan {
  /** Agents whose files differ from what was last published. */
  changed: AgentBuild[];
  changes: FileChange[];
  /** Folders to remove: agents that stopped sharing, and the old folders of renamed agents. */
  deleteFolders: string[];
  trades: number;
  message: string;
}

/**
 * What a publish sends, given the build and the hash each user last published.
 * No I/O, so it can be checked on its own.
 */
export function planPublish(build: DatasetBuild, published: Map<string, string>): PublishPlan {
  const trades = build.agents.reduce((n, a) => n + a.trades, 0);
  const changed = build.agents.filter((a) => published.get(a.userId) !== a.hash);
  const changes: FileChange[] = [
    ...[...build.root].map(([path, content]) => ({ path, content })),
    ...changed.flatMap((a) => [...a.files].map(([path, content]) => ({ path, content }))),
  ];

  // A withdrawn agent may still be published under its old id
  const gone = [
    ...build.withdrawn.flatMap((w) => (w.formerAgentId ? [w.formerAgentId, w.agentId] : [w.agentId])),
    ...build.renamed.map((r) => r.from),
  ];
  const deleteFolders = [...new Set(gone)].map((id) => `agents/${id}`);

  const n = build.agents.length;
  const body = [
    changed.length ? `Updated: ${changed.map((a) => a.agentId).join(", ")}` : "",
    build.renamed.length ? `Renamed: ${build.renamed.map((r) => `${r.from} to ${r.to}`).join(", ")}` : "",
    build.withdrawn.length ? `Withdrawn: ${build.withdrawn.map((w) => w.formerAgentId ?? w.agentId).join(", ")}` : "",
  ].filter(Boolean);
  const message = `Publish ${n} agent${n === 1 ? "" : "s"}, ${trades} trades` + (body.length ? `\n\n${body.join("\n")}` : "");

  return { changed, changes, deleteFolders, trades, message };
}
