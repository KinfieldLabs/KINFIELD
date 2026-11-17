import type { IChartApi } from "lightweight-charts";
import type { DrawingLayer } from "./DrawingLayer";
import { BRUSH_MAX, moveHandle, newId, POINTS, shape, type Anchor, type Drawing, type Tool } from "./model";

interface Hooks {
  tool(): Tool;
  /** A drawing was placed, or cancelled when `placed` is false. */
  done(placed: boolean): void;
  drawings(): Drawing[];
  save(next: Drawing[]): void;
  select(id: string | null): void;
  /** Opens a text note for typing. */
  edit(id: string): void;
}

type At = { x: number; y: number };

/** How far a press has to move to count as a drag rather than a click. */
const DRAG_PX = 4;

/** Whether a key press is going into a form field rather than to the chart. */
const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
};

/**
 * Turns presses on the chart into drawings: press and drag to draw, or click once for
 * each point. With the cursor, a press on a drawing selects it and dragging moves it, or
 * one of its points from a handle. Presses it takes are kept from the chart, which would
 * otherwise pan.
 */
export class DrawingController {
  /** The current press belongs to a drawing. */
  private pressed = false;
  private pressAt: At | null = null;
  /** Where the drawing being placed started. */
  private start: Anchor | null = null;
  private drag: { original: Drawing; handle: number | null; from: Anchor; moved: boolean } | null = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly chart: IChartApi,
    private readonly layer: DrawingLayer,
    private readonly hooks: Hooks,
  ) {
    el.addEventListener("pointerdown", this.onDown, true);
    el.addEventListener("dblclick", this.onDouble, true);
    // The chart listens for these, not pointer events
    el.addEventListener("mousedown", this.block, true);
    el.addEventListener("touchstart", this.block, true);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("keydown", this.onKey);
  }

  destroy() {
    this.el.removeEventListener("pointerdown", this.onDown, true);
    this.el.removeEventListener("dblclick", this.onDouble, true);
    this.el.removeEventListener("mousedown", this.block, true);
    this.el.removeEventListener("touchstart", this.block, true);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("keydown", this.onKey);
  }

  /** Cancels a drawing in progress. */
  cancel() {
    if (this.layer.draft) this.layer.update({ draft: null });
    this.pressed = false;
    this.pressAt = null;
    this.drag = null;
  }

  select(id: string | null) {
    if (this.layer.selected !== id) this.layer.update({ selected: id });
    this.hooks.select(id);
  }

  /** The pointer's position over the chart, and whether it is inside the candle pane. */
  private at(e: PointerEvent): At & { inside: boolean } {
    const r = this.el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const pane = this.chart.paneSize(0);
    return { x, y, inside: x >= 0 && y >= 0 && x < pane.width && y < pane.height };
  }

  private block = (e: Event) => {
    if (!this.pressed) return;
    e.stopPropagation();
    // A press the drawing took shouldn't also move focus, which would close a note being typed
    if (e.type === "mousedown") e.preventDefault();
  };

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const at = this.at(e);
    if (!at.inside) return;
    const draft = this.layer.draft;
    if (draft) {
      // The second click of a click, click drawing
      this.pressed = true;
      this.place(draft, at);
      this.finish();
      return;
    }
    const tool = this.hooks.tool();
    if (tool === "cursor") return this.pick(at);

    const a = this.layer.anchorAt(at.x, at.y);
    if (!a) return;
    this.select(null);
    this.pressed = true;
    this.pressAt = at;
    this.start = a;
    // A brush stroke grows a point at a time as it's drawn
    const points = tool === "brush" ? [this.layer.anchorAt(at.x, at.y, false, true) ?? a] : shape(tool, a, a);
    this.layer.update({ draft: { id: newId(), kind: tool, points } });
    if (POINTS[tool] === 1) this.finish();
  };

  /** With the cursor: a press on a drawing selects it and starts a drag; anywhere else clears the selection and pans. */
  private pick(at: At) {
    const hit = this.layer.hit(at.x, at.y);
    if (!hit) {
      if (this.layer.selected) this.select(null);
      return;
    }
    this.pressed = true;
    this.select(hit.id);
    const original = this.layer.drawings.find((d) => d.id === hit.id);
    const from = this.layer.anchorAt(at.x, at.y, false);
    if (original && from) this.drag = { original, handle: hit.handle, from, moved: false };
  }

  /** A double click on a text note opens it for editing. */
  private onDouble = (e: MouseEvent) => {
    const r = this.el.getBoundingClientRect();
    const hit = this.layer.hit(e.clientX - r.left, e.clientY - r.top);
    const d = hit && this.layer.drawings.find((x) => x.id === hit.id);
    if (d?.kind !== "text") return;
    e.stopPropagation();
    this.select(d.id);
    this.hooks.edit(d.id);
  };

  private onMove = (e: PointerEvent) => {
    const at = this.at(e);
    if (this.drag) return this.dragTo(at);
    const draft = this.layer.draft;
    if (draft) {
      if (at.inside) this.place(draft, at);
      return;
    }
    // Highlight the drawing under the cursor
    if (!this.pressed && this.layer.editable && e.buttons === 0) {
      const id = at.inside ? (this.layer.hit(at.x, at.y)?.id ?? null) : null;
      if (id !== this.layer.hovered) this.layer.update({ hovered: id });
    }
  };

  private dragTo(at: At) {
    const drag = this.drag!;
    const { original: o, handle, from } = drag;
    // A handle snaps like a new point; moving the whole drawing keeps its shape
    const a = this.layer.anchorAt(at.x, at.y, handle == null ? false : undefined);
    if (!a) return;
    // A handle moves its point; the line itself moves every point by the same time and price
    const points =
      handle != null ? moveHandle(o, handle, a) : o.points.map((p) => ({ t: p.t + (a.t - from.t), p: p.p + (a.p - from.p) }));
    drag.moved = true;
    this.layer.update({ drawings: this.layer.drawings.map((d) => (d.id === o.id ? { ...o, points } : d)) });
  }

  private onUp = (e: PointerEvent) => {
    if (!this.pressed) return;
    this.pressed = false;
    if (this.drag) {
      if (this.drag.moved) this.hooks.save(this.layer.drawings);
      this.drag = null;
      return;
    }
    const draft = this.layer.draft;
    const from = this.pressAt;
    this.pressAt = null;
    if (!draft || !from) return;
    const at = this.at(e);
    // A brush stroke ends when it's let go; one too short to see is dropped
    if (draft.kind === "brush") {
      if (draft.points.length >= 2) this.finish();
      else {
        this.cancel();
        this.hooks.done(false);
      }
      return;
    }
    // A drag ends the drawing where it's let go; a click waits for the next click
    if (at.inside && Math.hypot(at.x - from.x, at.y - from.y) > DRAG_PX) {
      this.place(draft, at);
      this.finish();
    }
  };

  private onKey = (e: KeyboardEvent) => {
    if (typing(e)) return;
    if (e.key === "Escape") {
      if (this.layer.draft) {
        this.cancel();
        this.hooks.done(false);
      } else if (this.layer.selected) this.select(null);
    } else if ((e.key === "Delete" || e.key === "Backspace") && this.layer.selected && !this.drag) {
      e.preventDefault();
      const id = this.layer.selected;
      this.select(null);
      this.hooks.save(this.hooks.drawings().filter((d) => d.id !== id));
    }
  };

  private place(d: Drawing, at: At) {
    if (d.kind === "brush") {
      const last = d.points[d.points.length - 1];
      const lx = this.layer.toX(last.t);
      const ly = this.layer.toY(last.p);
      // A point every few pixels keeps the stroke smooth without bloating it
      if (lx != null && ly != null && Math.hypot(at.x - lx, at.y - ly) < 3) return;
      const a = this.layer.anchorAt(at.x, at.y, false, true);
      if (a && d.points.length < BRUSH_MAX) this.layer.update({ draft: { ...d, points: [...d.points, a] } });
      return;
    }
    const a = this.layer.anchorAt(at.x, at.y);
    if (a && this.start) this.layer.update({ draft: { ...d, points: shape(d.kind, this.start, a) } });
  }

  private finish() {
    const d = this.layer.draft;
    if (!d) return;
    this.layer.update({ draft: null });
    // Two clicks on the same spot make no line
    const [a, b] = d.points;
    if (!b || a.t !== b.t || a.p !== b.p) {
      this.hooks.save([...this.hooks.drawings(), d]);
      this.select(d.id);
      if (d.kind === "text") this.hooks.edit(d.id);
    }
    this.hooks.done(true);
  }
}
