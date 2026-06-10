"use client"

import Image, { type ImageProps } from "next/image"
import { useImageSrc } from "@/hooks/use-image-src"
import { useSiteImageAlt } from "@/components/site-images-provider"

type SiteImageProps = Omit<ImageProps, "src"> & {
  imageId: string
  defaultSrc: string
  // Override-provided sources can be arbitrary hosted URLs or data URLs,
  // which the next/image loader won't accept without remotePatterns. When
  // `true` (default), we skip Next's optimizer for override-served URLs.
  unoptimizedWhenOverridden?: boolean
}

export function SiteImage({
  imageId,
  defaultSrc,
  unoptimized,
  unoptimizedWhenOverridden = true,
  ...rest
}: SiteImageProps) {
  const src = useImageSrc(imageId, defaultSrc)
  // Admin-edited alt text (site_images.alt_text) wins over the hard-coded
  // alt prop, so the field the dashboard exposes actually reaches the page.
  const altOverride = useSiteImageAlt(imageId)
  const isOverride = src !== defaultSrc
  const effectiveUnoptimized =
    unoptimized || (isOverride && unoptimizedWhenOverridden)

  if (!src) return null

  return (
    <Image
      src={src}
      unoptimized={effectiveUnoptimized}
      {...rest}
      alt={altOverride ?? rest.alt}
    />
  )
}
