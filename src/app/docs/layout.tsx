import type { ReactNode } from "react";
import { SiteNav } from "@/components/SiteNav";
import { DocsNav, OnThisPage } from "@/components/docs/DocsNav";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100svh]">
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[70vh] opacity-60" />
      {/* The site nav is transparent; on long reading pages text would pass under it, so it gets a backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-28 bg-gradient-to-b from-navy-900 from-55% to-navy-900/0"
      />
      <SiteNav />
      <div className="relative z-10 mx-auto grid max-w-[1320px] gap-10 px-6 pb-28 pt-32 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-14 lg:pt-36 xl:grid-cols-[232px_minmax(0,1fr)_200px]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <DocsNav />
        </aside>
        <main className="min-w-0 max-w-[780px]">{children}</main>
        <aside className="hidden xl:block xl:sticky xl:top-28 xl:self-start">
          <OnThisPage />
        </aside>
      </div>
    </div>
  );
}
