"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { ConstellationButton } from "./ConstellationButton";

const SOCIALS = [
  {
    href: "https://x.com/kinfieldlabs",
    label: "Kinfield on X",
    // X logo
    path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
    size: "h-[15px] w-[15px]",
  },
  {
    href: "https://github.com/KinfieldLabs/KINFIELD",
    label: "Kinfield on GitHub",
    // GitHub mark
    path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
    size: "h-[18px] w-[18px]",
  },
];

/** Sections of the home page. */
const SECTIONS = [
  ["how", "How it works"],
  ["why", "Why Kinfield"],
  ["features", "Features"],
] as const;

/** Pages of their own (not open to the public yet). */
const PAGES = [
  ["/campaign", "Campaign"],
  ["/agentboard", "Agentboard"],
  ["/docs", "Docs"],
] as const;

/** Kinfield's X and GitHub, as icon links. */
function Socials() {
  return (
    <div className="flex items-center gap-1">
      {SOCIALS.map((s) => (
        <a
          key={s.href}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.label}
          title={s.label}
          className="flex h-9 w-9 items-center justify-center rounded-full text-mist transition-colors duration-300 hover:bg-cream/10 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
        >
          <svg viewBox="0 0 24 24" className={s.size} fill="currentColor" aria-hidden>
            <path d={s.path} />
          </svg>
        </a>
      ))}
    </div>
  );
}

/** Transparent top bar that tucks away while scrolling down and returns on scroll up. */
export function SiteNav() {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const home = path === "/";
  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 6) return;
      setHidden(y > last && y > 120);
      last = y;
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Menu: close on Escape or when the screen grows past phone size
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const wide = window.matchMedia("(min-width: 768px)");
    const onWide = () => wide.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const links: [string, string][] = [
    ...SECTIONS.map(([id, label]): [string, string] => [home ? `#${id}` : `/#${id}`, label]),
    ...PAGES.map(([href, label]): [string, string] => [href, label]),
  ];

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-transform duration-700 ease-[var(--ease-out)] ${
        hidden && !open ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      {/* Phone menu: a frosted sheet under the bar */}
      <div
        id="mobile-menu"
        aria-hidden={!open}
        inert={!open}
        className={`absolute inset-x-0 top-0 h-[100svh] bg-navy-950/70 backdrop-blur-xl transition-opacity duration-500 ease-[var(--ease-out)] md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <nav aria-label="Menu" className="flex h-full flex-col px-6 pb-10 pt-28">
          {links.map(([href, label], k) => {
            const current = href === path;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={current ? "page" : undefined}
                style={{ transitionDelay: open ? `${80 + k * 45}ms` : "0ms" }}
                className={`flex items-center justify-between border-b border-line py-4 text-[1.75rem] tracking-[-0.03em] transition-[opacity,transform] duration-700 ease-[var(--ease-out)] ${
                  open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                } ${current ? "text-cyan" : "text-cream"}`}
              >
                {label}
                {PAGES.some(([p]) => p === href) && (
                  <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Soon
                  </span>
                )}
              </Link>
            );
          })}
          <div
            style={{ transitionDelay: open ? `${80 + links.length * 45}ms` : "0ms" }}
            className={`mt-auto flex items-center justify-between transition-[opacity,transform] duration-700 ease-[var(--ease-out)] ${
              open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            <span className="text-sm text-muted">Follow Kinfield</span>
            <Socials />
          </div>
        </nav>
      </div>

      <div className="relative mx-auto flex max-w-[1280px] items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-3 sm:gap-7">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={home ? `#${id}` : `/#${id}`} className="link-ghost t-label hidden xl:block">
              {label}
            </a>
          ))}
          {PAGES.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
              className={`link-ghost t-label hidden md:block ${path === href ? "!text-cream" : ""}`}
            >
              {label}
            </Link>
          ))}
          <div className="hidden md:block">
            <Socials />
          </div>
          <ConstellationButton href="/simulate" size="sm" className="whitespace-nowrap">
            Launch<span className="hidden sm:inline"> simulator</span>
          </ConstellationButton>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan md:hidden"
          >
            <span className="relative block h-3 w-5" aria-hidden>
              <span
                className={`absolute left-0 h-[1.5px] w-5 rounded-full bg-current transition-all duration-500 ease-[var(--ease-out)] ${
                  open ? "top-[5px] rotate-45" : "top-0"
                }`}
              />
              <span
                className={`absolute left-0 h-[1.5px] w-5 rounded-full bg-current transition-all duration-500 ease-[var(--ease-out)] ${
                  open ? "top-[5px] -rotate-45" : "top-[10.5px]"
                }`}
              />
            </span>
          </button>
        </nav>
      </div>
    </header>
  );
}
