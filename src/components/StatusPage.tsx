import type { ReactNode } from "react";
import { SiteNav } from "@/components/SiteNav";

/** A short page for when something isn't where it should be: the site's nav, a message and ways onward. */
export function StatusPage({ label, title, children, actions }: { label: string; title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="relative flex min-h-[100svh] flex-col">
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[70vh] opacity-60" />
      <SiteNav />
      <main className="relative z-10 mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center px-6 pb-24 pt-36">
        <p className="t-label text-cyan">{label}</p>
        <h1 className="t-h1 mt-5">{title}</h1>
        <div className="mt-6 max-w-[560px] text-lg leading-relaxed text-mist">{children}</div>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">{actions}</div>
      </main>
    </div>
  );
}
