"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { useImageSrc } from "@/hooks/use-image-src"
import { useSiteImageAlt } from "@/components/site-images-provider"

export interface HeroSlide {
  src: string
  alt: string
  title?: string
  subtitle?: string | null
  cta_text?: string | null
  cta_url?: string | null
  bg_color?: string | null
  /** "cover" (default, crops to fill) or "contain" (whole image, letterboxed
   *  over bg_color / the dark section background). Set per slide from the
   *  dashboard via the `image-fit.hero_slide.<id>` site_content key. */
  fit?: "cover" | "contain"
}

interface HeroSlideshowProps {
  slides: HeroSlide[]
  intervalMs?: number
}

function Slide({
  slide,
  active,
  slideIndex,
}: {
  slide: HeroSlide
  active: boolean
  slideIndex: number
}) {
  // Position-keyed override slot. The `home.slideshow.<n>` keys are NOT
  // seeded, so by default this resolves to nothing and the slide's own
  // image_url (slide.src) renders. It only kicks in if an admin manually
  // creates a slot with that exact key via "Add new site image slot" on the
  // dashboard — normally slide images are managed per-slide in the Hero
  // slides section instead.
  const overrideSrc = useImageSrc(`home.slideshow.${slideIndex}`, "")
  // When the override swaps the image, the original slide's alt text would
  // describe the wrong picture — prefer the override row's alt_text.
  const overrideAlt = useSiteImageAlt(`home.slideshow.${slideIndex}`)
  const src = overrideSrc || slide.src
  const alt = overrideSrc ? (overrideAlt ?? slide.alt) : slide.alt
  const showCta = !!(slide.cta_text && slide.cta_url)

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
        active ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={slide.bg_color ? { backgroundColor: slide.bg_color } : undefined}
      aria-hidden={!active}
    >
      {src ? (
        // The first slide is the homepage's LCP candidate — fetch it first;
        // the hidden slides can wait so they don't compete for bandwidth.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={`w-full h-full ${slide.fit === "contain" ? "object-contain" : "object-cover"}`}
          fetchPriority={slideIndex === 1 ? "high" : undefined}
          loading={slideIndex === 1 ? undefined : "lazy"}
          decoding={slideIndex === 1 ? undefined : "async"}
        />
      ) : null}

      {/* Per-slide subtitle + CTA, edited from /admin-dashboard. The title
          is intentionally not displayed: it serves as the slide's alt text
          and its label in the dashboard. Both elements are optional and the
          overlay only renders when at least one is set, so the seeded
          image-only slides keep their clean, uncaptioned look. */}
      {(slide.subtitle || showCta) && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-6 pb-12 pt-16 lg:px-8">
          {slide.subtitle ? (
            <p className="max-w-md text-lg font-semibold leading-snug text-white drop-shadow lg:text-xl">
              {slide.subtitle}
            </p>
          ) : null}
          {showCta ? (
            <a
              href={slide.cta_url!}
              // Inactive slides are aria-hidden; their CTA must also leave
              // the tab order or keyboard focus lands on an invisible link.
              tabIndex={active ? 0 : -1}
              className="inline-flex items-center gap-2 rounded-full bg-[#ef473f] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#d93e36]"
            >
              {slide.cta_text}
            </a>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function HeroSlideshow({ slides, intervalMs = 5000 }: HeroSlideshowProps) {
  const [index, setIndex] = useState(0)
  const [hoverPaused, setHoverPaused] = useState(false)
  const [focusPaused, setFocusPaused] = useState(false)
  // Explicit pause control — WCAG 2.2.2 requires a way to stop auto-playing
  // content that doesn't depend on having a mouse to hover with.
  const [userPaused, setUserPaused] = useState(false)
  const paused = hoverPaused || focusPaused || userPaused

  // Reduced-motion users start paused: the CSS kill-switch flattens the
  // crossfade, which would otherwise turn auto-advance into abrupt
  // full-panel content jumps — worse than the motion they opted out of.
  // The visible pause/play button still lets them resume deliberately.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setUserPaused(true)
    }
  }, [])

  useEffect(() => {
    if (paused || slides.length < 2) return
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length)
    }, intervalMs)
    return () => clearInterval(id)
    // `index` in the deps restarts the timer after manual navigation, so a
    // click just before the tick doesn't advance twice in quick succession.
  }, [paused, slides.length, intervalMs, index])

  if (slides.length === 0) return null

  const go = (next: number) => {
    setIndex(((next % slides.length) + slides.length) % slides.length)
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured highlights"
      className="relative h-72 lg:h-full lg:min-h-[500px] overflow-hidden"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocus={() => setFocusPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusPaused(false)
      }}
    >
      {slides.map((slide, i) => (
        <Slide
          key={`${i}-${slide.src || slide.alt}`}
          slide={slide}
          active={i === index}
          slideIndex={i + 1}
        />
      ))}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#373a36] flex items-center justify-center shadow-md transition-colors"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#373a36] flex items-center justify-center shadow-md transition-colors"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-label={userPaused ? "Resume slideshow" : "Pause slideshow"}
            aria-pressed={userPaused}
            className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#373a36] flex items-center justify-center shadow-md transition-colors"
          >
            {userPaused ? <Play className="w-4 h-4" aria-hidden="true" /> : <Pause className="w-4 h-4" aria-hidden="true" />}
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "bg-[#ef473f] w-6" : "bg-white/70 hover:bg-white w-2"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
