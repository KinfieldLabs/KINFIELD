"use client";

import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Lenis from "lenis";

/** Adds `is-in` to the element once it scrolls into view (or immediately with `onMount`). */
export function useInView<T extends HTMLElement>(onMount = false, threshold = 0.2) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (onMount) {
      const id = requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-in")));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("is-in");
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onMount, threshold]);
  return ref;
}

type Tag = "div" | "section" | "p" | "h1" | "h2" | "h3" | "ul" | "li" | "span";

/** Container that triggers its children's `.reveal` / `.line-mask` / `.rule` animations. */
export function InView({
  as = "div",
  onMount = false,
  className,
  style,
  children,
}: {
  as?: Tag;
  onMount?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useInView<HTMLElement>(onMount);
  // Spread so React treats children as static positions (no key warnings)
  return createElement(as, { ref, className, style }, ...(Array.isArray(children) ? children : [children]));
}

/** Headline split into masked lines that slide up in sequence. */
export function Lines({
  lines,
  as = "h2",
  className = "",
  onMount = false,
  delay = 0,
}: {
  lines: ReactNode[];
  as?: Tag;
  className?: string;
  onMount?: boolean;
  delay?: number;
}) {
  return (
    <InView as={as} onMount={onMount} className={className} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {lines.map((l, i) => (
        <span key={i} className="line-mask" style={{ "--i": i } as CSSProperties}>
          <span>{l}</span>
        </span>
      ))}
    </InView>
  );
}

/** Inertial smooth scrolling for marketing pages. */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    let id = 0;
    const raf = (t: number) => {
      lenis.raf(t);
      id = requestAnimationFrame(raf);
    };
    id = requestAnimationFrame(raf);

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const target = document.querySelector(a.getAttribute("href")!);
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target as HTMLElement, { offset: -40 });
      }
    };
    document.addEventListener("click", onClick);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("click", onClick);
      lenis.destroy();
    };
  }, []);
  return null;
}
