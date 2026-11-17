"use client"

import { useEffect, useRef } from "react"

interface HeroVideoProps {
  src: string
  poster: string
  label: string
}

// Homepage hero video (replaces the image slideshow). Silent, autoplaying,
// endlessly looping background-style video with no controls. On desktop it
// fills the whole right half of the hero section, edge to edge; on mobile it
// runs full-width below the text.
//
// Reduced-motion visitors get the poster frame instead of playback.
export function HeroVideo({ src, poster, label }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause()
      return
    }
    // Some browsers skip the autoplay attribute after hydration; nudge it.
    video.play().catch(() => {})
  }, [])

  return (
    <div className="relative -mx-6 aspect-video overflow-hidden bg-black lg:mx-0 lg:aspect-auto lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
      <video
        ref={videoRef}
        // Bias the crop right so the brand logos (bottom-right of each
        // scene) stay in frame when the panel is narrower than 16:9.
        className="absolute inset-0 h-full w-full object-cover object-[85%_50%]"
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-label={label}
      />
    </div>
  )
}
