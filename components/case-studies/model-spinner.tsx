"use client"

import { useEffect, useRef, useState } from "react"

interface ModelSpinnerProps {
  src: string
  alt: string
  poster: string
  orbit?: string
}

// Interactive 3D product (GLB) the visitor can spin with mouse or finger.
// The <model-viewer> web component is imported on demand so its ~1 MB of
// three.js never lands in the main bundle, and it lazy-loads the model when
// the section nears the viewport, showing the product photo until then.
// Zoom is off so scrolling over the model still scrolls the page.
export function ModelSpinner({ src, alt, poster, orbit = "25deg 78deg" }: ModelSpinnerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let el: HTMLElement | null = null
    let cancelled = false
    import("@google/model-viewer")
      .then(() => {
        if (cancelled || !hostRef.current) return
        el = document.createElement("model-viewer")
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const attrs: Record<string, string> = {
          src,
          alt,
          poster,
          loading: "lazy",
          "camera-controls": "",
          "disable-zoom": "",
          "disable-pan": "",
          "touch-action": "pan-y",
          "interaction-prompt": "none",
          "shadow-intensity": "1",
          "shadow-softness": "0.8",
          exposure: "1.05",
          "environment-image": "neutral",
          "camera-orbit": `${orbit} auto`,
          "rotation-per-second": "18deg",
          "auto-rotate-delay": "3000",
        }
        if (!reduced) attrs["auto-rotate"] = ""
        Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v))
        el.style.width = "100%"
        el.style.height = "100%"
        el.style.setProperty("--poster-color", "transparent")
        el.addEventListener("error", () => setFailed(true))
        hostRef.current.appendChild(el)
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
      el?.remove()
    }
  }, [src, alt, poster, orbit])

  if (failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={poster} alt={alt} className="h-full w-full object-contain p-8" />
  }
  return <div ref={hostRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
}
