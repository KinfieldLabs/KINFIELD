"use client";

import { useEffect, useState } from "react";

export type ToolKind = "trend" | "hline" | "vline" | "fib" | "rect" | "measure" | "long" | "short" | "text" | "ray" | "xline" | "channel" | "fibext" | "arrow" | "brush";
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
  /** A text note's words. */
  text?: string;
}

/**
 * How many points each kind of drawing is made of. A horizontal line uses only its
 * point's price, a vertical line only its time. A position is its entry, then its target
 * and stop, which share the box's right edge.
 */
export const POINTS: Record<ToolKind, number> = { trend: 2, hline: 1, vline: 1, fib: 2, rect: 2, measure: 2, long: 3, short: 3, text: 1, ray: 2, xline: 2, channel: 3, fibext: 3, arrow: 2, brush: 2 };

export const TOOL_NAMES: Record<ToolKind, string> = {
  trend: "Trend line",
  hline: "Horizontal line",
  vline: "Vertical line",
  fib: "Fib retracement",
  rect: "Rectangle",
  measure: "Measure",
  long: "Long position",
  short: "Short position",
  text: "Text note",
  ray: "Ray",
  xline: "Extended line",
  channel: "Parallel channel",
  fibext: "Fib extension",
  arrow: "Arrow",
  brush: "Brush",
};

/** Alt plus this letter picks the tool, as on TradingView where they overlap. */
export const SHORTCUTS: Partial<Record<ToolKind, string>> = {
  trend: "T",
  hline: "H",
  vline: "V",
  fib: "F",
  rect: "R",
  measure: "M",
  long: "L",
  short: "S",
  text: "N",
};

/**
 * Fibonacci retracement levels. Level 0 sits at the second point and 1 at the first, so
 * drawing from a swing low to a swing high measures pullbacks down from the high.
 */
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618];

/**
 * Trend-based Fibonacci extension levels: the swing from the first point to the second,
 * scaled by each level and projected from the third point, where the pullback ended.
 */
export const FIB_EXT_LEVELS = [0, 0.618, 1, 1.272, 1.618, 2, 2.618];

const isPosition = (k: ToolKind) => k === "long" || k === "short";

/**
 * A drawing's points while it is placed, from where the press started to the pointer.
 * A position's entry is the start; the drag sets the target's distance and the box's
 * end, and the stop mirrors the target, one to one, until it is moved.
 */
export function shape(kind: ToolKind, a: Anchor, b: Anchor): Anchor[] {
  if (kind === "fibext") {
    // The pullback starts out halfway back down the swing, half a swing later
    return [a, b, { t: b.t + (b.t - a.t) / 2, p: b.p - (b.p - a.p) / 2 }];
  }
  if (kind === "channel") {
    // The parallel line starts half the main line's rise away, on the far side
    return [a, b, { t: a.t, p: a.p - (b.p - a.p) / 2 }];
  }
  if (isPosition(kind)) {
    const reach = (kind === "long" ? 1 : -1) * Math.abs(b.p - a.p);
    return [a, { t: b.t, p: a.p + reach }, { t: b.t, p: a.p - reach }];
  }
  return POINTS[kind] === 1 ? [a] : [a, b];
}

/**
 * Moves one point of a drawing by its handle. A position's target and stop move its
 * right edge together and can't cross the entry, which stays between them.
 */
export function moveHandle(d: Drawing, i: number, a: Anchor): Anchor[] {
  if (d.kind === "channel") {
    // The third point only sets the width; the main line's ends carry the width with them
    const [p0, p1, p2] = d.points;
    const width = p2.p - p0.p;
    if (i === 2) return [p0, p1, { t: p0.t, p: a.p }];
    return i === 0 ? [a, p1, { t: a.t, p: a.p + width }] : [p0, a, p2];
  }
  if (!isPosition(d.kind)) return d.points.map((p, j) => (j === i ? a : p));
  const [entry, target, stop] = d.points;
  const up = d.kind === "long";
  const [lo, hi] = up ? [stop.p, target.p] : [target.p, stop.p];
  if (i === 0) return [{ t: a.t, p: Math.min(Math.max(a.p, lo), hi) }, target, stop];
  const beyond = (p: number, wantAbove: boolean) => (wantAbove ? Math.max(p, entry.p) : Math.min(p, entry.p));
  return i === 1
    ? [entry, { t: a.t, p: beyond(a.p, up) }, { t: a.t, p: stop.p }]
    : [entry, { t: a.t, p: target.p }, { t: a.t, p: beyond(a.p, !up) }];
}

/** A brush stroke has as many points as it was drawn with, up to this many. */
export const BRUSH_MAX = 400;

/** The longest a text note can be. */
export const TEXT_MAX = 200;

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
    (d.kind === "brush" ? d.points.length >= 2 && d.points.length <= BRUSH_MAX : d.points.length === POINTS[d.kind]) &&
    d.points.every((a) => a && Number.isFinite(a.t) && Number.isFinite(a.p)) &&
    (d.text === undefined || (typeof d.text === "string" && d.text.length <= TEXT_MAX))
  );
}

/** How many changes undo can step back through. */
const HISTORY = 50;

/** The drawings on one market, remembered in this browser, with undo and redo for this visit. */
export function useDrawings(coin: string) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [history, setHistory] = useState<{ past: Drawing[][]; future: Drawing[][] }>({ past: [], future: [] });

  useEffect(() => {
    let saved: Drawing[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(key(coin)) ?? "[]");
      if (Array.isArray(raw)) saved = raw.filter(valid).slice(0, MAX);
    } catch {}
    setDrawings(saved);
    setHistory({ past: [], future: [] });
  }, [coin]);

  const store = (next: Drawing[]) => {
    setDrawings(next);
    try {
      if (next.length) localStorage.setItem(key(coin), JSON.stringify(next));
      else localStorage.removeItem(key(coin));
    } catch {}
  };

  return {
    drawings,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    save(next: Drawing[]) {
      setHistory({ past: [...history.past, drawings].slice(-HISTORY), future: [] });
      store(next.slice(-MAX));
    },
    undo() {
      const prev = history.past.at(-1);
      if (!prev) return;
      setHistory({ past: history.past.slice(0, -1), future: [drawings, ...history.future] });
      store(prev);
    },
    redo() {
      const [next, ...rest] = history.future;
      if (!next) return;
      setHistory({ past: [...history.past, drawings], future: rest });
      store(next);
    },
  };
}
