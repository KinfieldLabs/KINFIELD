"use client";

import type { Me } from "@/lib/account";

export function AccountChip({ me, onSignOut }: { me: Me | null; onSignOut: () => void }) {
  if (!me) return <span className="h-7 w-24 animate-pulse rounded-full bg-navy-900" />;
  if (me.user)
    return (
      <div className="flex items-center gap-2">
        {me.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.user.avatarUrl} alt="" className="h-7 w-7 rounded-full border border-line" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line font-mono text-[11px]">
            {me.user.login.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="hidden font-mono text-xs sm:inline">@{me.user.login}</span>
        <button onClick={onSignOut} className="whitespace-nowrap text-xs text-muted underline-offset-2 hover:text-cream hover:underline">
          Sign out
        </button>
      </div>
    );
  if (!me.signIn.available) return null;
  return (
    <div className="flex items-center gap-2">
      {me.signIn.github && (
        <a
          href="/api/auth/github"
          className="flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-navy-950 hover:bg-white"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Sign in with GitHub
        </a>
      )}
      {me.signIn.dev && (
        <a href="/api/auth/dev" className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-cream">
          Dev sign-in
        </a>
      )}
    </div>
  );
}
