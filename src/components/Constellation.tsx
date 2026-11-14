"use client";

import { useEffect, useRef } from "react";

/**
 * Page-wide particle constellation.
 *
 * A fixed canvas sits behind the page. Every section tagged with
 * `data-shape="<name>"` and `data-side="left|right"` names the figure the
 * particles should form while that section is centred in the viewport.
 * Between sections the swarm flies from one figure to the next, so the
 * visual follows you down the page.
 */

export type ShapeName = "mark" | "candles" | "network" | "dataset" | "arrow";

const N = 1400; // particles in the main figure
const AMBIENT = 240; // drifting particles across the whole page
const COLORS = ["#fdf8ea", "#fdf8ea", "#fdf8ea", "#3fc8f0", "#3fc8f0", "#7fa8ff", "#c9e9ff"];

type Pt = [number, number]; // unit space, roughly -0.5..0.5

/* ---------------- Shape generators ---------------- */

const S = 1000; // sampling resolution for Path2D hit-tests

function sampleFill(paths: Path2D[], count: number, stroke?: { path: Path2D; width: number }): Pt[] {
  const ctx = document.createElement("canvas").getContext("2d")!;
  if (stroke) ctx.lineWidth = stroke.width;
  const out: Pt[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 200) {
    const x = (Math.random() - 0.5) * S;
    const y = (Math.random() - 0.5) * S;
    const hit =
      paths.some((p) => ctx.isPointInPath(p, x, y)) || (stroke ? ctx.isPointInStroke(stroke.path, x, y) : false);
    if (hit) out.push([x / S, y / S]);
  }
  return out;
}

function markShape(): Pt[] {
  // Logo paths are drawn in a 1160-unit box starting at (384, 374); centre them on the origin.
  const k = S / 1160;
  const m = new DOMMatrix().scale(k, k).translate(-964, -954);
  const p = new Path2D();
  for (const d of [
    "M958 418 L958 890 Q958 925 930 916 L782 828 Z",
    "M998 698 L1075 810 L1530 968 L1022 980 Q998 980 998 955 Z",
    "M398 958 L905 932 Q933 932 933 960 L933 1217 L857 1107 Z",
    "M966 985 L1142 1087 L966 1490 Z",
  ])
    p.addPath(new Path2D(d), m);
  return sampleFill([p], N);
}

function candlesShape(): Pt[] {
  // An uptrending run of candlesticks
  const bodies = new Path2D();
  const wicks = new Path2D();
  const data: [number, number, number, number][] = [
    // open, close, high, low (in unit space, negative = up)
    [0.22, 0.12, 0.26, 0.05],
    [0.12, 0.18, 0.24, 0.08],
    [0.17, 0.02, 0.2, -0.04],
    [0.03, -0.08, 0.07, -0.12],
    [-0.07, 0.0, 0.05, -0.1],
    [0.0, -0.2, 0.03, -0.26],
    [-0.19, -0.33, -0.15, -0.4],
  ];
  const step = 0.13;
  data.forEach(([o, c, hi, lo], i) => {
    const x = (-0.39 + i * step) * S;
    const top = Math.min(o, c) * S;
    const h = Math.max(Math.abs(o - c) * S, 14);
    bodies.rect(x - 0.035 * S, top, 0.07 * S, h);
    wicks.rect(x - 0.006 * S, lo * S, 0.012 * S, (hi - lo) * S);
  });
  return sampleFill([bodies, wicks], N);
}

function networkShape(): Pt[] {
  const layers = [3, 4, 4, 2];
  const xs = [-0.4, -0.13, 0.14, 0.4];
  const nodes: Pt[][] = layers.map((n, li) =>
    Array.from({ length: n }, (_, j) => [xs[li], (j - (n - 1) / 2) * (0.7 / 3.2)] as Pt),
  );
  const edges: [Pt, Pt][] = [];
  for (let l = 0; l < nodes.length - 1; l++) for (const a of nodes[l]) for (const b of nodes[l + 1]) edges.push([a, b]);
  const all = nodes.flat();
  const out: Pt[] = [];
  for (let i = 0; i < N; i++) {
    if (i < N * 0.5) {
      const [cx, cy] = all[i % all.length];
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.042;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    } else {
      const [[ax, ay], [bx, by]] = edges[(Math.random() * edges.length) | 0];
      const t = Math.random();
      out.push([ax + (bx - ax) * t + (Math.random() - 0.5) * 0.006, ay + (by - ay) * t + (Math.random() - 0.5) * 0.006]);
    }
  }
  return out;
}

function datasetShape(): Pt[] {
  // Rows of labeled records: context · action · intent · outcome
  const p = new Path2D();
  const rows = 9;
  for (let r = 0; r < rows; r++) {
    const y = (-0.38 + r * 0.095) * S;
    let x = -0.44 * S;
    const widths = [0.08, 0.22 + ((r * 37) % 9) / 100, 0.1, 0.16 - ((r * 13) % 6) / 100];
    for (const w of widths) {
      p.rect(x, y, w * S, 0.045 * S);
      x += (w + 0.035) * S;
    }
  }
  return sampleFill([p], N);
}

function arrowShape(): Pt[] {
  const line = new Path2D();
  const pts: Pt[] = [
    [-0.45, 0.3],
    [-0.22, 0.1],
    [-0.08, 0.18],
    [0.16, -0.08],
    [0.3, -0.2],
  ];
  pts.forEach(([x, y], i) => (i ? line.lineTo(x * S, y * S) : line.moveTo(x * S, y * S)));
  const head = new Path2D();
  head.moveTo(0.44 * S, -0.34 * S);
  head.lineTo(0.22 * S, -0.3 * S);
  head.lineTo(0.38 * S, -0.12 * S);
  head.closePath();
  return sampleFill([head], N, { path: line, width: 0.05 * S });
}

const GENERATORS: Record<ShapeName, () => Pt[]> = {
  mark: markShape,
  candles: candlesShape,
  network: networkShape,
  dataset: datasetShape,
  arrow: arrowShape,
};

/* ---------------- Component ---------------- */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  spin: number;
  phase: number;
  color: string;
  alpha: number;
  delay: number;
  jx: number; // flight-path offset direction while morphing
  jy: number;
}

const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(Math.max((t - a) / (b - a), 0), 1);
  return x * x * (3 - 2 * x);
};

export function Constellation() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const shapes = {} as Record<ShapeName, Pt[]>;
    for (const k of Object.keys(GENERATORS) as ShapeName[]) {
      const pts = GENERATORS[k]();
      while (pts.length < N) pts.push(pts[(Math.random() * pts.length) | 0]);
      shapes[k] = pts;
    }

    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const mk = (ambient: boolean): Particle => {
      const a = Math.random() * Math.PI * 2;
      const r = Math.max(w, h) * (0.6 + Math.random() * 0.6);
      const ja = Math.random() * Math.PI * 2;
      return {
        x: ambient ? Math.random() * w : w / 2 + Math.cos(a) * r,
        y: ambient ? Math.random() * h : h / 2 + Math.sin(a) * r,
        vx: 0,
        vy: 0,
        size: ambient ? 0.8 + Math.random() * 1.4 : 1.3 + Math.random() ** 2 * 3.2,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * (ambient ? 0.01 : 0.02),
        phase: Math.random() * Math.PI * 2,
        color: ambient ? (Math.random() < 0.6 ? "#3fc8f0" : "#fdf8ea") : COLORS[(Math.random() * COLORS.length) | 0],
        alpha: ambient ? 0.12 + Math.random() * 0.3 : 0.55 + Math.random() * 0.45,
        delay: ambient ? 0 : Math.random() * 1400,
        jx: Math.cos(ja) * (0.08 + Math.random() * 0.18),
        jy: Math.sin(ja) * (0.08 + Math.random() * 0.18),
      };
    };
    const main = Array.from({ length: N }, () => mk(false));
    const ambient = Array.from({ length: AMBIENT }, () => mk(true));

    const mouse = { x: -9999, y: -9999 };
    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => (mouse.x = mouse.y = -9999);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);

    /** Which two section figures we're between, and how far. */
    const readScroll = () => {
      const secs = Array.from(document.querySelectorAll<HTMLElement>("[data-shape]"));
      if (!secs.length) return null;
      const mid = h / 2;
      const info = secs.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          shape: el.dataset.shape as ShapeName,
          side: el.dataset.side === "left" ? -1 : 1,
          c: r.top + r.height / 2 - mid,
        };
      });
      let i = 0;
      while (i < info.length - 1 && info[i + 1].c <= 0) i++;
      const a = info[i];
      const b = info[Math.min(i + 1, info.length - 1)];
      const raw = a === b ? 0 : Math.min(Math.max(-a.c / (b.c - a.c), 0), 1);
      // Hold each figure while its section is centred, morph in between
      const t = smooth(0.3, 0.7, raw);
      return { a, b, t };
    };

    const start = performance.now();
    let raf = 0;

    const draw = (p: Particle, alphaMul: number) => {
      const s = p.size;
      const c = Math.cos(p.rot);
      const si = Math.sin(p.rot);
      ctx.setTransform(c * dpr, si * dpr, -si * dpr, c * dpr, p.x * dpr, p.y * dpr);
      ctx.globalAlpha = p.alpha * alphaMul;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.87, s * 0.5);
      ctx.lineTo(-s * 0.87, s * 0.5);
      ctx.closePath();
      ctx.fill();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = now - start;
      const desktop = w >= 1024;
      const st = readScroll();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Ambient field: slow drift with gentle scroll parallax
      const sy = window.scrollY * 0.12;
      for (const p of ambient) {
        const x = (p.x + Math.sin(t / 4000 + p.phase) * 18 + w) % w;
        const y = (((p.y - sy + Math.cos(t / 5000 + p.phase) * 18) % h) + h) % h;
        const ox = p.x;
        const oy = p.y;
        p.x = x;
        p.y = y;
        p.rot += p.spin;
        draw(p, 1);
        p.x = ox;
        p.y = oy;
      }

      if (!st) return;
      const { a, b, t: m } = st;
      const side = desktop ? a.side + (b.side - a.side) * m : 0;
      const cx = w / 2 + side * w * 0.24;
      const cy = h / 2 + (desktop ? 20 : 0);
      const scale = desktop ? Math.min(w * 0.4, h * 0.78) : Math.min(w * 0.9, h * 0.55);
      const burst = Math.sin(m * Math.PI); // 0 at rest, 1 mid-flight
      const breathe = 1 + Math.sin(t / 2200) * 0.016;
      const sway = Math.sin(t / 5200) * 0.05 * (1 - burst);
      const cos = Math.cos(sway);
      const sin = Math.sin(sway);
      const SA = shapes[a.shape];
      const SB = shapes[b.shape];
      const alphaMul = desktop ? 1 : 0.22;

      for (let k = 0; k < N; k++) {
        const p = main[k];
        const [ax, ay] = SA[k];
        const [bx, by] = SB[k];
        let ux = ax + (bx - ax) * m + p.jx * burst + Math.sin(t / 1700 + p.phase) * 0.005;
        let uy = ay + (by - ay) * m + p.jy * burst + Math.cos(t / 1900 + p.phase) * 0.005;
        const rx = ux * cos - uy * sin;
        const ry = ux * sin + uy * cos;
        ux = rx;
        uy = ry;
        const gx = cx + ux * scale * breathe;
        const gy = cy + uy * scale * breathe;

        if (reduced) {
          p.x = gx;
          p.y = gy;
        } else if (t > p.delay) {
          p.vx += (gx - p.x) * 0.02;
          p.vy += (gy - p.y) * 0.02;
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 110 * 110) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / 110) * 2.4;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
          p.vx *= 0.85;
          p.vy *= 0.85;
          p.x += p.vx;
          p.y += p.vy;
        }
        if (!reduced) p.rot += p.spin;
        draw(p, alphaMul);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0 h-screen w-screen" aria-hidden />;
}
