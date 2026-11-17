"use client";

import { useEffect, useState } from "react";

export type ToolKind = "trend" | "hline" | "vline" | "fib" | "rect" | "measure";
export type Tool = "cursor" | ToolKind;

/** A point on the chart: a moment and a price. Anchoring to time keeps drawings in place across intervals. */
export interface Anchor {
  t: number;
  p: number;
}

export interface Drawing {
  id: string;
  kind: ToolKind;
  points: Anchor[];
}

/** How many points each kind of drawing is made of. A horizontal line uses only its point's price, a vertical line only its time. */
export const POINTS: Record<ToolKind, number> = { trend: 2, hline: 1, vline: 1, fib: 2, rect: 2, measure: 2 };

export const TOOL_NAMES: Record<ToolKind, string> = {
  trend: "Trend line",
  hline: "Horizontal line",
  vline: "Vertical line",
  fib: "Fib retracement",
  rect: "Rectangle",
  measure: "Measure",
};

/**
 * Fibonacci retracement levels. Level 0 sits at the second point and 1 at the first, so
 * drawing from a swing low to a swing high measures pullbacks down from the high.
 */
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618];

const MAX = 200;
const key = (coin: string) => `kinfield.drawings.${coin}`;

export const newId = () => Math.random().toString(36).slice(2, 10);

function valid(x: unknown): x is Drawing {
  const d = x as Drawing;
  return (
    !!d &&
    typeof d.id === "string" &&
    Object.hasOwn(POINTS, d.kind) &&
    Array.isArray(d.points) &&
    d.points.length === POINTS[d.kind] &&
    d.points.every((a) => a && Number.isFinite(a.t) && Number.isFinite(a.p))
  );
}

/** The drawings on one market, remembered in this browser. */
export function useDrawings(coin: string) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);

  useEffect(() => {
    let saved: Drawing[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(key(coin)) ?? "[]");
      if (Array.isArray(raw)) saved = raw.filter(valid).slice(0, MAX);
    } catch {}
    setDrawings(saved);
  }, [coin]);

  const save = (next: Drawing[]) => {
    const kept = next.slice(-MAX);
    setDrawings(kept);
    try {
      if (kept.length) localStorage.setItem(key(coin), JSON.stringify(kept));
      else localStorage.removeItem(key(coin));
    } catch {}
  };

  return { drawings, save };
}
