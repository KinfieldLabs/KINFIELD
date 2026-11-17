import type { ReactNode } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";

/** A plain reading page for policies: the site's nav, a title, and the text. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="relative min-h-[100svh]">
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[70vh] opacity-60" />
      <SiteNav />
      <main className="relative z-10 mx-auto max-w-[760px] px-6 pb-24 pt-36">
        <p className="t-label text-cyan">Kinfield</p>
        <h1 className="t-h1 mt-5">{title}</h1>
        <p className="mt-4 text-sm text-muted">Last updated {updated}</p>
        <div className="legal mt-12">{children}</div>
        <p className="mt-16 text-sm text-muted">
          <Link href="/" className="link-ghost">
            Back to Kinfield
          </Link>
          <span className="mx-3">·</span>
          <Link href="/simulate" className="link-ghost">
            Open the simulator
          </Link>
        </p>
      </main>
    </div>
  );
}
