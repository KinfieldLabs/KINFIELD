"use client";

import { useEffect, useRef, useState } from "react";
import { fitsParam, SLOT_CHOICES, slotColor, slotName, slotStyle, STUDIES, studyLabel, type Study } from "./studies";
import { LineStyle } from "lightweight-charts";

/** Line sample in an indicator's color; dashed past the first three colors. */
export function Swatch({ slot, wide = false }: { slot: number; wide?: boolean }) {
  const color = slotColor(slot);
  return (
    <span
      aria-hidden
      className={`inline-block h-[2px] rounded-full ${wide ? "w-4" : "w-3"}`}
      style={{
        background:
          slotStyle(slot) === LineStyle.Solid ? color : `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)`,
      }}
    />
  );
}

/** Settings for one indicator: its parameters and color. Changes apply as you make them. */
export function StudySettings({
  study,
  onChange,
  onClose,
}: {
  study: Study;
  onChange: (patch: Partial<Pick<Study, "params" | "slot">>) => void;
  onClose: () => void;
}) {
  const def = STUDIES[study.kind];
  const box = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(study.params.map(String));
  const saved = study.params.join(",");

  useEffect(() => setDraft(saved.split(",")), [saved]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const edit = (i: number, text: string) => {
    setDraft((d) => d.map((v, j) => (j === i ? text : v)));
    const v = Number(text);
    if (text.trim() !== "" && fitsParam(def.params[i], v)) onChange({ params: study.params.map((p, j) => (j === i ? v : p)) });
  };

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={`${studyLabel(study)} settings`}
      className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-line bg-navy-900/95 p-3 font-sans shadow-xl shadow-black/40 backdrop-blur"
    >
      <div className="mb-2 text-xs text-cream">{def.name}</div>
      {def.params.map((p, i) => {
        const bad = draft[i].trim() === "" || !fitsParam(p, Number(draft[i]));
        return (
          <label key={p.label} className="flex items-center justify-between gap-3 py-1 text-[11px] text-muted">
            {p.label}
            <input
              type="number"
              inputMode="decimal"
              min={p.min}
              max={p.max}
              step={p.step ?? 1}
              value={draft[i]}
              onChange={(e) => edit(i, e.target.value)}
              onBlur={() => setDraft(saved.split(","))}
              aria-invalid={bad}
              className={`w-20 rounded-md border bg-navy-950/60 px-2 py-1 text-right font-mono text-xs text-cream focus:outline-none ${
                bad ? "border-short/70" : "border-line focus:border-cyan/60"
              }`}
            />
          </label>
        );
      })}
      <div className="mt-2 text-[11px] text-muted">Color</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {SLOT_CHOICES.map((slot) => (
          <button
            key={slot}
            onClick={() => onChange({ slot })}
            aria-label={slotName(slot)}
            aria-pressed={study.slot === slot}
            title={slotName(slot)}
            className={`flex h-7 w-8 items-center justify-center rounded-md border ${
              study.slot === slot ? "border-cyan/70 bg-navy-800" : "border-line hover:bg-navy-800"
            }`}
          >
            <Swatch slot={slot} wide />
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => onChange({ params: def.params.map((p) => p.value) })} className="text-[11px] text-muted hover:text-cream">
          Reset values
        </button>
        <button onClick={onClose} className="rounded-md bg-navy-700 px-2.5 py-1 text-[11px] text-cream hover:bg-navy-800">
          Done
        </button>
      </div>
    </div>
  );
}
