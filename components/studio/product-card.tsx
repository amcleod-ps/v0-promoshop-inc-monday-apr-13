"use client"

import type { Product } from "@/lib/products"
import { SafeImage } from "@/components/safe-image"

interface ProductCardProps {
  product: Product
  onClick?: () => void
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  const firstColour = product.colours[0]
  const firstImage = firstColour?.images[0] || ""
  // aria-labelledby (not aria-label) so the swatch names and "+N more"
  // inside the card stay readable to assistive tech.
  const titleId = `product-title-${product.sku.replace(/\s+/g, "-")}`

  return (
    <div
      className="group cursor-pointer rounded transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef473f] focus-visible:ring-offset-2"
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
      <div className="relative aspect-[3/4] bg-[#e4e4e4] rounded overflow-hidden mb-3">
        {firstImage && (
          <SafeImage
            src={firstImage}
            alt=""
            fill
            className="object-cover transition-transform duration-400 group-hover:scale-105"
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
            className="w-5 h-5 rounded-full border-2 border-black/10 flex-shrink-0 transition-transform hover:scale-110"
            style={{ backgroundColor: colour.hex }}
            title={colour.name}
          >
            <span className="sr-only">{colour.name}</span>
          </span>
        ))}
        {product.colours.length > 8 && (
          <span className="text-[10px] text-[#777] font-semibold tracking-wide self-center">
            +{product.colours.length - 8} more
          </span>
        )}
      </div>

      {/* Product Name */}
      <h3 id={titleId} className="font-bold text-xs uppercase tracking-wide text-black leading-tight">
        {product.name}
      </h3>
    </div>
  )
}
