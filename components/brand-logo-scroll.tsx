"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { BRANDS } from "@/lib/brands"
import { SiteImage } from "@/components/site-image"
import { brandLogoId } from "@/lib/image-registry"
import { useImageSrc } from "@/hooks/use-image-src"
import { advanceRibbonMotion, isHorizontalRibbonDrag, ribbonReleaseSpeed, wrapRibbonOffset } from "@/lib/brand-ribbon-motion"

interface BrandData {
  id: string
  slug: string
  name: string
  logoUrl: string | null
}

interface BrandLogoScrollProps {
  brands?: BrandData[] | null
}

// Tile — no borders, no background. Logo floats directly on the sky-blue
// (#bde7ff) banner per client feedback (Apr 16). When a brand hasn't had
// a logo uploaded yet we fall back to a neutral wordmark sized + weighted
// to sit harmoniously next to real logos — so a half-populated scroll
// still reads as a cohesive row rather than a broken state.
//
// Defined at module level (not inside the parent's render) so React keeps
// the same component identity across renders instead of remounting every
// tile. Each tile links to its brand page — the homepage previously passed
// no link equity (or navigation path) to the brand details at all.
function Tile({ brand }: { brand: BrandData }) {
  const id = brandLogoId(brand.slug)
  const src = useImageSrc(id, brand.logoUrl ?? "")
  const logo = src ? (
    <SiteImage
      imageId={id}
      defaultSrc={brand.logoUrl ?? ""}
      alt={brand.name}
      width={140}
      height={70}
      className="max-h-14 w-auto object-contain"
      unoptimized
    />
  ) : (
    <span className="font-bebas text-3xl tracking-[0.12em] uppercase text-[#1a1f2a] whitespace-nowrap">
      {brand.name}
    </span>
  )
  return (
    <div data-brand-tile className="flex-shrink-0 mx-10 flex items-center justify-center">
        <Link
          href={`/brands/${brand.slug}`}
          className="h-16 flex items-center justify-center px-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f2a]"
        >
          {logo}
        </Link>
    </div>
  )
}

export function BrandLogoScroll({ brands: propBrands }: BrandLogoScrollProps) {
  // null/undefined = Supabase unreachable → fall back to static BRANDS.
  // An empty array is a deliberate "no active brands" state, so render
  // nothing instead of resurrecting the compiled-in list.
  const brands = useMemo(() => propBrands ?? BRANDS.map(b => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    logoUrl: b.logoUrl ?? null,
  })), [propBrands])
  const sectionRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<{ step: (direction: number) => void; pause: (value: boolean) => void } | null>(null)
  const pauseRef = useRef(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!section || !viewport || !track) return
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const tiles = Array.from(track.querySelectorAll<HTMLElement>("[data-brand-tile]"))
    const links = Array.from(track.querySelectorAll<HTMLAnchorElement>("a"))
    let geometry: { left: number; width: number; shift: number }[] = []
    let period = 0
    let offset = 0
    let speed = 0
    let hover = false
    let focused = false
    let visible = true
    let activeWindow = document.hasFocus()
    let userPaused = pauseRef.current
    let frame = 0
    let lastFrame = 0
    let disposed = false
    let suppressClick = false
    let releasedAt = 0
    let gesture: { id: number; x: number; y: number; lastX: number; time: number; speed: number; dragging: boolean } | null = null
    const autoSpeed = () => -period / 60000

    function draw(nextOffset: number) {
      offset = period > viewport!.clientWidth ? wrapRibbonOffset(nextOffset, period) : 0
      track!.style.transform = `translate3d(${offset}px,0,0)`
      // One link per brand. Only off-screen tiles move across the loop seam.
      tiles.forEach((tile, i) => {
        const item = geometry[i]
        if (!item) return
        const shift = item.left + item.width + offset <= 0 ? period : 0
        if (shift !== item.shift) {
          tile.style.transform = shift ? `translateX(${shift}px)` : ""
          item.shift = shift
        }
      })
    }

    function stop() {
      cancelAnimationFrame(frame)
      frame = 0
    }

    function start() {
      const stopped = disposed || hover || focused || gesture || userPaused || media.matches || !visible || !activeWindow || document.hidden || period <= viewport!.clientWidth
      if (stopped) return stop()
      if (!frame) {
        lastFrame = performance.now()
        frame = requestAnimationFrame(tick)
      }
    }

    function tick(now: number) {
      const next = advanceRibbonMotion(speed, now - lastFrame, autoSpeed())
      speed = next.speed
      lastFrame = now
      draw(offset + next.distance)
      frame = requestAnimationFrame(tick)
    }

    function measure() {
      const oldPeriod = period
      period = track!.getBoundingClientRect().width
      geometry = tiles.map(tile => ({ left: tile.offsetLeft, width: tile.offsetWidth, shift: NaN }))
      section!.querySelectorAll<HTMLButtonElement>("[data-ribbon-step]").forEach(button => { button.disabled = period <= viewport!.clientWidth })
      draw(oldPeriod ? offset * period / oldPeriod : 0)
      if (focused && document.activeElement instanceof HTMLElement && track!.contains(document.activeElement)) reveal(document.activeElement)
      speed = autoSpeed()
      start()
    }

    function pointerDown(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0 || gesture || period <= viewport!.clientWidth) return
      suppressClick = false
      focused = false
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, time: event.timeStamp, speed: 0, dragging: false }
      stop()
    }

    function pointerMove(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.id) return
      if (!gesture.dragging) {
        if (!isHorizontalRibbonDrag(event.clientX - gesture.x, event.clientY - gesture.y)) return
        gesture.dragging = true
        viewport!.setPointerCapture(event.pointerId)
        viewport!.dataset.dragging = "true"
      }
      event.preventDefault()
      const dx = event.clientX - gesture.lastX
      const elapsed = event.timeStamp - gesture.time
      if (elapsed > 0) gesture.speed = dx / Math.max(8, elapsed)
      draw(offset + dx)
      gesture.lastX = event.clientX
      gesture.time = event.timeStamp
    }

    function pointerEnd(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.id) return
      const ended = gesture
      gesture = null
      suppressClick = ended.dragging
      speed = ended.dragging && event.type === "pointerup"
        ? ribbonReleaseSpeed(ended.speed, event.timeStamp - ended.time, media.matches)
        : autoSpeed()
      releasedAt = performance.now()
      viewport!.dataset.dragging = "false"
      if (viewport!.hasPointerCapture(event.pointerId)) viewport!.releasePointerCapture(event.pointerId)
      if (event.pointerType === "mouse") {
        const box = section!.getBoundingClientRect()
        hover = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
      }
      start()
    }

    function click(event: MouseEvent) {
      if (suppressClick && event.detail > 0) {
        event.preventDefault()
        event.stopPropagation()
        suppressClick = false
      }
    }

    function enter(event: PointerEvent) {
      if (event.pointerType === "mouse" || event.pointerType === "pen") { hover = true; stop() }
    }
    function leave() { hover = false; if (performance.now() - releasedAt > 1500) speed = autoSpeed(); start() }
    function reveal(target: HTMLElement) {
        const box = target.getBoundingClientRect()
        const view = viewport!.getBoundingClientRect()
        if (box.left < view.left + 8) draw(offset + view.left + 8 - box.left)
        else if (box.right > view.right - 8) draw(offset - (box.right - view.right + 8))
    }
    function focusIn(event: FocusEvent) {
      const target = event.target as HTMLElement
      focused = target.matches(":focus-visible")
      if (focused && track!.contains(target)) reveal(target)
      start()
    }
    function focusOut() { queueMicrotask(() => { focused = section!.contains(document.activeElement) && !!document.activeElement?.matches(":focus-visible"); start() }) }
    function keyDown(event: KeyboardEvent) {
      const index = links.indexOf(event.target as HTMLAnchorElement)
      if (index < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
      event.preventDefault()
      const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + links.length) % links.length
      links[next].focus({ preventScroll: true })
      focused = true
      stop()
      reveal(links[next])
    }
    function noNativeDrag(event: DragEvent) { event.preventDefault() }
    function lostCapture(event: PointerEvent) { if (event.target === viewport) pointerEnd(event) }
    function blurWindow() { activeWindow = false; gesture = null; viewport!.dataset.dragging = "false"; speed = autoSpeed(); stop() }
    function focusWindow() { activeWindow = true; start() }
    function motionChange() { speed = autoSpeed(); start() }

    controlsRef.current = {
      step(direction) { speed = autoSpeed(); draw(offset - direction * viewport!.clientWidth * 0.6) },
      pause(value) { userPaused = value; pauseRef.current = value; speed = autoSpeed(); start() },
    }
    const resize = new ResizeObserver(measure)
    resize.observe(track)
    resize.observe(viewport)
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (!visible) speed = autoSpeed()
      start()
    })
    intersection.observe(section)
    viewport.addEventListener("pointerdown", pointerDown)
    viewport.addEventListener("pointermove", pointerMove)
    viewport.addEventListener("click", click, true)
    viewport.addEventListener("dragstart", noNativeDrag)
    viewport.addEventListener("lostpointercapture", lostCapture)
    section.addEventListener("pointerenter", enter)
    section.addEventListener("pointerleave", leave)
    section.addEventListener("focusin", focusIn)
    section.addEventListener("focusout", focusOut)
    section.addEventListener("keydown", keyDown)
    window.addEventListener("pointerup", pointerEnd)
    window.addEventListener("pointercancel", pointerEnd)
    window.addEventListener("blur", blurWindow)
    window.addEventListener("focus", focusWindow)
    document.addEventListener("visibilitychange", motionChange)
    media.addEventListener("change", motionChange)
    measure()
    return () => {
      disposed = true
      stop()
      resize.disconnect()
      intersection.disconnect()
      controlsRef.current = null
      viewport.removeEventListener("pointerdown", pointerDown)
      viewport.removeEventListener("pointermove", pointerMove)
      viewport.removeEventListener("click", click, true)
      viewport.removeEventListener("dragstart", noNativeDrag)
      viewport.removeEventListener("lostpointercapture", lostCapture)
      section.removeEventListener("pointerenter", enter)
      section.removeEventListener("pointerleave", leave)
      section.removeEventListener("focusin", focusIn)
      section.removeEventListener("focusout", focusOut)
      section.removeEventListener("keydown", keyDown)
      window.removeEventListener("pointerup", pointerEnd)
      window.removeEventListener("pointercancel", pointerEnd)
      window.removeEventListener("blur", blurWindow)
      window.removeEventListener("focus", focusWindow)
      document.removeEventListener("visibilitychange", motionChange)
      media.removeEventListener("change", motionChange)
    }
  }, [brands])

  if (brands.length === 0) return null

  return (
    <section ref={sectionRef} className="group/ribbon relative py-10 bg-[#bde7ff] overflow-hidden" aria-label="Brands we carry">
      <div ref={viewportRef} className="relative cursor-grab select-none data-[dragging=true]:cursor-grabbing" style={{ touchAction: "pan-y pinch-zoom" }}>
        {/* Soft fade at the edges so the scroll doesn't feel hard-cut. */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#bde7ff] to-transparent z-10 pointer-events-none group-focus-within/ribbon:opacity-0" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#bde7ff] to-transparent z-10 pointer-events-none group-focus-within/ribbon:opacity-0" />

        <div ref={trackRef} className="relative flex w-max">
          {brands.map((brand, index) => (
            <Tile key={`brand-1-${index}`} brand={brand} />
          ))}
        </div>
      </div>
      <div className="absolute bottom-0.5 right-4 flex rounded-full border border-black/15 bg-white/95 text-[#1a1f2a]" role="group" aria-label="Brand navigation">
        <button type="button" data-ribbon-step aria-label="Previous brands" onClick={() => controlsRef.current?.step(-1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f2a]"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" aria-label={paused ? "Resume brand scroll" : "Pause brand scroll"} onClick={() => { controlsRef.current?.pause(!paused); setPaused(!paused) }} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f2a]">{paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}</button>
        <button type="button" data-ribbon-step aria-label="Next brands" onClick={() => controlsRef.current?.step(1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f2a]"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
      </div>
    </section>
  )
}
