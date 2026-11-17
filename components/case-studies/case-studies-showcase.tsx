"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { CaseStudy } from "@/lib/case-studies"
import { TiltStage } from "@/components/case-studies/tilt-stage"
import { ModelSpinner } from "@/components/case-studies/model-spinner"

// Counts a stat up from zero the first time it scrolls into view. Keeps any
// prefix/suffix ("1.5×", "300+") intact and respects reduced motion.
function CountUp({ value, run }: { value: string; run: boolean }) {
  const match = value.match(/^([^\d]*)([\d.]+)(.*)$/)
  const [shown, setShown] = useState(match ? `${match[1]}0${match[3]}` : value)
  useEffect(() => {
    if (!run || !match) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value)
      return
    }
    const [, pre, num, post] = match
    const end = parseFloat(num)
    const decimals = num.includes(".") ? num.split(".")[1].length : 0
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 1200)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(`${pre}${(end * eased).toFixed(decimals)}${post}`)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per reveal
  }, [run, value])
  return <>{shown}</>
}

function CaseStudySection({
  study,
  index,
  total,
  visible,
  sectionRef,
}: {
  study: CaseStudy
  index: number
  total: number
  visible: boolean
  sectionRef: (el: HTMLElement | null) => void
}) {
  const flip = index % 2 === 1
  const number = String(index + 1).padStart(2, "0")
  const reveal = (delay: number) => ({
    className: `transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`,
    style: { transitionDelay: `${delay}ms` },
  })

  const beats: { label: string; text: string }[] = [
    { label: "The challenge", text: study.challenge },
    { label: "Our idea", text: study.idea },
    ...(study.result ? [{ label: "The result", text: study.result }] : []),
  ]

  return (
    <section
      ref={sectionRef}
      id={study.slug}
      data-index={index}
      aria-labelledby={`${study.slug}-title`}
      className="relative scroll-mt-28 overflow-hidden border-b border-white/10 py-16 lg:scroll-mt-40 lg:py-28"
    >
      {/* Oversized outline number drifting behind the content */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute top-6 select-none font-black leading-none text-transparent transition-all duration-1000 ${
          flip ? "left-4 lg:left-10" : "right-4 lg:right-10"
        } ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"}`}
        style={{ fontSize: "clamp(8rem, 22vw, 20rem)", WebkitTextStroke: "1px rgba(255,255,255,0.08)" }}
      >
        {number}
      </div>

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <div className={`lg:col-span-7 ${flip ? "lg:order-2" : ""}`}>
          <div {...reveal(0)}>
            <TiltStage
              images={study.images}
              accent={study.accent}
              modelSlot={
                study.model ? <ModelSpinner src={study.model.src} alt={study.model.alt} orbit={study.model.orbit} poster={study.images[0].src} /> : undefined
              }
            />
          </div>
        </div>

        <div className={`lg:col-span-5 ${flip ? "lg:order-1" : ""}`}>
          <div {...reveal(100)}>
            <p className="mb-3 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.25em] text-[#ef473f]">
              <span>
                {number} / {String(total).padStart(2, "0")}
              </span>
              <span className="h-px w-8 bg-[#ef473f]" aria-hidden="true" />
              <span>{study.category}</span>
            </p>
            <p className="text-sm font-bold uppercase tracking-widest text-[#aaa]">{study.client}</p>
            <h2 id={`${study.slug}-title`} className="mt-2 text-3xl font-black leading-tight tracking-tight text-white lg:text-5xl">
              {study.title}
            </h2>
          </div>

          <ol className="mt-8 space-y-5">
            {beats.map((beat, i) => (
              <li key={beat.label} {...reveal(200 + i * 120)}>
                <div className="flex gap-4">
                  <span className="mt-2 h-2 w-2 flex-none rounded-full" style={{ background: study.accent === "#e8b400" ? "#e8b400" : "#ef473f" }} aria-hidden="true" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#888]">{beat.label}</p>
                    <p className="mt-1 font-visby text-base leading-relaxed text-[#ddd] lg:text-lg">{beat.text}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {study.inside && (
            <div {...reveal(560)}>
              <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.2em] text-[#888]">Inside the box</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {study.inside.map((item) => (
                  <li key={item} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#ddd]">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {study.stats && (
            <dl {...reveal(560)} className={`mt-10 grid gap-6 border-t border-white/10 pt-8 ${study.stats.length >= 3 ? "grid-cols-3" : "grid-cols-2"} ${reveal(560).className}`}>
              {study.stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block text-4xl font-black tracking-tight text-white lg:text-5xl">
                      <CountUp value={stat.value} run={visible} />
                    </span>
                    <span className="mt-1 block text-xs font-semibold uppercase tracking-wider text-[#999]">{stat.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  )
}

export function CaseStudiesShowcase({ studies }: { studies: CaseStudy[] }) {
  const refs = useRef<(HTMLElement | null)[]>([])
  const [visible, setVisible] = useState<boolean[]>(() => studies.map(() => false))
  const [active, setActive] = useState(-1)

  useEffect(() => {
    const reveal = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const i = Number((entry.target as HTMLElement).dataset.index)
          setVisible((prev) => (prev[i] ? prev : prev.map((v, j) => (j === i ? true : v))))
        })
      },
      { threshold: 0.15 },
    )
    // "Active" = the section crossing the middle of the viewport.
    const center = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index))
        })
      },
      { rootMargin: "-50% 0px -50% 0px" },
    )
    refs.current.forEach((el) => {
      if (!el) return
      reveal.observe(el)
      center.observe(el)
    })
    return () => {
      reveal.disconnect()
      center.disconnect()
    }
  }, [])

  const go = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(studies.length - 1, i))]
    el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
  }

  const current = studies[active]

  return (
    <>
      {/* Index of all case studies */}
      <nav aria-label="Case studies" className="mx-auto max-w-7xl px-6 pb-4 lg:px-8">
        <ul className="flex flex-wrap gap-2">
          {studies.map((s, i) => (
            <li key={s.slug}>
              <a
                href={`#${s.slug}`}
                onClick={(e) => {
                  e.preventDefault()
                  go(i)
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#ccc] transition-colors hover:border-[#ef473f] hover:text-white"
              >
                <span className="text-[#ef473f]">{String(i + 1).padStart(2, "0")}</span>
                {s.client}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {studies.map((study, i) => (
        <CaseStudySection
          key={study.slug}
          study={study}
          index={i}
          total={studies.length}
          visible={visible[i]}
          sectionRef={(el) => {
            refs.current[i] = el
          }}
        />
      ))}

      {/* Floating navigator: shows where you are and steps between studies */}
      <div
        className={`fixed bottom-5 left-1/2 z-40 -translate-x-1/2 transition-all duration-500 ${
          current ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
        }`}
      >
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#1a1a1a]/90 p-1.5 pl-5 text-white shadow-2xl backdrop-blur">
          <div className="mr-2 min-w-0" aria-live="polite">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ef473f]">
              {String(active + 1).padStart(2, "0")} / {String(studies.length).padStart(2, "0")}
            </p>
            <p className="max-w-[9rem] truncate text-xs font-bold sm:max-w-[14rem]">{current?.client}</p>
          </div>
          <div className="mr-1 hidden items-center gap-1.5 sm:flex" aria-hidden="true">
            {studies.map((s, i) => (
              <span key={s.slug} className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-[#ef473f]" : "w-1.5 bg-white/30"}`} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(active - 1)}
            disabled={active <= 0}
            aria-label="Previous case study"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronUp className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => go(active + 1)}
            disabled={active >= studies.length - 1}
            aria-label="Next case study"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ef473f] transition-colors hover:bg-[#d93e36] disabled:opacity-30"
          >
            <ChevronDown className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  )
}
