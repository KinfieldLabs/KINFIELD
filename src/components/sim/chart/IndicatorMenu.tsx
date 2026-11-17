"use client";

import { useEffect, useRef, useState } from "react";
import { STUDY_LIST, type StudyDef, type StudyKind } from "./studies";

/** Toolbar button that opens a searchable list of indicators to add to the chart. */
export function IndicatorMenu({ onAdd, full }: { onAdd: (kind: StudyKind) => void; full: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const needle = q.trim().toLowerCase();
  const groups = new Map<string, StudyDef[]>();
  for (const d of STUDY_LIST) {
    if (needle && !`${d.name} ${d.short} ${d.blurb}`.toLowerCase().includes(needle)) continue;
    groups.set(d.group, [...(groups.get(d.group) ?? []), d]);
  }

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Indicators"
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${open ? "bg-navy-700 text-cream" : "text-muted hover:text-cream"}`}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M1.5 12.5c2.5 0 3-8 6-8s3 5 4.5 5 1.5-2 2.5-2" strokeLinecap="round" />
          <path d="M1.5 14.5h13" strokeLinecap="round" opacity="0.5" />
        </svg>
        <span className="hidden sm:inline">Indicators</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Indicators"
          className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-line bg-navy-900/95 p-2 shadow-xl shadow-black/40 backdrop-blur"
        >
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search indicators"
            aria-label="Search indicators"
            className="w-full rounded-md border border-line bg-navy-950/60 px-2.5 py-1.5 text-xs text-cream placeholder:text-muted focus:border-cyan/60 focus:outline-none"
          />
          <div className="scroll-thin mt-1 max-h-72 overflow-y-auto">
            {[...groups].map(([group, defs]) => (
              <div key={group}>
                <div className="px-2 pb-1 pt-2 text-[10px] uppercase tracking-[0.06em] text-muted">{group}</div>
                {defs.map((d) => (
                  <button
                    key={d.kind}
                    disabled={full}
                    onClick={() => {
                      onAdd(d.kind);
                      setOpen(false);
                      setQ("");
                    }}
                    className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-navy-800 disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <span className="text-xs text-cream">{d.name}</span>
                    <span className="ml-1.5 font-mono text-[10px] text-muted">{d.short}</span>
                    <span className="block text-[11px] text-muted">{d.blurb}</span>
                  </button>
                ))}
              </div>
            ))}
            {!groups.size && <p className="px-2 py-3 text-xs text-muted">No indicator matches that.</p>}
            {full && <p className="px-2 pb-1 pt-2 text-[11px] text-muted">Ten indicators is the limit. Remove one to add another.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
