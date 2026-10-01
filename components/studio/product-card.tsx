"use client"

import { memo } from "react"
import type { Product } from "@/lib/products"
import { SafeImage } from "@/components/safe-image"
import { withMinImageWidth } from "@/lib/image-resolution"

interface ProductCardProps {
  product: Product
  onClick?: () => void
  /**
   * Surface the card sits on. The studio and brand pages are light; the
   * collection pages are near-black (#111111), where the default black
   * product name disappeared into the background (Abigail, Jul 9). "dark"
   * flips only the text/border colours — layout and behaviour are identical.
   */
  tone?: "light" | "dark"
  presentation?: "plain" | "catalog"
}

function ProductCardBase({ product, onClick, tone = "light", presentation = "plain" }: ProductCardProps) {
  const onDark = tone === "dark"
  const inCatalog = presentation === "catalog"
  const firstColour = product.colours[0]
  // Cards render up to ~290px CSS in the 4-up grid; 750w covers 2x displays
  // without forcing the low seeded `format=500w` hint to upscale soft.
  const firstImage = withMinImageWidth(firstColour?.images[0] || "", 750)
  // aria-labelledby (not aria-label) so the swatch names and "+N more"
  // inside the card stay readable to assistive tech.
  const titleId = `product-title-${product.sku.replace(/\s+/g, "-")}`

  return (
    <div
      className={`group cursor-pointer duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef473f] focus-visible:ring-offset-2 ${
        inCatalog
          ? "rounded-xl border border-[#d9d9d9] bg-white p-3 sm:p-4 transition-[transform,box-shadow,border-color] hover:border-[#b8b8b8] hover:shadow-md"
          : "rounded transition-transform"
      } ${
        onDark ? "focus-visible:ring-offset-[#111111]" : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-labelledby={onClick ? titleId : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              // Make the card operable by keyboard / assistive tech, not just
              // the mouse: Enter and Space activate it like a real button
              // (Space is preventDefault-ed so it doesn't scroll the page).
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {/* Image */}
      <div className={`relative aspect-[3/4] overflow-hidden mb-3 ${inCatalog ? "bg-[#f4f4f4] rounded-lg" : "bg-[#e4e4e4] rounded"}`}>
        {firstImage && (
          <SafeImage
            src={firstImage}
            alt=""
            fill
            className="object-contain"
            sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw"
          />
        )}
        {/* Extremely light overlay for a studio-clean look */}
        <div className="absolute inset-0 bg-white/[0.04] pointer-events-none" />
      </div>

      {/* Color Swatches */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {product.colours.slice(0, 8).map((colour, index) => (
          <span
            key={index}
            className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-transform hover:scale-110 ${
              onDark ? "border-white/25" : "border-black/10"
            }`}
            style={{ backgroundColor: colour.hex }}
            title={colour.name}
          >
            <span className="sr-only">{colour.name}</span>
          </span>
        ))}
        {product.colours.length > 8 && (
          <span
            className={`text-[10px] font-semibold tracking-wide self-center ${
              onDark ? "text-[#aaa]" : inCatalog ? "text-[#6b6b6b]" : "text-[#777]"
            }`}
          >
            +{product.colours.length - 8} more
          </span>
        )}
      </div>

      {/* Product Name */}
      <h3
        id={titleId}
        className={`font-bold uppercase ${inCatalog ? "text-[13px] sm:text-sm tracking-[0.025em] leading-snug break-words" : "text-xs tracking-wide leading-tight"} ${
          onDark ? "text-white" : "text-black"
        }`}
      >
        {product.name}
      </h3>
    </div>
  )
}

export const ProductCard = memo(ProductCardBase, (prev, next) => {
  return (
    prev.product === next.product &&
    Boolean(prev.onClick) === Boolean(next.onClick) &&
    prev.tone === next.tone &&
    prev.presentation === next.presentation
  )
})
