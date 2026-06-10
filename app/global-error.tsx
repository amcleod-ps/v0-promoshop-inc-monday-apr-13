"use client"

// Last-resort boundary: catches errors thrown by the root layout itself
// (e.g. a storage/provider failure), where app/error.tsx can't render.
// Must provide its own <html>/<body>; styling is inline because globals.css
// may not have loaded.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f9f9f9", color: "#1a1a1a", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", textAlign: "center" }}>
          <div style={{ maxWidth: "28rem" }}>
            <p style={{ color: "#d93e36", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.75rem", marginBottom: "0.75rem" }}>
              Something went wrong
            </p>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: "1rem" }}>PromoShop hit a snag</h1>
            <p style={{ color: "#666", marginBottom: "2rem" }}>Please try again in a moment.</p>
            <button
              type="button"
              onClick={() => reset()}
              style={{ background: "#ef473f", color: "#fff", border: 0, borderRadius: "0.25rem", padding: "0.75rem 1.5rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.875rem", cursor: "pointer" }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
