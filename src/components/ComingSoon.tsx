import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Constellation, type ShapeName } from "@/components/Constellation";
import { ConstellationButton } from "@/components/ConstellationButton";
import { InView, Lines } from "@/components/motion";
import { SiteNav } from "@/components/SiteNav";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/**
 * A page that isn't open yet: a blurred glimpse of what's coming sits behind a
 * glass card, with the constellation drawing the page's figure in between.
 */
export function ComingSoon({
  label,
  shape,
  blurb,
  preview,
}: {
  label: string;
  shape: ShapeName;
  blurb: string;
  /** A rough sketch of the page, shown blurred behind the card. */
  preview: ReactNode;
}) {
  return (
    <div className="relative isolate min-h-[100svh] overflow-hidden">
      {/* The page to come, out of focus */}
      <div
        aria-hidden
        inert
        className="pointer-events-none absolute inset-0 z-0 scale-[1.03] select-none opacity-60 blur-[10px]"
      >
        <div className="mx-auto max-w-[1280px] px-6 pt-36">{preview}</div>
      </div>
      <div className="grid-bg pointer-events-none absolute inset-0 z-0 opacity-60" />
      <Constellation />
      <SiteNav />

      <main
        data-shape={shape}
        data-side="center"
        className="relative z-10 flex min-h-[100svh] items-center justify-center px-6 pb-16 pt-28"
      >
        <div className="relative w-full max-w-xl rounded-[32px] border border-line bg-navy-900/40 px-7 py-12 text-center shadow-[0_30px_120px_-20px_rgba(0,12,51,0.9)] backdrop-blur-[5px] sm:px-12 sm:py-14">
          <span aria-hidden className="orbit-border" />
          <InView onMount>
            <div className="reveal inline-flex items-center gap-2.5 text-cyan" style={i(0)}>
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan" />
              <span className="t-label">{label}</span>
            </div>
          </InView>
          <Lines
            as="h1"
            onMount
            delay={150}
            className="t-h1 mt-6"
            lines={["Coming", <span key="soon" className="shimmer-text">soon.</span>]}
          />
          <InView onMount className="mt-7" style={{ "--d": "450ms" } as CSSProperties}>
            <p className="reveal t-body mx-auto max-w-md" style={i(0)}>
              {blurb}
            </p>
            <p
              className="reveal mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-xs text-muted"
              style={i(1)}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              Not open to the public yet
            </p>
            <div className="reveal mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4" style={i(2)}>
              <ConstellationButton href="/simulate">Launch simulator</ConstellationButton>
              <Link href="/" className="link-ghost text-sm">
                Back home
              </Link>
            </div>
          </InView>
        </div>
      </main>
    </div>
  );
}
