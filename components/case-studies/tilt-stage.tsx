"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Rotate3d } from "lucide-react"
import type { CaseStudyImage } from "@/lib/case-studies"

interface TiltStageProps {
  images: CaseStudyImage[]
  accent: string
  /** Rendered instead of the photo when the visitor switches to 3D. */
  modelSlot?: React.ReactNode
}

const MAX_HOVER_Y = 14
const MAX_HOVER_X = 10
const MAX_DRAG_Y = 38

// A product "plinth" the visitor can turn: the card tilts toward the pointer,
// drags (mouse or finger) rotate it further, and releasing springs it back.
// Switching shots flips the card over. All motion runs through one rAF loop
// writing a transform directly, so React never re-renders per frame.
export function TiltStage({ images, accent, modelSlot }: TiltStageProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const glareRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: 0, y: 0, gx: 50, gy: 30 })
  const current = useRef({ x: 0, y: 0, gx: 50, gy: 30 })
  const drag = useRef<{ startX: number; startY: number; baseY: number; baseX: number } | null>(null)
  const flip = useRef({ offset: 0 })
  const reduced = useRef(false)
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<"photo" | "3d">(modelSlot ? "3d" : "photo")
  const [hinted, setHinted] = useState(false)

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let raf = 0
    const tick = () => {
      const c = current.current
      const t = target.current
      const k = drag.current ? 0.35 : 0.12
      c.x += (t.x - c.x) * k
      c.y += (t.y - c.y) * k
      c.gx += (t.gx - c.gx) * 0.15
      c.gy += (t.gy - c.gy) * 0.15
      if (cardRef.current) {
        cardRef.current.style.transform = `rotateX(${c.x.toFixed(2)}deg) rotateY(${(c.y + flip.current.offset).toFixed(2)}deg)`
      }
      if (glareRef.current) {
        glareRef.current.style.background = `radial-gradient(circle at ${c.gx}% ${c.gy}%, rgba(255,255,255,0.35), transparent 55%)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    target.current.gx = px * 100
    target.current.gy = py * 100
    if (drag.current) {
      const dx = e.clientX - drag.current.startX
      const dy = e.clientY - drag.current.startY
      target.current.y = Math.max(-MAX_DRAG_Y, Math.min(MAX_DRAG_Y, drag.current.baseY + dx * 0.25))
      target.current.x = Math.max(-20, Math.min(20, drag.current.baseX - dy * 0.15))
      return
    }
    if (e.pointerType === "mouse") {
      target.current.y = (px - 0.5) * 2 * MAX_HOVER_Y
      target.current.x = -(py - 0.5) * 2 * MAX_HOVER_X
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced.current) return
    drag.current = { startX: e.clientX, startY: e.clientY, baseY: target.current.y, baseX: target.current.x }
    e.currentTarget.setPointerCapture(e.pointerId)
    setHinted(true)
  }

  const release = () => {
    drag.current = null
    target.current.x = 0
    target.current.y = 0
    target.current.gx = 50
    target.current.gy = 30
  }

  const show = useCallback(
    (next: number) => {
      if (next === index) return
      if (reduced.current) {
        setIndex(next)
        return
      }
      // Flip out to the edge, swap the shot while it's side-on, flip back in.
      const start = performance.now()
      const run = (now: number) => {
        const p = Math.min(1, (now - start) / 520)
        if (p < 0.5) {
          flip.current.offset = 90 * (p / 0.5)
        } else {
          if (flip.current.offset > 0) setIndex(next)
          flip.current.offset = -90 * (1 - (p - 0.5) / 0.5)
        }
        if (p < 1) requestAnimationFrame(run)
        else flip.current.offset = 0
      }
      requestAnimationFrame(run)
    },
    [index],
  )

  const image = images[index]

  return (
    <div className="relative">
      {/* Accent glow behind the stage */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-10 opacity-60 blur-3xl"
        style={{ background: `radial-gradient(closest-side, ${accent}66, transparent)` }}
      />

      {mode === "3d" && modelSlot ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-white shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]">
          {modelSlot}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 whitespace-nowrap rounded-full bg-black/60 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white backdrop-blur"
          >
            <Rotate3d className="h-4 w-4" />
            3D · Drag to spin
          </div>
        </div>
      ) : (
        <div
          className="relative cursor-grab select-none active:cursor-grabbing"
          style={{ touchAction: "pan-y" }}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={() => {
            if (!drag.current) release()
          }}
        >
          <div className="case-float [perspective:1400px]">
            <div
              ref={cardRef}
              className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)] [transform-style:preserve-3d] will-change-transform"
              style={{ background: image.cutout ? "#ffffff" : "#0d0d0d" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static
                  public asset; next/image runs unoptimized site-wide anyway */}
              <img
                src={image.src}
                alt={image.alt}
                draggable={false}
                className={`absolute inset-0 h-full w-full ${image.cutout ? "object-contain p-6 sm:p-10" : "object-cover"}`}
              />
              <div ref={glareRef} aria-hidden="true" className="pointer-events-none absolute inset-0 mix-blend-soft-light" />
            </div>
          </div>
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 whitespace-nowrap rounded-full bg-black/60 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white backdrop-blur transition-opacity duration-500 ${hinted ? "opacity-0" : "opacity-100"}`}
          >
            <Rotate3d className="h-4 w-4" />
            Drag to turn
          </div>
        </div>
      )}

      {(images.length > 1 || modelSlot) && (
        <div className="relative mt-5 flex flex-wrap items-center gap-3">
          {modelSlot && (
            <button
              type="button"
              onClick={() => setMode("3d")}
              aria-pressed={mode === "3d"}
              className={`flex h-16 items-center gap-2 rounded-xl border-2 px-4 text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef473f] ${
                mode === "3d" ? "border-[#ef473f] bg-[#ef473f] text-white" : "border-white/20 text-white hover:border-white/60"
              }`}
            >
              <Rotate3d className="h-5 w-5" aria-hidden="true" />
              Spin in 3D
            </button>
          )}
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => {
                setMode("photo")
                show(i)
              }}
              aria-label={`Show image ${i + 1}: ${img.alt}`}
              aria-pressed={mode === "photo" && i === index}
              className={`h-16 w-16 overflow-hidden rounded-xl border-2 bg-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef473f] ${
                mode === "photo" && i === index ? "border-[#ef473f] scale-105" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt="" className="h-full w-full object-contain p-1" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
