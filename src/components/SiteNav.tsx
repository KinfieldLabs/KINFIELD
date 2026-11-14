"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4">
      <div
        className={`nav-pill mx-auto flex max-w-[1280px] items-center justify-between py-2.5 pl-5 pr-2.5 ${
          scrolled ? "scrolled" : ""
        }`}
      >
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
