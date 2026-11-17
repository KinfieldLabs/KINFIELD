"use client";

import { useEffect, useRef, useState } from "react";
import { TEXT_MAX, type Drawing } from "./model";

/**
 * A box for typing a text note, over the note on the chart. Enter keeps the words,
 * Escape leaves the note as it was, and clicking away keeps them too.
 */
export function NoteEditor({
  drawing,
  at,
  onDone,
}: {
  drawing: Drawing | undefined;
  at: (d: Drawing) => { x: number; y: number } | null;
  /** The words to keep, or null to leave the note as it was. */
  onDone: (text: string | null) => void;
}) {
  const [text, setText] = useState(drawing?.text ?? "");
  const input = useRef<HTMLInputElement>(null);
  // Enter or Escape closes the box, and closing blurs it: answer only once
  const closed = useRef(false);
  const finish = (value: string | null) => {
    if (closed.current) return;
    closed.current = true;
    onDone(value);
  };
  useEffect(() => input.current?.focus(), []);
  const pos = drawing && at(drawing);
  if (!drawing || !pos) return null;

  return (
    <input
      ref={input}
      value={text}
      maxLength={TEXT_MAX}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        // Keep Delete, Backspace and Escape for the note, not the chart's shortcuts
        e.stopPropagation();
        if (e.key === "Enter") finish(text);
        else if (e.key === "Escape") finish(drawing.text ? null : "");
      }}
      onBlur={() => finish(text)}
      placeholder="Type a note"
      aria-label="Note text"
      className="absolute z-30 w-56 rounded-md border border-cyan/60 bg-navy-900/95 px-1.5 py-0.5 text-[13px] text-cream shadow-lg shadow-black/40 placeholder:text-muted focus:outline-none"
      style={{ left: pos.x, top: pos.y - 24 }}
    />
  );
}
