"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";

/** Same palette as the hero constellation. */
const COLORS = ["#fdf8ea", "#fdf8ea", "#3fc8f0", "#3fc8f0", "#7fa8ff", "#c9e9ff"];

interface Tri {
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

/**
 * A pill button filled with a small field of drifting triangles, like the hero
 * constellation. Hovering stirs the field. Still for people who prefer reduced motion.
 */
export function ConstellationButton({ href, children, className = "", style }: {
  href: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hover = useRef(false);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let tris: Tri[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w * h) / 90);
      tris = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: 1.6 + Math.random() * 3.2,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.02,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        alpha: 0.35 + Math.random() * 0.55,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const t of tris) {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.rot);
        ctx.globalAlpha = t.alpha;
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.moveTo(0, -t.size);
        ctx.lineTo(t.size * 0.87, t.size * 0.5);
        ctx.lineTo(-t.size * 0.87, t.size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    };

    let raf = 0;
    const tick = () => {
      const speed = hover.current ? 3.5 : 1;
      for (const t of tris) {
        t.x += t.vx * speed;
        t.y += t.vy * speed;
        t.rot += t.spin * speed;
        if (t.x < -6) t.x = w + 6;
        if (t.x > w + 6) t.x = -6;
        if (t.y < -6) t.y = h + 6;
        if (t.y > h + 6) t.y = -6;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    resize();
    if (still) draw();
    else raf = requestAnimationFrame(tick);
    const ro = new ResizeObserver(() => {
      resize();
      if (still) draw();
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <Link
      href={href}
      style={style}
      onMouseEnter={() => (hover.current = true)}
      onMouseLeave={() => (hover.current = false)}
      onFocus={() => (hover.current = true)}
      onBlur={() => (hover.current = false)}
      className={`group relative isolate inline-flex items-center overflow-hidden rounded-[var(--radius-pill)] border border-cyan/40 bg-navy-950 px-7 py-[0.95rem] text-[0.9375rem] font-semibold text-cream shadow-[0_0_30px_rgba(63,200,240,0.15)] transition-[transform,box-shadow,border-color] duration-500 ease-[var(--ease-out)] hover:border-cyan/80 hover:shadow-[0_0_40px_rgba(63,200,240,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan active:scale-[0.97] ${className}`}
    >
      <canvas ref={canvas} aria-hidden className="absolute inset-0 -z-10 h-full w-full" />
      {/* Keeps the label readable over the brightest triangles */}
      <span aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(0,12,51,0.75),rgba(0,12,51,0.15)_75%)]" />
      <span className="relative">{children}</span>
    </Link>
  );
}
