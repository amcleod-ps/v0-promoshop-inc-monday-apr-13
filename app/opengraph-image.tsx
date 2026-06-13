import { ImageResponse } from "next/og"

// Sensible branded default so shared links (LinkedIn, Slack, iMessage, X,
// Facebook) render a real preview card instead of a blank one. Generated at
// build time — replace with a client-designed 1200×630 asset (drop a static
// `opengraph-image.png` here) once one exists.
export const alt = "PromoShop Inc — Promotional products that build your brand"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "#ef473f",
          color: "#ffffff",
          padding: "90px",
        }}
      >
        <div style={{ fontSize: 116, fontWeight: 800, letterSpacing: "-3px", lineHeight: 1 }}>
          PromoShop Inc.
        </div>
        <div style={{ fontSize: 42, marginTop: 30, opacity: 0.95 }}>
          Promotional products that build your brand
        </div>
        <div
          style={{
            fontSize: 26,
            marginTop: 54,
            textTransform: "uppercase",
            letterSpacing: "5px",
            fontWeight: 700,
            opacity: 0.85,
          }}
        >
          promoshopinc.com
        </div>
      </div>
    ),
    { ...size },
  )
}
