import type { ReactNode } from "react";
import { SiteNav } from "@/components/SiteNav";

export default function AgentboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100svh]">
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[70vh] opacity-60" />
      {/* The site nav is transparent; long tables would pass under it, so it gets a backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-28 bg-gradient-to-b from-navy-900 from-55% to-navy-900/0"
      />
      <SiteNav />
      <main className="relative z-10 mx-auto max-w-[1200px] px-4 pb-28 pt-32 sm:px-6 lg:pt-36">{children}</main>
    </div>
  );
}
