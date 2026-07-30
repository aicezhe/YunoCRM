"use client";

/**
 * Last resort: this replaces the root layout, so it runs when even the
 * provider tree failed. That means no next-intl here — the copy is English
 * only, deliberately, because reaching for a translation lookup is exactly
 * the kind of thing that would fail again at this point.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#FCFBFF" }}>
        <main
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 20px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 600, color: "#111827", margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#6B7280" }}>
            The application failed to load. Try again — if it keeps happening, the reference below identifies the
            error in the server logs.
          </p>
          {error.digest && (
            <p style={{ marginTop: 12, fontFamily: "monospace", fontSize: 12, color: "#9CA3AF" }}>{error.digest}</p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              minHeight: 40,
              padding: "0 16px",
              borderRadius: 16,
              border: "none",
              background: "#5B4FE9",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
