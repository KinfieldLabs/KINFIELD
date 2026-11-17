"use client";

import { useEffect, useState } from "react";

const SEEN = "kinfield.guide.v1";

/** The three steps, each pointing at the part of the terminal it's about (its data-guide name). */
const STEPS = [
  {
    target: "market",
    title: "Pick a market",
    body: "Choose any Hyperliquid market here. Prices are live; every trade is simulated with no real funds.",
  },
  {
    target: "ticket",
    title: "Set up the trade",
    body: "Pick Buy / Long or Sell / Short, a size and leverage. Tag a strategy, and add a reason if you like, then place it.",
  },
  {
    target: "blotter",
    title: "Close it and see what it taught",
    body: "Close the position here when you're done, then open your agent's tab to see what it learned from the trade.",
  },
];

/**
 * A short guide for a first visit to the simulator: three steps, each outlining the
 * part of the terminal it describes. It can be skipped and doesn't come back once
 * finished or skipped, unless reopened.
 */
export function Guide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const s = STEPS[step];

  // Follow the outlined part of the terminal as the page scrolls or resizes
  useEffect(() => {
    if (!open) return;
    const el = document.querySelector(`[data-guide="${s.target}"]`);
    if (!el) return setBox(null);
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const measure = () => setBox(el.getBoundingClientRect());
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, s.target]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  });

  const finish = () => {
    try {
      localStorage.setItem(SEEN, "1");
    } catch {}
    setStep(0);
    onClose();
  };

  if (!open) return null;
  const last = step === STEPS.length - 1;

  return (
    <>
      {box && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40 rounded-[14px] border-2 border-cyan shadow-[0_0_0_4px_rgba(63,200,240,0.18)] transition-all duration-300"
          style={ring(box)}
        />
      )}
      <div
        role="dialog"
        aria-label="How the simulator works"
        className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,380px)] -translate-x-1/2 rounded-2xl border border-line bg-navy-900/95 p-5 shadow-2xl shadow-black/50 backdrop-blur"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.08em] text-cyan">
            Step {step + 1} of {STEPS.length}
          </span>
          <button onClick={finish} className="text-xs text-muted hover:text-cream">
            Skip
          </button>
        </div>
        <h2 className="mt-2 text-lg text-cream">{s.title}</h2>
        <p className="mt-1.5 text-sm font-light leading-relaxed text-mist">{s.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, k) => (
              <span key={k} className={`h-1.5 w-5 rounded-full ${k === step ? "bg-cyan" : "bg-line"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="rounded-full border border-line px-3.5 py-1.5 text-xs text-cream hover:border-cyan/60">
                Back
              </button>
            )}
            <button
              autoFocus
              onClick={() => (last ? finish() : setStep(step + 1))}
              className="rounded-full bg-cyan px-4 py-1.5 text-xs font-semibold text-navy-950 hover:bg-cyan/90"
            >
              {last ? "Start trading" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** The outline's box: just outside the outlined part, kept on screen when that part is full width. */
function ring(r: DOMRect) {
  const left = Math.max(r.left - 4, 3);
  const top = Math.max(r.top - 4, 3);
  const right = Math.min(r.right + 4, window.innerWidth - 3);
  const bottom = Math.min(r.bottom + 4, window.innerHeight - 3);
  return { left, top, width: right - left, height: bottom - top };
}

/** Whether this browser should see the guide on arrival. */
export function guideSeen(): boolean {
  try {
    return localStorage.getItem(SEEN) === "1";
  } catch {
    return true;
  }
}
