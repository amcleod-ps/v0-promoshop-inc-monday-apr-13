"use client"

import { useState } from "react"
import { ProductCard } from "@/components/studio/product-card"
import { ProductDetailModal } from "@/components/studio/product-detail-modal"
import type { Product } from "@/lib/products"

/**
 * The product grid for a collection detail page. Reuses the Studio's
 * ProductCard + accessible ProductDetailModal so a collection behaves exactly
 * like the catalog (pick colours/sizes, add to quote).
 */
export function CollectionProducts({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<Product | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const open = (p: Product) => {
    setSelected(p)
    setIsOpen(true)
  }
  const close = () => {
    setIsOpen(false)
    setSelected(null)
  }

  if (products.length === 0) {
    return (
      <p className="text-center py-16 text-[#888] font-visby">
        This collection is being curated — check back soon.
      </p>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
        {/* tone="dark": this grid sits on the collection page's #111111
            background, where the card's default black name was unreadable. */}
        {products.map((product) => (
          <ProductCard key={product.sku} product={product} tone="dark" onClick={() => open(product)} />
        ))}
      </div>
      <ProductDetailModal product={selected} isOpen={isOpen} onClose={close} />
    </>
  )
}
