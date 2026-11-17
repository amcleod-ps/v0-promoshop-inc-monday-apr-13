"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play, Volume2, VolumeX } from "lucide-react"

interface HeroVideoProps {
  src: string
  poster: string
  label: string
}

// Homepage hero video (replaces the image slideshow). Autoplay only works
// muted, so it starts muted with a sound toggle. The pause button covers
// WCAG 2.2.2 (auto-playing content longer than 5s), and reduced-motion
// visitors get the poster frame until they press play.
export function HeroVideo({ src, poster, label }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    video.play().catch(() => {
      // Autoplay blocked (e.g. low-power mode): leave the poster showing.
    })
  }, [])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play().catch(() => {})
    else video.pause()
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  const buttonClass =
    "w-11 h-11 rounded-full bg-black/45 hover:bg-black/70 text-white backdrop-blur-sm flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"

  return (
    <div className="relative pb-10 lg:py-12">
      <div className="relative w-full aspect-video overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="auto"
          aria-label={label}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        {/* Bottom-left: the video's brand logos sit bottom-right. */}
        <div className="absolute bottom-3 left-3 flex gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className={buttonClass}
            aria-label={muted ? "Turn sound on" : "Turn sound off"}
            aria-pressed={!muted}
          >
            {muted ? <VolumeX className="w-4 h-4" aria-hidden="true" /> : <Volume2 className="w-4 h-4" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className={buttonClass}
            aria-label={playing ? "Pause video" : "Play video"}
          >
            {playing ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  )
}
