"use client";

import { useEffect } from "react";
import Link from "next/link";
import { StatusPage } from "@/components/StatusPage";

/** Shown in place of a page that crashed, with a way to try again. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      label="Error"
      title="Something went wrong."
      actions={
        <>
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-cream px-6 py-3 text-sm font-semibold text-navy-950 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
          >
            Try again
          </button>
          <Link href="/" className="link-ghost t-label">
            Back to Kinfield
          </Link>
        </>
      }
    >
      This page hit an error and couldn&apos;t load. Your simulated trades are safe. Try again, and if it keeps
      happening, let us know on X or GitHub.
      {error.digest && <span className="mt-4 block font-mono text-sm text-muted">Reference: {error.digest}</span>}
    </StatusPage>
  );
}
