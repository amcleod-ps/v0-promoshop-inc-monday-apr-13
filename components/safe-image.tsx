"use client"

import Image, { type ImageProps } from "next/image"
import { useState } from "react"

/**
 * next/image wrapper that degrades to a neutral placeholder when the
 * source URL fails to load (404s, dead hosts, malformed admin-entered
 * URLs). Without this, a single dead URL renders a broken-image icon in
 * the catalog, cart, and modals.
 */
export function SafeImage({ src, alt, ...rest }: ImageProps) {
  const [failedSrc, setFailedSrc] = useState<ImageProps["src"] | null>(null)

  const broken = !src || failedSrc === src
  return (
    <Image
      {...rest}
      alt={alt}
      src={broken ? "/placeholder.svg" : src}
      onError={() => setFailedSrc(src)}
      unoptimized
    />
  )
}
