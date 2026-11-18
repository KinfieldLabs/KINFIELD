import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { pageMeta } from "@/lib/meta";
import { DOCS, docBySlug, docHref } from "./nav";

export function docMeta(slug: string): Metadata {
  const d = docBySlug(slug)!;
  return pageMeta(docHref(slug), slug ? `${d.title} · Kinfield Docs` : "Docs · Kinfield", d.summary);
}

/** A docs page: its group, title and summary, the text, then links to the pages either side. */
export function Doc({ slug, children }: { slug: string; children: ReactNode }) {
  const k = DOCS.findIndex((d) => d.slug === slug);
  const d = DOCS[k];
  const prev = DOCS[k - 1];
  const next = DOCS[k + 1];
  return (
    <div className="min-w-0">
      <p className="t-label text-cyan">{d.group}</p>
      <h1 className="t-h2 mt-4">{d.title}</h1>
      <p className="t-body mt-5 max-w-2xl">{d.summary}</p>
      <article className="docs mt-12">{children}</article>
      <div className="mt-20 grid gap-4 border-t border-line pt-8 sm:grid-cols-2">
        {prev ? (
          <Link href={docHref(prev.slug)} className="group rounded-2xl border border-line p-5 transition-colors hover:border-cyan/50">
            <span className="text-xs text-muted">Previous</span>
            <span className="mt-1 block text-cream group-hover:text-cyan">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={docHref(next.slug)} className="group rounded-2xl border border-line p-5 text-right transition-colors hover:border-cyan/50">
            <span className="text-xs text-muted">Next</span>
            <span className="mt-1 block text-cream group-hover:text-cyan">{next.title}</span>
          </Link>
        )}
      </div>
    </div>
  );
}

export const H2 = ({ id, children }: { id: string; children: ReactNode }) => (
  <h2 id={id}>
    <a href={`#${id}`} className="!text-inherit !no-underline">
      {children}
    </a>
  </h2>
);

export const H3 = ({ id, children }: { id?: string; children: ReactNode }) => <h3 id={id}>{children}</h3>;

/** A block of code or data, shown as written. */
export const Code = ({ children, label }: { children: string; label?: string }) => (
  <div>
    {label && <p className="mb-2 font-mono text-xs text-muted">{label}</p>}
    <pre>
      <code>{children.replace(/^\n/, "").replace(/\s+$/, "")}</code>
    </pre>
  </div>
);

/** A table from a header row and body rows. */
export function Table({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {head.map((h, k) => (
              <th key={k}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, k) => (
            <tr key={k}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A highlighted aside: "note" for context, "warn" for something that could surprise. */
export function Note({ children, tone = "note", title }: { children: ReactNode; tone?: "note" | "warn"; title?: string }) {
  return (
    <div
      className={`rounded-2xl border px-5 py-4 text-[0.9688rem] leading-relaxed ${
        tone === "warn" ? "border-short/35 bg-short/[0.06]" : "border-cyan/30 bg-cyan/[0.06]"
      }`}
    >
      {title && <p className={`mb-1 font-medium ${tone === "warn" ? "text-short" : "text-cyan"}`}>{title}</p>}
      <div className="[&>*+*]:mt-2">{children}</div>
    </div>
  );
}

/** A link to another docs page by slug, with an optional section. */
export const DocLink = ({ to, hash, children }: { to: string; hash?: string; children: ReactNode }) => (
  <Link href={`${docHref(to)}${hash ? `#${hash}` : ""}`}>{children}</Link>
);
