"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** The hero constellation's palette. */
const COLORS = ["#fdf8ea", "#fdf8ea", "#3fc8f0", "#3fc8f0", "#7fa8ff", "#c9e9ff"];
const SIZES = {
  sm: "min-h-11 px-4 text-sm sm:px-5",
  md: "min-h-[52px] px-7 text-[0.9375rem]",
};
/** Room around the capsule for particles to drift and pulse into. */
const BLEED = 36;
/** How long the click pulse plays before the page changes. */
const PULSE_MS = 200;

interface P {
  s: number; // position along the outline, 0 to 1
  rest: number; // resting distance outside the border, in px
  speed: number; // drift along the outline, per ms
  wobble: number;
  size: number;
  rot: number;
  spin: number;
  color: string;
  alpha: number;
}

/**
 * A point on the capsule's outline: `s` runs once round it, `d` is the distance outward
 * from the border (negative is inside).
 */
function onPill(w: number, h: number, s: number, d: number): [number, number] {
  const r = h / 2;
  const straight = w - 2 * r;
  const arc = Math.PI * r;
  const total = 2 * straight + 2 * arc;
  let at = (((s % 1) + 1) % 1) * total;
  if (at < straight) return [r + at, -d]; // top edge, left to right
  at -= straight;
  if (at < arc) {
    const a = -Math.PI / 2 + (at / arc) * Math.PI; // right end
    return [w - r + Math.cos(a) * (r + d), r + Math.sin(a) * (r + d)];
  }
  at -= arc;
  if (at < straight) return [w - r - at, h + d]; // bottom edge, right to left
  at -= straight;
  const a = Math.PI / 2 + (at / arc) * Math.PI; // left end
  return [r + Math.cos(a) * (r + d), r + Math.sin(a) * (r + d)];
}

/**
 * The call to action: a navy capsule with a glowing cyan border and particles from the
 * hero constellation drifting round its edge. Hovering gathers them onto the border and
 * sends them round it; a click sends a brief pulse through them before the page changes.
 * Under reduced motion the particles hold still in the same arrangement.
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
  const pulse = useRef<(() => void) | null>(null);
  const router = useRouter();

  useEffect(() => {
    const el = canvas.current;
    const btn = box.current;
    const ctx = el?.getContext("2d");
    if (!el || !btn || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let ps: P[] = [];
    let heat = 0; // 0 at rest, 1 while hovered or focused
    let want = 0;
    let pulsedAt = -Infinity;
    let last = performance.now();
    let clock = 0;

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = btn.offsetWidth;
      h = btn.offsetHeight;
      el.width = (w + BLEED * 2) * dpr;
      el.height = (h + BLEED * 2) * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, BLEED * dpr, BLEED * dpr);
      // A few, spread evenly round the outline with some jitter, so the label stays clear
      const n = Math.max(12, Math.round((2 * w + 2 * h) / 14));
      ps = Array.from({ length: n }, (_, i) => ({
        s: (i + Math.random() * 0.7) / n,
        rest: 3 + Math.random() ** 1.5 * 12,
        speed: (0.4 + Math.random() * 0.6) * 0.000004,
        wobble: Math.random() * Math.PI * 2,
        size: 1 + Math.random() ** 2 * 2.2,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.002,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        alpha: 0.45 + Math.random() * 0.45,
      }));
    };

    const draw = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      if (!reduced) {
        heat += (want - heat) * Math.min(1, dt / 160);
        clock += dt * (1 + heat * 7); // the orbit speeds up on hover
      }
      // Pulse: a quick push outward that settles back, contained near the capsule
      const since = now - pulsedAt;
      const kick = since < 420 ? Math.sin((since / 420) * Math.PI) * 14 : 0;

      ctx.clearRect(-BLEED, -BLEED, w + BLEED * 2, h + BLEED * 2);
      for (const p of ps) {
        const s = p.s + clock * p.speed;
        // At rest they drift loosely outside the border; hovered, they gather onto it
        const d = p.rest * (1 - heat * 0.85) + (reduced ? 0 : Math.sin(clock / 900 + p.wobble) * 1.5 * (1 - heat)) + kick * (0.6 + (p.rest / 15) * 0.8);
        const [x, y] = onPill(w, h, s, d);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot + clock * p.spin);
        ctx.globalAlpha = Math.min(1, p.alpha + heat * 0.3 + (kick ? 0.3 : 0));
        ctx.fillStyle = p.color;
        const sz = p.size * (1 + kick / 40);
        ctx.beginPath();
        ctx.moveTo(0, -sz);
        ctx.lineTo(sz * 0.87, sz * 0.5);
        ctx.lineTo(-sz * 0.87, sz * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    };

    let raf = 0;
    let visible = false;
    const loop = (t: number) => {
      draw(t);
      raf = visible ? requestAnimationFrame(loop) : 0;
    };
    const wake = () => {
      if (!raf && visible && !reduced) raf = requestAnimationFrame(loop);
    };
    // Only animate while the button is on screen
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      wake();
    });

    const on = () => (want = 1);
    const off = () => (want = btn.matches(":focus-visible") ? 1 : 0);
    const blur = () => (want = btn.matches(":hover") ? 1 : 0);
    pulse.current = () => {
      pulsedAt = performance.now();
      wake();
    };

    build();
    draw(performance.now());
    if (!reduced) {
      btn.addEventListener("pointerenter", on);
      btn.addEventListener("pointerleave", off);
      btn.addEventListener("focus", on);
      btn.addEventListener("blur", blur);
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
      btn.removeEventListener("pointerenter", on);
      btn.removeEventListener("pointerleave", off);
      btn.removeEventListener("focus", on);
      btn.removeEventListener("blur", blur);
      pulse.current = null;
    };
  }, []);

  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    // New tabs and windows open as usual; reduced motion goes straight there
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !pulse.current) return;
    e.preventDefault();
    pulse.current();
    router.prefetch(href);
    setTimeout(() => router.push(href), PULSE_MS);
  };

  return (
    <Link
      ref={box}
      href={href}
      onClick={click}
      style={style}
      className={`group relative inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-cyan/75 bg-navy-800/85 ${SIZES[size]} font-semibold text-cream shadow-[0_0_20px_-2px_rgba(63,200,240,0.6),inset_0_0_12px_-2px_rgba(63,200,240,0.4)] transition-[border-color,box-shadow,translate,background-color] duration-300 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-cyan hover:bg-navy-800 hover:shadow-[0_0_28px_0px_rgba(63,200,240,0.65),inset_0_0_16px_-2px_rgba(63,200,240,0.5)] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-[5px] focus-visible:outline-cyan motion-reduce:hover:translate-y-0 ${className}`}
    >
      <canvas
        ref={canvas}
        aria-hidden
        className="pointer-events-none absolute"
        style={{ left: -BLEED - 1, top: -BLEED - 1, width: `calc(100% + ${BLEED * 2}px)`, height: `calc(100% + ${BLEED * 2}px)` }}
      />
      <span className="relative whitespace-nowrap">{children}</span>
    </Link>
  );
}
