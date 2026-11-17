"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";

/** Same palette, spring and cursor push as the hero constellation. */
const COLORS = ["#fdf8ea", "#fdf8ea", "#fdf8ea", "#3fc8f0", "#3fc8f0", "#7fa8ff", "#c9e9ff"];
const SPRING = 0.02;
const DAMPING = 0.85;
const PUSH_RADIUS = 70;
const PUSH = 2.4;
const SIZES = {
  sm: "px-4 py-2.5 text-sm sm:px-5",
  md: "px-8 py-[1.05rem] text-[0.9375rem]",
};
/** Room around the button for scattered particles to fly into. */
const BLEED = 48;

interface P {
  hx: number; // home
  hy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  spin: number;
  color: string;
  alpha: number;
}

/** Random point in a rounded rectangle; `edge` keeps it close to the outline. */
function samplePill(w: number, h: number, edge: boolean): [number, number] {
  const r = h / 2;
  for (;;) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    // distance inside the pill shape (negative = outside)
    const cx = Math.min(Math.max(x, r), w - r);
    const inside = r - Math.hypot(x - cx, y - r);
    if (inside < 0) continue;
    if (edge && inside > 7) continue;
    return [x, y];
  }
}

/**
 * A button drawn by the constellation itself: no fill of its own, just triangles
 * forming the pill on the page background. The cursor pushes them aside and they
 * spring back, like the hero. Still for people who prefer reduced motion.
 */
export function ConstellationButton({
  href,
  children,
  className = "",
  size = "md",
  style,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  /** "sm" for the navbar, "md" for page CTAs. */
  size?: "sm" | "md";
  style?: React.CSSProperties;
}) {
  const box = useRef<HTMLAnchorElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const btn = box.current;
    const ctx = el?.getContext("2d");
    if (!el || !btn || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let ps: P[] = [];
    const mouse = { x: -9999, y: -9999 };

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = btn.offsetWidth;
      h = btn.offsetHeight;
      el.width = (w + BLEED * 2) * dpr;
      el.height = (h + BLEED * 2) * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, BLEED * dpr, BLEED * dpr);
      const outline = Math.round((w + h) * 0.55);
      const fill = Math.round((w * h) / 260);
      ps = Array.from({ length: outline + fill }, (_, i) => {
        const [hx, hy] = samplePill(w, h, i < outline);
        return {
          hx,
          hy,
          x: hx,
          y: hy,
          vx: 0,
          vy: 0,
          size: i < outline ? 1.2 + Math.random() ** 2 * 2.6 : 0.9 + Math.random() * 1.6,
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.02,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          alpha: i < outline ? 0.55 + Math.random() * 0.45 : 0.18 + Math.random() * 0.3,
        };
      });
    };

    const draw = (t: number) => {
      ctx.clearRect(-BLEED, -BLEED, w + BLEED * 2, h + BLEED * 2);
      for (const p of ps) {
        if (!reduced) {
          // spring home with a slight drift, pushed away by the cursor
          const gx = p.hx + Math.sin(t / 1700 + p.rot) * 0.8;
          const gy = p.hy + Math.cos(t / 1900 + p.rot) * 0.8;
          p.vx += (gx - p.x) * SPRING;
          p.vy += (gy - p.y) * SPRING;
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < PUSH_RADIUS * PUSH_RADIUS) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / PUSH_RADIUS) * PUSH;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
          p.vx *= DAMPING;
          p.vy *= DAMPING;
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.spin;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.87, p.size * 0.5);
        ctx.lineTo(-p.size * 0.87, p.size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    };

    const onMove = (e: PointerEvent) => {
      const r = btn.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => (mouse.x = mouse.y = -9999);

    let raf = 0;
    let visible = false;
    const loop = (t: number) => {
      draw(t);
      raf = visible ? requestAnimationFrame(loop) : 0;
    };
    // Only animate while the button is on screen
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf && !reduced) raf = requestAnimationFrame(loop);
    });

    build();
    draw(0);
    if (!reduced) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerleave", onLeave);
      io.observe(btn);
    }
    const ro = new ResizeObserver(() => {
      build();
      draw(performance.now());
    });
    ro.observe(btn);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <Link
      ref={box}
      href={href}
      style={style}
      className={`group relative inline-flex items-center rounded-[var(--radius-pill)] ${SIZES[size]} font-bold text-white [text-shadow:0_0_12px_var(--navy-900),0_0_4px_var(--navy-900)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan ${className}`}
    >
      <canvas
        ref={canvas}
        aria-hidden
        className="pointer-events-none absolute"
        style={{ left: -BLEED, top: -BLEED, width: `calc(100% + ${BLEED * 2}px)`, height: `calc(100% + ${BLEED * 2}px)` }}
      />
      <span className="relative transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-105">{children}</span>
    </Link>
  );
}
