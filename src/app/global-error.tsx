"use client";

/**
 * The last fallback, for when the site's outer frame itself fails. It replaces the whole
 * document, so it carries its own minimal styles.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#021a5c",
          color: "#fdf8ea",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 560 }}>
          <h1 style={{ fontSize: 40, fontWeight: 400, letterSpacing: "-0.03em", margin: 0 }}>Something went wrong.</h1>
          <p style={{ color: "#b9c6e4", fontSize: 18, lineHeight: 1.6 }}>
            Kinfield hit an error and couldn&apos;t load. Your simulated trades are safe.
          </p>
          <div style={{ display: "flex", gap: 24, alignItems: "center", marginTop: 32 }}>
            <button
              type="button"
              onClick={reset}
              style={{ background: "#fdf8ea", color: "#021a5c", border: 0, borderRadius: 999, padding: "12px 24px", fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
            {/* A full reload, since the app's own navigation may be what failed */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ color: "#b9c6e4" }}>
              Back to Kinfield
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
