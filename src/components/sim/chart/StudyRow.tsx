"use client";

import { STUDIES, studyLabel, type Study } from "./studies";
import { StudySettings, Swatch } from "./StudySettings";

interface Props {
  study: Study;
  /** The value of one of the indicator's lines at the bar the legend shows. */
  value: (key: string) => number | null;
  format: (v: number) => string;
  settingsOpen: boolean;
  /** Opens settings above the row, for legends low on the chart. */
  settingsUp?: boolean;
  onSettings: () => void;
  onCloseSettings: () => void;
  onToggle: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<Pick<Study, "params" | "slot">>) => void;
}

/** One indicator in a chart legend: its name, values, and buttons to hide, edit or remove it. */
export function StudyRow({ study: s, value, format, settingsOpen, settingsUp, onSettings, onCloseSettings, onToggle, onRemove, onUpdate }: Props) {
  const label = studyLabel(s);
  return (
    <div className="group pointer-events-auto relative -mx-1 flex items-center gap-1.5 rounded px-1 hover:bg-navy-900/80">
      <Swatch slot={s.slot} />
      <span className={s.hidden ? "opacity-50" : ""}>{label}</span>
      {!s.hidden &&
        STUDIES[s.kind].lines(s).map((l) => {
          const v = value(l.key);
          return v == null ? null : (
            <span key={l.key} className="text-cream">
              {format(v)}
            </span>
          );
        })}
      <span
        className={`flex items-center transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 ${
          settingsOpen ? "opacity-100" : "opacity-0"
        }`}
      >
        <button onClick={onToggle} aria-label={`${s.hidden ? "Show" : "Hide"} ${label}`} title={s.hidden ? "Show" : "Hide"} className="rounded p-0.5 hover:text-cream">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
            <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
            <circle cx="8" cy="8" r="2" />
            {s.hidden && <path d="M2.5 13.5l11-11" strokeLinecap="round" />}
          </svg>
        </button>
        <button
          // Toggles: keep the press from counting as a click outside the open settings
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onSettings}
          aria-label={`${label} settings`}
          aria-expanded={settingsOpen}
          title="Settings"
          className="rounded p-0.5 hover:text-cream"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
            <path d="M2 4.5h12M2 11.5h12" strokeLinecap="round" />
            <circle cx="5.5" cy="4.5" r="1.8" className="fill-navy-900" />
            <circle cx="10.5" cy="11.5" r="1.8" className="fill-navy-900" />
          </svg>
        </button>
        <button onClick={onRemove} aria-label={`Remove ${label}`} title="Remove" className="rounded p-0.5 hover:text-cream">
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
            <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
          </svg>
        </button>
      </span>
      {settingsOpen && <StudySettings study={s} up={settingsUp} onChange={onUpdate} onClose={onCloseSettings} />}
    </div>
  );
}
