"use client";

import { useState } from "react";

export const CONTRACT_ADDRESS = "0x3d088f649bafe4c10d442ec3e3f2bf8904455faf";
/** The address on Robinhood Chain's block explorer. */
const EXPLORER_URL = `https://robinhoodchain.blockscout.com/address/${CONTRACT_ADDRESS}`;

/** The token's contract address on Robinhood Chain: shown in full, linked to the explorer, with a button to copy it. */
export function ContractAddress() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked: the address is still selectable
    }
  };
  return (
    <div className="flex max-w-full items-center gap-2.5 rounded-xl border border-line bg-navy-900/40 py-1.5 pl-3 pr-1.5 text-xs">
      <span className="t-label text-[10px] text-cyan">CA</span>
      <a
        href={EXPLORER_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="View on the Robinhood Chain explorer"
        className="min-w-0 break-all font-mono text-[11px] text-mist underline-offset-4 transition-colors hover:text-cream hover:underline sm:text-xs"
      >
        {CONTRACT_ADDRESS}
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy contract address"}
        title={copied ? "Copied" : "Copy"}
        className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-muted transition-colors hover:bg-navy-800 hover:text-cream"
      >
        {copied ? (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-long" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="m5 12 5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V6a2 2 0 0 1 2-2h9" />
          </svg>
        )}
      </button>
      <span aria-live="polite" className="sr-only">{copied ? "Contract address copied" : ""}</span>
    </div>
  );
}
