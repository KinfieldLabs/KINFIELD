"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DOCS, GROUPS, docHref } from "./nav";

function Groups({ onPick }: { onPick?: () => void }) {
  const path = usePathname();
  return (
    <>
      {GROUPS.map((g) => {
        const pages = DOCS.filter((d) => d.group === g);
        if (!pages.length) return null;
        return (
          <div key={g}>
            <p className="t-label text-[11px] text-muted">{g}</p>
            <ul className="mt-3 flex flex-col gap-0.5 border-l border-line">
              {pages.map((d) => {
                const href = docHref(d.slug);
                const current = path === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onPick}
                      aria-current={current ? "page" : undefined}
                      className={`-ml-px block border-l py-1.5 pl-4 text-[0.9375rem] transition-colors ${
                        current ? "border-cyan text-cream" : "border-transparent text-mist/80 hover:border-mist/40 hover:text-cream"
                      }`}
                    >
                      {d.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </>
  );
}

/** The docs sidebar on wide screens, and a collapsible menu above the page on narrow ones. */
export function DocsNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = DOCS.find((d) => docHref(d.slug) === path);
  return (
    <>
      <nav aria-label="Docs" className="scroll-thin hidden max-h-[calc(100svh-8rem)] flex-col gap-8 overflow-y-auto pb-10 pr-2 lg:flex">
        <Groups />
      </nav>
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between rounded-2xl border border-line bg-navy-900/60 px-4 py-3 text-left text-sm backdrop-blur"
        >
          <span>
            <span className="text-muted">Docs</span>
            <span className="mx-2 text-muted">/</span>
            <span className="text-cream">{current?.title ?? "Contents"}</span>
          </span>
          <svg viewBox="0 0 24 24" className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {open && (
          <nav aria-label="Docs" className="mt-2 flex flex-col gap-7 rounded-2xl border border-line bg-navy-900/90 p-5 backdrop-blur">
            <Groups onPick={() => setOpen(false)} />
          </nav>
        )}
      </div>
    </>
  );
}

/** "On this page": the current page's sections, with the one being read highlighted. */
export function OnThisPage() {
  const path = usePathname();
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const heads = [...document.querySelectorAll<HTMLElement>("article.docs h2[id]")];
    setItems(heads.map((h) => ({ id: h.id, text: h.textContent ?? "" })));
    setActive(heads[0]?.id ?? null);
    observer.current?.disconnect();
    const seen = new Map<string, boolean>();
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = heads.find((h) => seen.get(h.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-90px 0px -60% 0px" },
    );
    heads.forEach((h) => observer.current!.observe(h));
    return () => observer.current?.disconnect();
  }, [path]);

  if (items.length < 2) return null;
  return (
    <nav aria-label="On this page" className="scroll-thin hidden max-h-[calc(100svh-8rem)] overflow-y-auto xl:block">
      <p className="t-label text-[11px] text-muted">On this page</p>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`} className={`transition-colors ${active === it.id ? "text-cyan" : "text-muted hover:text-cream"}`}>
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
