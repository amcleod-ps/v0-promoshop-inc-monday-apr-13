"use client"

import Image, { type ImageProps } from "next/image"
import { useImageSrc } from "@/hooks/use-image-src"
import { useSiteImageAlt } from "@/components/site-images-provider"
import { withMinImageWidth } from "@/lib/image-resolution"

type SiteImageProps = Omit<ImageProps, "src"> & {
  imageId: string
  defaultSrc: string
  // Override-provided sources can be arbitrary hosted URLs or data URLs,
  // which the next/image loader won't accept without remotePatterns. When
  // `true` (default), we skip Next's optimizer for override-served URLs.
  unoptimizedWhenOverridden?: boolean
  // Minimum Squarespace `format=NNNNw` width to request for this render
  // context. Large hero/background placements should pass their full display
  // width so a seeded or admin-pasted Squarespace URL carrying a low `format=`
  // hint isn't served a small rendering and upscaled soft. No-ops on
  // non-Squarespace URLs (local assets, Supabase Storage uploads) and never
  // lowers an explicit higher hint — see `withMinImageWidth`.
  minSrcWidth?: number
}

export function SiteImage({
  imageId,
  defaultSrc,
  unoptimized,
  unoptimizedWhenOverridden = true,
  minSrcWidth,
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

  // Raise the resolution hint after override detection so the unoptimized
  // decision still keys off whether a row exists, not off the hint rewrite.
  const finalSrc = minSrcWidth ? withMinImageWidth(src, minSrcWidth) : src

  return (
    <Image
      src={finalSrc}
      unoptimized={effectiveUnoptimized}
      {...rest}
      alt={altOverride ?? rest.alt}
    />
  )
}
