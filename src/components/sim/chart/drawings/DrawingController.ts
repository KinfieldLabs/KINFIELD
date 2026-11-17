import type { IChartApi } from "lightweight-charts";
import type { DrawingLayer } from "./DrawingLayer";
import { newId, POINTS, type Drawing, type Tool } from "./model";

interface Hooks {
  tool(): Tool;
  /** A drawing was placed or cancelled: back to the cursor. */
  done(): void;
  drawings(): Drawing[];
  save(next: Drawing[]): void;
}

type At = { x: number; y: number };

/** How far a press has to move to count as a drag rather than a click. */
const DRAG_PX = 4;

/**
 * Turns presses on the chart into drawings: press and drag to draw, or click once for
 * each point. Presses it takes are kept from the chart, which would otherwise pan.
 */
export class DrawingController {
  /** The current press belongs to a drawing. */
  private pressed = false;
  private pressAt: At | null = null;
  /** Which point of the draft follows the pointer. */
  private placing = 0;

  constructor(
    private readonly el: HTMLElement,
    private readonly chart: IChartApi,
    private readonly layer: DrawingLayer,
    private readonly hooks: Hooks,
  ) {
    el.addEventListener("pointerdown", this.onDown, true);
    // The chart listens for these, not pointer events
    el.addEventListener("mousedown", this.block, true);
    el.addEventListener("touchstart", this.block, true);
    el.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("keydown", this.onKey);
  }

  destroy() {
    this.el.removeEventListener("pointerdown", this.onDown, true);
    this.el.removeEventListener("mousedown", this.block, true);
    this.el.removeEventListener("touchstart", this.block, true);
    this.el.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("keydown", this.onKey);
  }

  /** Cancels a drawing in progress. */
  cancel() {
    if (this.layer.draft) this.layer.update({ draft: null });
    this.pressed = false;
    this.pressAt = null;
  }

  /** The press position in the candle pane, or null outside it (axes, indicator panes). */
  private at(e: PointerEvent): At | null {
    const r = this.el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const pane = this.chart.paneSize(0);
    return x >= 0 && y >= 0 && x < pane.width && y < pane.height ? { x, y } : null;
  }

  private block = (e: Event) => {
    if (this.pressed) e.stopPropagation();
  };

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const at = this.at(e);
    if (!at) return;
    const draft = this.layer.draft;
    if (draft) {
      // The second click of a click, click drawing
      this.pressed = true;
      this.place(draft, at);
      this.finish();
      return;
    }
    const tool = this.hooks.tool();
    if (tool === "cursor") return;
    const a = this.layer.anchorAt(at.x, at.y);
    if (!a) return;
    this.pressed = true;
    this.pressAt = at;
    const n = POINTS[tool];
    this.placing = n - 1;
    this.layer.update({ draft: { id: newId(), kind: tool, points: Array.from({ length: n }, () => ({ ...a })) } });
    if (n === 1) this.finish();
  };

  private onMove = (e: PointerEvent) => {
    const draft = this.layer.draft;
    const at = draft && this.at(e);
    if (draft && at) this.place(draft, at);
  };

  private onUp = (e: PointerEvent) => {
    if (!this.pressed) return;
    this.pressed = false;
    const draft = this.layer.draft;
    const from = this.pressAt;
    this.pressAt = null;
    if (!draft || !from) return;
    const at = this.at(e);
    // A drag ends the drawing where it's let go; a click waits for the next click
    if (at && Math.hypot(at.x - from.x, at.y - from.y) > DRAG_PX) {
      this.place(draft, at);
      this.finish();
    }
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && this.layer.draft) {
      this.cancel();
      this.hooks.done();
    }
  };

  private place(d: Drawing, at: At) {
    const a = this.layer.anchorAt(at.x, at.y);
    if (a) this.layer.update({ draft: { ...d, points: d.points.map((p, i) => (i === this.placing ? a : p)) } });
  }

  private finish() {
    const d = this.layer.draft;
    if (!d) return;
    this.layer.update({ draft: null });
    // Two clicks on the same spot make no line
    const [a, b] = d.points;
    if (!b || a.t !== b.t || a.p !== b.p) this.hooks.save([...this.hooks.drawings(), d]);
    this.hooks.done();
  }
}
