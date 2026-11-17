"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TOOL_NAMES, type Tool, type ToolKind } from "./model";

const ICONS: Record<ToolKind, ReactNode> = {
  trend: (
    <>
      <path d="M3.5 12.5l9-9" strokeLinecap="round" />
      <circle cx="3.5" cy="12.5" r="1.6" />
      <circle cx="12.5" cy="3.5" r="1.6" />
    </>
  ),
  hline: (
    <>
      <path d="M1.5 8h13" strokeLinecap="round" />
      <circle cx="8" cy="8" r="1.6" />
    </>
  ),
  vline: (
    <>
      <path d="M8 1.5v13" strokeLinecap="round" />
      <circle cx="8" cy="8" r="1.6" />
    </>
  ),
  fib: (
    <>
      <path d="M1.5 3h13M1.5 6.5h13M1.5 9.5h13M1.5 13h13" strokeLinecap="round" opacity="0.55" />
      <path d="M3 13l10-10" strokeLinecap="round" />
    </>
  ),
};

/** The column of drawing tools down the left of the chart. */
export function DrawToolbar({ tool, onTool, count, onClear }: { tool: Tool; onTool: (t: Tool) => void; count: number; onClear: () => void }) {
  // Removing everything takes a second click within three seconds
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(id);
  }, [confirming]);

  return (
    <div role="toolbar" aria-label="Drawing tools" aria-orientation="vertical" className="flex w-9 shrink-0 flex-col items-center gap-0.5 border-r border-line py-1.5">
      <ToolButton label="Cursor" active={tool === "cursor"} onClick={() => onTool("cursor")}>
        <path d="M4 2.5l8 5.8-3.4.7 2 4-1.5.8-2-4-3.1 2.6z" strokeLinejoin="round" />
      </ToolButton>
      {(Object.keys(ICONS) as ToolKind[]).map((k) => (
        <ToolButton key={k} label={TOOL_NAMES[k]} active={tool === k} onClick={() => onTool(tool === k ? "cursor" : k)}>
          {ICONS[k]}
        </ToolButton>
      ))}
      <span className="my-1 h-px w-5 bg-line" aria-hidden />
      <ToolButton
        label={confirming ? "Click again to remove all drawings" : "Remove all drawings"}
        danger={confirming}
        disabled={count === 0}
        onClick={() => {
          if (!confirming) return setConfirming(true);
          setConfirming(false);
          onClear();
        }}
      >
        <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.6 4.5l.6 8.5h5.6l.6-8.5" strokeLinecap="round" strokeLinejoin="round" />
      </ToolButton>
    </div>
  );
}

function ToolButton({
  label,
  active = false,
  danger = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-35 ${
        danger ? "bg-short/15 text-short" : active ? "bg-navy-700 text-cream" : "text-muted hover:bg-navy-800 hover:text-cream disabled:hover:bg-transparent"
      }`}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
