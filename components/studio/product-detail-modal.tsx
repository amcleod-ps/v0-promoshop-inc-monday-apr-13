"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { X, ChevronLeft, ChevronRight, Maximize2, Check } from "lucide-react"
import type { Product, ProductColour } from "@/lib/products"
import { useQuote } from "@/lib/quote-context"
import { useLocale } from "@/lib/locale-context"
import { useAuth } from "@/lib/auth/AuthProvider"
import { SafeImage } from "@/components/safe-image"
import { ProductLightbox } from "./product-lightbox"

interface ProductDetailModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
}

// Multi-select version of the product detail modal — per client feedback
// (Apr 16), a shopper should be able to pick one or more colours AND one or
// more sizes in a single action, then have the cross-product added to their
// quote as individual line items. e.g. navy + (S,M,L,XL) → 4 line items.
//
// Unauthenticated guests still pass through the sign-up page on "Add to
// quote" (client feedback Apr 16), but their selections are added to the
// localStorage cart FIRST — the cart is not auth-gated, and discarding the
// picks stranded every first-time visitor on an empty quote.
export function ProductDetailModal({ product, isOpen, onClose }: ProductDetailModalProps) {
  const [selectedColours, setSelectedColours] = useState<ProductColour[]>([])
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [previewColour, setPreviewColour] = useState<ProductColour | null>(null)
  const [imageIndex, setImageIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const { addItem } = useQuote()
  const { t } = useLocale()
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Reset selections whenever a new product is opened. Default-select the
  // first colour so the image carousel has something to show immediately;
  // sizes start empty so the customer makes an explicit choice.
  useEffect(() => {
    if (product && product.colours.length > 0) {
      const first = product.colours[0]
      setSelectedColours([first])
      setPreviewColour(first)
      setSelectedSizes([])
      setImageIndex(0)
    } else {
      setSelectedColours([])
      setPreviewColour(null)
      setSelectedSizes([])
      setImageIndex(0)
    }
  }, [product])

  // Reset the image carousel when the preview colour changes.
  useEffect(() => {
    setImageIndex(0)
  }, [previewColour])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  // Dialog focus management: move focus into the dialog on open and give it
  // back to whatever opened it (the product card) on close.
  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()
    return () => previouslyFocused?.focus()
  }, [isOpen])

  const images = previewColour?.images ?? product?.colours[0]?.images ?? []

  const goPrev = useCallback(() => {
    if (images.length === 0) return
    setImageIndex((i) => (i - 1 + images.length) % images.length)
  }, [images.length])

  const goNext = useCallback(() => {
    if (images.length === 0) return
    setImageIndex((i) => (i + 1) % images.length)
  }, [images.length])

  // Keyboard handling while the dialog is open (the lightbox manages its
  // own keys): Escape closes, arrows drive the carousel, and Tab is trapped
  // inside the dialog (aria-modal alone doesn't constrain keyboard focus).
  useEffect(() => {
    if (!isOpen || lightboxOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key === "Tab") {
        const root = dialogRef.current
        if (!root) return
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !root.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (active === last || !root.contains(active))) {
          e.preventDefault()
          first.focus()
        }
        return
      }
      // Don't hijack arrow keys while the user is in a form control.
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (e.key === "ArrowLeft") goPrev()
      else if (e.key === "ArrowRight") goNext()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, lightboxOpen, goPrev, goNext, onClose])

  const toggleColour = (colour: ProductColour) => {
    setSelectedColours((prev) => {
      const exists = prev.some((c) => c.name === colour.name)
      const next = exists ? prev.filter((c) => c.name !== colour.name) : [...prev, colour]
      // Keep the carousel pointing at something sensible.
      if (!exists) {
        setPreviewColour(colour)
      } else if (previewColour?.name === colour.name) {
        setPreviewColour(next[0] ?? null)
      }
      return next
    })
  }

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
    )
  }

  const totalCombinations = useMemo(
    () => selectedColours.length * selectedSizes.length,
    [selectedColours.length, selectedSizes.length],
  )
  const canAdd = totalCombinations > 0

  if (!product || !isOpen) return null

  // Products created without explicit sizes (the dashboard allows it) are
  // sold as one-size — otherwise "Add to Quote" could never be enabled.
  const sizeOptions = product.sizes.length > 0 ? product.sizes : ["One Size"]

  // imageIndex can briefly point past the end when the preview switches to
  // a colour with fewer images (the reset effect runs a frame later).
  const displayIndex = images.length > 0 ? Math.min(imageIndex, images.length - 1) : 0

  const handleAddToQuote = () => {
    if (!canAdd) return

    // Fan out the cartesian product as individual quote line items. This
    // happens BEFORE any auth gating: the cart lives in localStorage and is
    // not auth-gated, so the visitor's selections must never be discarded.
    for (const colour of selectedColours) {
      for (const size of selectedSizes) {
        addItem({
          productSku: product.sku,
          productName: product.name,
          colour: colour.name,
          size,
          quantity: 1,
          image: colour.images[0] ?? "",
        })
      }
    }
    onClose()

    // Unauthenticated visitors pass through sign-up on their way to the
    // quote; their items are already saved in the cart.
    router.push(isAuthenticated ? "/my-quote" : "/sign-up?redirect=/my-quote")
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-5 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-detail-title"
          className={`bg-[#ededed] rounded-lg w-full max-w-[1060px] max-h-[94vh] overflow-y-auto grid grid-cols-1 md:grid-cols-[55fr_45fr] shadow-2xl transition-transform duration-300 ${isOpen ? "translate-y-0" : "translate-y-6"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left - Image carousel */}
          <div className="relative bg-[#ddd] rounded-t-lg md:rounded-l-lg md:rounded-tr-none overflow-hidden flex flex-col">
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/15 flex items-center justify-center z-20 hover:bg-[#ef473f] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative flex-1 min-h-[320px] md:min-h-[480px] bg-[#e0e0e0]">
              {images[displayIndex] && (
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  aria-label="Open full-screen view"
                  className="absolute inset-0 cursor-zoom-in group"
                >
                  <SafeImage
                    src={images[displayIndex]}
                    alt={`${product.name} - ${previewColour?.name ?? ""} (${displayIndex + 1}/${images.length})`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 55vw"
                  />
                  <span className="absolute top-3.5 left-3.5 w-8 h-8 rounded-full bg-black/15 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="w-4 h-4" />
                  </span>
                </button>
              )}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      goPrev()
                    }}
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#373a36] flex items-center justify-center shadow-md z-10"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      goNext()
                    }}
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#373a36] flex items-center justify-center shadow-md z-10"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 p-3 bg-[#d4d4d4] overflow-x-auto">
                {images.map((img, i) => (
                  <button
                    key={`${img}-${i}`}
                    type="button"
                    onClick={() => setImageIndex(i)}
                    aria-label={`Show image ${i + 1}`}
                    aria-current={i === displayIndex}
                    className={`relative w-16 h-16 rounded overflow-hidden flex-shrink-0 border-2 transition-colors ${
                      i === displayIndex ? "border-[#ef473f]" : "border-transparent hover:border-[#999]"
                    }`}
                  >
                    <SafeImage src={img} alt="" fill className="object-cover" sizes="64px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right - Info */}
          <div className="p-7 md:p-11 flex flex-col bg-[#ededed] rounded-b-lg md:rounded-r-lg md:rounded-bl-none overflow-y-auto">
            {/* Product Name */}
            <h2
              id="product-detail-title"
              className="font-extrabold text-2xl md:text-3xl leading-tight uppercase text-black tracking-tight mb-7"
            >
              {product.name}
            </h2>

            {/* Colour Selection (multi-select). Clicking adds/removes; the
                coloured chips below list every selected colour. */}
            <div className="mb-7">
              <p className="text-sm text-[#111111] mb-3.5">
                Select your {t("colors")}:{" "}
                <strong>
                  {selectedColours.length > 0
                    ? selectedColours.map((c) => c.name).join(", ")
                    : "none yet"}
                </strong>
              </p>
              <div className="flex flex-wrap gap-2.5">
                {product.colours.map((colour, index) => {
                  const active = selectedColours.some((c) => c.name === colour.name)
                  return (
                    <button
                      key={index}
                      onClick={() => toggleColour(colour)}
                      onMouseEnter={() => active && setPreviewColour(colour)}
                      aria-label={colour.name}
                      aria-pressed={active}
                      className={`relative w-11 h-11 rounded-full border-2 transition-all duration-200 flex-shrink-0 hover:scale-105 ${
                        active
                          ? "border-black shadow-[0_0_0_3px_#ededed,0_0_0_5px_#000]"
                          : "border-black/10"
                      }`}
                      style={{ backgroundColor: colour.hex }}
                      title={colour.name}
                    >
                      {active && (
                        <Check className="w-4 h-4 absolute inset-0 m-auto text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" aria-hidden="true" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Size Selection (multi-select). */}
            <div className="mb-7">
              <p className="text-sm text-[#111111] mb-3">
                Select your sizes{selectedSizes.length > 0 ? <>: <strong>{selectedSizes.join(", ")}</strong></> : null}
              </p>
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map((size, index) => {
                  const active = selectedSizes.includes(size)
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => toggleSize(size)}
                      aria-pressed={active}
                      className={`px-5 py-2.5 border rounded text-sm font-medium uppercase tracking-wide transition-colors ${
                        active
                          ? "border-black bg-black text-white"
                          : "border-[#bbb] bg-[#ededed] text-[#111111] hover:border-black"
                      }`}
                    >
                      {size}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* CTA Button */}
            <button
              type="button"
              onClick={handleAddToQuote}
              disabled={!canAdd}
              className={`block w-full text-center py-4 font-extrabold text-sm tracking-[0.2em] uppercase rounded transition-opacity mb-2 ${
                canAdd ? "bg-black text-white hover:opacity-80" : "bg-[#bbb] text-white cursor-not-allowed"
              }`}
            >
              {canAdd
                ? `Add ${totalCombinations} item${totalCombinations === 1 ? "" : "s"} to Quote`
                : "Add to Quote"}
            </button>
            <p className={`text-xs text-[#777] mb-5 ${canAdd ? "invisible" : ""}`}>
              Pick at least one {t("color")} and one size. Each combination is added as its own line item.
            </p>

            {/* Description */}
            {product.description && (
              <div className="border-t border-[#ccc] pt-5">
                <h4 className="font-extrabold text-sm tracking-wider uppercase text-black mb-3">
                  Product Details
                </h4>
                <p className="text-sm text-[#111111] leading-relaxed">
                  {product.description}
                </p>
                <div className="mt-4 space-y-2 text-sm text-[#666]">
                  <p><strong>SKU:</strong> {product.sku}</p>
                  <p><strong>Category:</strong> {product.category}</p>
                  <p><strong>Brand:</strong> {product.brands.join(", ")}</p>
                  <p><strong>Min. Order:</strong> {product.minQty} units</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-screen lightbox overlays the modal */}
      <ProductLightbox
        isOpen={lightboxOpen}
        images={images}
        initialIndex={displayIndex}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setImageIndex}
        title={`${product.name}${previewColour ? ` \u2014 ${previewColour.name}` : ""}`}
      />
    </>
  )
}
