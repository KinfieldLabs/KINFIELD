"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Sharing } from "@/lib/account";

type Save = (c: Partial<Pick<Sharing, "publishData" | "showLogin" | "publishRationale">>) => Promise<string | null>;

const repoUrl = (s: Sharing) => `https://github.com/${s.repo}`;

/** Asked once after sign-in. Nothing is published until the user says yes. */
export function SharingPrompt({ sharing, onSave, onOptions }: { sharing: Sharing; onSave: Save; onOptions: () => void }) {
  const [busy, setBusy] = useState(false);
  const choose = async (publishData: boolean) => {
    setBusy(true);
    await onSave({ publishData });
    setBusy(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-cyan/30 bg-cyan/10 px-3 py-2 text-xs">
      <p className="min-w-0 flex-1 leading-relaxed text-mist">
        <span className="font-semibold text-cream">Share your trades in the open dataset?</span> Your closed trades are
        published nightly to{" "}
        <a href={repoUrl(sharing)} target="_blank" rel="noreferrer" className="text-cyan underline">
          {sharing.repo}
        </a>{" "}
        as <span className="font-mono text-cream">{sharing.agentId}</span>, so anyone can train and check agents on
        them. Your agent&apos;s own trading is also listed on the{" "}
        <Link href="/agentboard" className="text-cyan underline">
          Agentboard
        </Link>
        . Your written reasons stay private.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          disabled={busy}
          onClick={() => choose(true)}
          className="rounded-md bg-cyan px-3 py-1.5 font-semibold text-navy-950 disabled:opacity-50"
        >
          Share my trades
        </button>
        <button disabled={busy} onClick={() => choose(false)} className="rounded-md border border-line px-3 py-1.5 text-mist hover:text-cream">
          Not now
        </button>
        <button onClick={onOptions} className="px-1 text-muted underline-offset-2 hover:text-cream hover:underline">
          Options
        </button>
      </div>
    </div>
  );
}

export function SharingSettings({
  sharing,
  login,
  onSave,
  onClose,
}: {
  sharing: Sharing;
  login: string;
  onSave: Save;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({
    publishData: sharing.publishData,
    showLogin: sharing.showLogin,
    publishRationale: sharing.publishRationale,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleted = useRef(false);

  useEffect(() => {
    // After a deletion, every way out leads home, signed out
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (deleted.current ? window.location.assign("/") : onClose());
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const save = async () => {
    setBusy(true);
    const err = await onSave(draft);
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  const toggle = (k: keyof typeof draft) => setDraft((d) => ({ ...d, [k]: !d[k] }));

  const [deleting, setDeleting] = useState(false);
  if (deleting) return <DeleteAccount sharing={sharing} login={login} onBack={() => setDeleting(false)} onClose={onClose} onDeleted={() => (deleted.current = true)} />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sharing-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-line bg-navy-900 p-5 shadow-2xl shadow-black/50"
      >
        <h2 id="sharing-title" className="text-base font-semibold">
          Open dataset
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Shared trades are published every night to{" "}
          <a href={repoUrl(sharing)} target="_blank" rel="noreferrer" className="text-cyan underline">
            {sharing.repo}
          </a>
          , with the ledger that proves them. Your agent is also listed on the{" "}
          <Link href="/agentboard" className="text-cyan underline">
            Agentboard
          </Link>{" "}
          once it trades on its own.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <Toggle
            on={draft.publishData}
            onClick={() => toggle("publishData")}
            title="Share my trades"
            detail={`Closed trades, market context, strategy tags and results, as ${sharing.agentId}, and its place on the Agentboard.`}
          />
          <Toggle
            on={draft.showLogin}
            disabled={!draft.publishData}
            onClick={() => toggle("showLogin")}
            title="Show my GitHub username"
            detail={`Lists @${login} next to ${sharing.agentId}. Off keeps you pseudonymous.`}
          />
          <Toggle
            on={draft.publishRationale}
            disabled={!draft.publishData}
            onClick={() => toggle("publishRationale")}
            title="Share my written reasons"
            detail="The “why this trade?” text. Off publishes only a commitment that proves it wasn't changed."
          />
        </div>

        <p className="mt-4 rounded-lg border border-line bg-navy-950/40 p-2.5 text-[11px] leading-relaxed text-muted">
          Turning sharing off removes your folder at the next publish. Copies already published stay in the
          repository&apos;s history and anywhere they were downloaded.
        </p>
        {error && <p className="mt-2 text-xs text-short">{error}</p>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => setDeleting(true)}
            className="mr-auto rounded-md py-1.5 text-xs text-muted underline-offset-2 hover:text-short hover:underline"
          >
            Delete account
          </button>
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs text-muted hover:text-cream">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="rounded-md bg-cyan px-3 py-1.5 text-xs font-semibold text-navy-950 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  on,
  disabled,
  onClick,
  title,
  detail,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on && !disabled}
      disabled={disabled}
      onClick={onClick}
      className="flex items-start gap-3 text-left disabled:opacity-40"
    >
      <span className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${on && !disabled ? "bg-cyan" : "bg-navy-700"}`}>
        <span className={`h-4 w-4 rounded-full bg-cream transition ${on && !disabled ? "translate-x-4" : ""}`} />
      </span>
      <span className="flex flex-col">
        <span className="text-sm">{title}</span>
        <span className="text-[11px] leading-relaxed text-muted">{detail}</span>
      </span>
    </button>
  );
}

/** Deleting the account, behind typing the username. Ends signed out, on the home page. */
function DeleteAccount({
  sharing,
  login,
  onBack,
  onClose,
  onDeleted,
}: {
  sharing: Sharing;
  login: string;
  onBack: () => void;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const matches = typed.trim().toLowerCase() === login.toLowerCase();

  const remove = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/me/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: typed }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      onDeleted();
      return setDone(true);
    }
    const body = await res?.json().catch(() => ({}));
    setError(body?.error ?? "Couldn't delete the account. Try again.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 p-4" onMouseDown={done ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-line bg-navy-900 p-5 shadow-2xl shadow-black/50"
      >
        {done ? (
          <>
            <h2 id="delete-title" className="text-base font-semibold">
              Account deleted
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Your trades, ledger, agent and sessions are gone from our database, and you&apos;re signed out.
              {` If ${sharing.agentId} is in the open dataset, its folder is removed at the next nightly publish.`}
            </p>
            <div className="mt-4 flex justify-end">
              <button
                autoFocus
                onClick={() => window.location.assign("/")}
                className="rounded-md bg-cyan px-3 py-1.5 text-xs font-semibold text-navy-950"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="delete-title" className="text-base font-semibold">
              Delete your account?
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              This permanently deletes your simulated accounts, every trade and its ledger, your agent{" "}
              <span className="font-mono text-cream">{sharing.agentId}</span> and its trades, and signs you out everywhere.
              It can&apos;t be undone.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              If you shared trades, the folder is removed from the open dataset at the next nightly publish. Copies
              already published stay in the repository&apos;s history and anywhere they were downloaded.
            </p>
            <label className="mt-4 block text-xs text-mist">
              Type <span className="font-mono text-cream">{login}</span> to confirm
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && matches && !busy && remove()}
                autoComplete="off"
                spellCheck={false}
                className="mt-1.5 w-full rounded-md border border-line bg-navy-950/60 px-2.5 py-2 font-mono text-sm text-cream outline-none focus:border-short/70"
              />
            </label>
            {error && <p className="mt-2 text-xs text-short">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onBack} className="rounded-md px-3 py-1.5 text-xs text-muted hover:text-cream">
                Back
              </button>
              <button
                onClick={remove}
                disabled={!matches || busy}
                className="rounded-md bg-short px-3 py-1.5 text-xs font-semibold text-cream disabled:opacity-40"
              >
                {busy ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
