"use client"

import { memo, useEffect, useState } from "react"
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
  const [hoverColourName, setHoverColourName] = useState<string | null>(null)
  const [focusColourName, setFocusColourName] = useState<string | null>(null)
  const previewColour = product.colours.find((colour) => colour.name === (hoverColourName ?? focusColourName))
  const firstColour = product.colours[0]
  // Cards render up to ~290px CSS in the 4-up grid; 750w covers 2x displays
  // without forcing the low seeded `format=500w` hint to upscale soft.
  const firstImage = withMinImageWidth(previewColour?.images[0] || firstColour?.images[0] || "", 750)
  // Keep the product button and colour preview buttons separate.
  const titleId = `product-title-${product.sku.replace(/\s+/g, "-")}`

  useEffect(() => {
    if (!previewColour) return
    const dismissPreview = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      setHoverColourName(null)
      setFocusColourName(null)
    }
    window.addEventListener("keydown", dismissPreview)
    return () => window.removeEventListener("keydown", dismissPreview)
  }, [previewColour])

  return (
    <div
      onPointerLeave={() => setHoverColourName(null)}
      className={`group relative duration-200 hover:-translate-y-1 ${
        inCatalog
          ? "rounded-xl border border-[#d9d9d9] bg-white p-3 sm:p-4 transition-[transform,box-shadow,border-color] hover:border-[#b8b8b8] hover:shadow-md"
          : "rounded transition-transform"
      } ${
        onDark ? "focus-visible:ring-offset-[#111111]" : ""
      }`}
    >
      {onClick && (
        <button
          type="button"
          onClick={() => {
            setHoverColourName(null)
            setFocusColourName(null)
            onClick()
          }}
          aria-labelledby={titleId}
          className={`absolute inset-0 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef473f] focus-visible:ring-offset-2 ${onDark ? "focus-visible:ring-offset-[#111111]" : ""}`}
        />
      )}
      {/* Image */}
      <div className={`pointer-events-none relative aspect-[3/4] overflow-hidden mb-3 ${inCatalog ? "bg-[#f4f4f4] rounded-lg" : "bg-[#e4e4e4] rounded"}`}>
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
      <div className="relative z-10 flex flex-wrap gap-1.5 mb-2 pointer-events-none">
        {product.colours.slice(0, 8).map((colour, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Preview ${colour.name}`}
            className={`pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${onDark ? "focus-visible:ring-white focus-visible:ring-offset-[#111111]" : "focus-visible:ring-black focus-visible:ring-offset-white"}`}
            onPointerEnter={(event) => {
              if (event.pointerType !== "touch") {
                setFocusColourName(null)
                setHoverColourName(colour.name)
              }
            }}
            onFocus={() => {
              setHoverColourName(null)
              setFocusColourName(colour.name)
            }}
            onBlur={() => setFocusColourName(null)}
            onClick={(event) => {
              event.currentTarget.focus()
              setFocusColourName(colour.name)
            }}
            title={colour.name}
          >
            <span
              aria-hidden="true"
              className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${onDark ? "border-[#999]" : "border-[#767676]"}`}
              style={{ backgroundColor: colour.hex }}
            />
          </button>
        ))}
        {product.colours.length > 8 && (
          <span
            className={`text-[10px] font-semibold tracking-wide self-center ${
              onDark ? "text-[#aaa]" : inCatalog ? "text-[#6b6b6b]" : "text-[#666]"
            }`}
          >
            +{product.colours.length - 8} more
          </span>
        )}
      </div>

      {/* Product Name */}
      <h3
        id={titleId}
        className={`pointer-events-none font-bold uppercase ${inCatalog ? "text-[13px] sm:text-sm tracking-[0.025em] leading-snug break-words" : "text-xs tracking-wide leading-tight"} ${
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
