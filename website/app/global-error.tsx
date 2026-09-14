"use client";

import { useEffect } from "react";

// Only rendered if the root layout itself throws — so it can't rely on
// anything the layout provides (fonts, globals.css, other components) and
// has to bring its own <html>/<body> and inline styles.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, sans-serif",
          background: "#faf9fc",
          color: "#2a1140",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascot.png" alt="" width={120} height={120} />
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#7c4da8",
          }}
        >
          Critical error
        </p>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>
          The whole web tore.
        </h1>
        <p style={{ margin: 0, maxWidth: 420, color: "#5d5568" }}>
          Something went badly wrong loading this site. Reloading usually
          fixes it.
        </p>
        {error.digest && (
          <p style={{ margin: 0, fontSize: 12, color: "#8a8296" }}>
            Reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 8,
            border: "2px solid #0b0710",
            borderRadius: 16,
            background: "#5d2283",
            color: "#faf9fc",
            fontWeight: 700,
            padding: "12px 24px",
            cursor: "pointer",
            boxShadow: "4px 4px 0 0 #0b0710",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
