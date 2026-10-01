"use client"

import type { Brand } from "@/lib/brands"
import { SiteImage } from "@/components/site-image"
import { BrandLogo } from "@/components/brand-logo"
import { brandLifestyleId } from "@/lib/image-registry"
import { useImageSrc } from "@/hooks/use-image-src"
import { useSiteText } from "@/components/site-content-provider"
import { imageFitClass, imageFitKey, normalizeImageFit } from "@/lib/image-fit"

// Keep the saved image display mode and the original brand assets.
interface Props {
  brand: Brand
}

export function BrandHero({ brand }: Props) {
  const lifestyleId = brandLifestyleId(brand.slug)
  const lifestyleSrc = useImageSrc(lifestyleId, "")
  // Admin-chosen display mode for the backdrop (cover crops to fill).
  const lifestyleFit = normalizeImageFit(
    useSiteText(imageFitKey(lifestyleId), "cover"),
  )
  const mobileImagePosition = lifestyleFit === "cover"
    ? ({ yeti: "object-[75%_center]", patagonia: "object-[25%_center]", "peter-millar": "object-[75%_center]" }[brand.slug] ?? "object-center")
    : "object-center"

  return (
    <div className="relative overflow-hidden rounded-xl mb-8 border border-[#d8e8f3]">
      {/* Lifestyle background image (behind the logo). */}
      {lifestyleSrc ? (
        <SiteImage
          imageId={lifestyleId}
          defaultSrc=""
          alt=""
          aria-hidden="true"
          width={1600}
          height={600}
          // Full-bleed backdrop spanning the page container — request
          // Squarespace's largest cached size so an admin-set low-`format=`
          // URL renders sharp on a high-DPI screen instead of upscaled soft.
          minSrcWidth={2500}
          className={`absolute inset-0 w-full h-full ${imageFitClass(lifestyleFit)} ${mobileImagePosition} sm:object-center`}
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#bde7ff] via-white to-[#e8f5ff]" />
      )}
      {/* Logo card */}
      <div className={`relative flex min-h-[220px] sm:min-h-[280px] lg:min-h-[360px] p-4 sm:p-8 lg:p-10 ${lifestyleSrc ? `items-end ${brand.slug === "patagonia" ? "justify-end" : "justify-start"}` : "items-center justify-center"}`}>
        <div className="max-w-full rounded-lg bg-white/95 p-4 lg:p-6 shadow-lg border border-white/70">
          <BrandLogo
            brand={brand}
            width={320}
            height={160}
            className="h-16 w-32 max-w-full sm:h-28 sm:w-56 lg:h-36 lg:w-72 object-contain"
            fallbackClassName="font-bebas text-4xl tracking-wider text-[#373a36]"
          />
        </div>
      </div>
    </div>
  )
}
