"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";

/** Transparent top bar that tucks away while scrolling down and returns on scroll up. */
export function SiteNav() {
  const [hidden, setHidden] = useState(false);
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

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-transform duration-700 ease-[var(--ease-out)] ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-7">
          <a href="#how" className="link-ghost t-label hidden sm:block">
            How it works
          </a>
          <a href="#why" className="link-ghost t-label hidden sm:block">
            Why Kinfield
          </a>
          <a href="#features" className="link-ghost t-label hidden md:block">
            Features
          </a>
          <Link href="/simulate" className="btn-primary whitespace-nowrap !px-4 !py-2.5 !text-sm sm:!px-5">
            Launch<span className="-ml-[0.35rem] hidden sm:inline">simulator</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
