"use client";

import { useEffect, useRef } from "react";

/** The Kinfield four-blade mark, in its source coordinate space (384..1544). */
const MARK_PATHS = [
  "M958 418 L958 890 Q958 925 930 916 L782 828 Z",
  "M998 698 L1075 810 L1530 968 L1022 980 Q998 980 998 955 Z",
  "M398 958 L905 932 Q933 932 933 960 L933 1217 L857 1107 Z",
  "M966 985 L1142 1087 L966 1490 Z",
];
const VB = { x: 384, y: 374, size: 1160 };
const COLORS = ["#fdf8ea", "#fdf8ea", "#fdf8ea", "#3fc8f0", "#3fc8f0", "#7fa8ff", "#c9e9ff"];

interface P {
  tx: number; // target in unit space (-0.5..0.5)
  ty: number;
  x: number; // current px
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
  ambient: boolean;
}

/** Sample points uniformly inside the mark using hit-testing on an offscreen canvas. */
function sampleMark(count: number): [number, number][] {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const path = new Path2D(MARK_PATHS.join(" "));
  const pts: [number, number][] = [];
  let guard = 0;
  while (pts.length < count && guard++ < count * 40) {
    const x = VB.x + Math.random() * VB.size;
    const y = VB.y + Math.random() * VB.size;
    if (ctx.isPointInPath(path, x, y)) pts.push([(x - VB.x) / VB.size - 0.5, (y - VB.y) / VB.size - 0.5]);
  }
  return pts;
}

export function Constellation({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let scale = 0;

    const inner = sampleMark(1500).map<P>(([tx, ty]) => ({
      tx,
      ty,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 1.4 + Math.random() ** 2 * 3.4,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.02,
      phase: Math.random() * Math.PI * 2,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      alpha: 0.55 + Math.random() * 0.45,
      delay: Math.hypot(tx, ty) * 1400 + Math.random() * 500,
      ambient: false,
    }));
    const ambient = Array.from({ length: 220 }, (): P => {
      const a = Math.random() * Math.PI * 2;
      const r = 0.38 + Math.random() * 0.22;
      return {
        tx: Math.cos(a) * r,
        ty: Math.sin(a) * r,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 0.8 + Math.random() * 1.6,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.01,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.6 ? "#3fc8f0" : "#fdf8ea",
        alpha: 0.15 + Math.random() * 0.35,
        delay: 600 + Math.random() * 1600,
        ambient: true,
      };
    });
    const ps = [...ambient, ...inner];

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scale = Math.min(w, h) * 0.92;
    };
    resize();

    // Scatter start positions far outside the shape
    for (const p of ps) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.max(w, h) * (0.6 + Math.random() * 0.6);
      p.x = w / 2 + Math.cos(a) * r;
      p.y = h / 2 + Math.sin(a) * r;
    }

    const mouse = { x: -9999, y: -9999 };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = mouse.y = -9999;
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    const start = performance.now();
    let raf = 0;

    const tri = (p: P) => {
      const s = p.size;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.87, s * 0.5);
      ctx.lineTo(-s * 0.87, s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const t = now - start;
      const cx = w / 2;
      const cy = h / 2;
      const breathe = 1 + Math.sin(t / 2200) * 0.018;
      const sway = Math.sin(t / 5200) * 0.06;
      const cos = Math.cos(sway);
      const sin = Math.sin(sway);

      ctx.clearRect(0, 0, w, h);

      for (const p of ps) {
        // target with slow rotation, breathing and per-particle drift
        const drift = p.ambient ? 0.03 : 0.006;
        const ux = p.tx + Math.sin(t / 1700 + p.phase) * drift;
        const uy = p.ty + Math.cos(t / 1900 + p.phase) * drift;
        const rx = (ux * cos - uy * sin) * scale * breathe;
        const ry = (ux * sin + uy * cos) * scale * breathe;
        const gx = cx + rx;
        const gy = cy + ry;

        if (reduced) {
          p.x = gx;
          p.y = gy;
        } else if (t > p.delay) {
          // spring toward target
          p.vx += (gx - p.x) * 0.018;
          p.vy += (gy - p.y) * 0.018;
          // pointer repulsion
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          const R = 110;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / R) * 2.4;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
          p.vx *= 0.86;
          p.vy *= 0.86;
          p.x += p.vx;
          p.y += p.vy;
        }
        p.rot += p.spin;
        tri(p);
      }
    };

    if (reduced) {
      frame(start + 1e5);
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
