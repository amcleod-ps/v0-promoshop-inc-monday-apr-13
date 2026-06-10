"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { ProductCard } from "@/components/studio/product-card"
import { ProductDetailModal } from "@/components/studio/product-detail-modal"
import { useLocale } from "@/lib/locale-context"
import type { Product } from "@/lib/products"

// Brand page products grid — client-side so the detail modal can open in
// place. Previously the grid wrapped each card in a <Link> to /studio which
// defeated the "add to quote" flow entirely (client feedback Apr 16).
interface Props {
  products: Product[]
  brandName: string
}

export function BrandProductsGrid({ products, brandName }: Props) {
  const { t } = useLocale()
  const [selected, setSelected] = useState<Product | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const openModal = (product: Product) => {
    setSelected(product)
    setIsOpen(true)
  }

  const closeModal = () => {
    // The modal unmounts instantly when isOpen flips (it renders null), so
    // there is no exit animation to wait for.
    setIsOpen(false)
    setSelected(null)
  }

  if (products.length === 0) {
    return (
      <div className="bg-white border border-[#d0d0d0] rounded-lg p-12 text-center">
        <p className="font-extrabold text-xl uppercase tracking-wide text-black mb-2">
          Products Coming Soon
        </p>
        <p className="text-[#666] mb-6">
          We&apos;re adding {brandName} products to our {t("catalog")}. Contact us for availability.
        </p>
        <Link
          href="/#contact"
          className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 font-bold text-sm tracking-wider uppercase rounded hover:opacity-80 transition-opacity"
        >
          Contact Us
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {products.map((product) => (
          <ProductCard
            key={product.sku}
            product={product}
            onClick={() => openModal(product)}
          />
        ))}
      </div>

      <ProductDetailModal
        product={selected}
        isOpen={isOpen}
        onClose={closeModal}
      />
    </>
  )
}
