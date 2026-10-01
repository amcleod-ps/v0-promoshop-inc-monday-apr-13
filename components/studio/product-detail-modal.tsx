"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { X, ChevronLeft, ChevronRight, Maximize2, Check, Eye } from "lucide-react"
import type { Product, ProductColour } from "@/lib/products"
import { useQuote } from "@/lib/quote-context"
import { useLocale } from "@/lib/locale-context"
import { useAuth } from "@/lib/auth/AuthProvider"
import { SafeImage } from "@/components/safe-image"
import { withMinImageWidth } from "@/lib/image-resolution"
import { useDialogFocus, useInertBackground, trapDialogTab } from "@/hooks/use-dialog-focus"
import { ProductLightbox } from "./product-lightbox"
import type { PriceTier } from "@/lib/pricing/types"
import {
  formatUsd,
  LARGE_QUANTITY_START,
  missingPricingKind,
  tierPriceBasisLabel,
  tierRangeLabel,
} from "@/lib/pricing/presentation"
import { missingPricingNotice } from "@/lib/pricing/notices"
import { usePricingNotices } from "@/hooks/use-pricing-notices"

interface ProductDetailModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  pricingEnabled: boolean
  tiers: readonly PriceTier[]
}

// Multi-select version of the product detail modal — per client feedback
// (Apr 16), a shopper should be able to pick one or more colours AND one or
// more sizes in a single action, then have the cross-product added to their
// quote as individual line items. e.g. navy + (S,M,L,XL) → 4 line items.
//
// Guests without a saved profile still pass through the profile page on "Add to
// quote" (client feedback Apr 16), but their selections are added to the
// localStorage cart FIRST — the cart is not profile-gated, and discarding the
// picks stranded every first-time visitor on an empty quote.
export function ProductDetailModal({
  product,
  isOpen,
  onClose,
  pricingEnabled,
  tiers,
}: ProductDetailModalProps) {
  const [selectedColours, setSelectedColours] = useState<ProductColour[]>([])
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [galleryColour, setGalleryColour] = useState<ProductColour | null>(null)
  const [hoverColourName, setHoverColourName] = useState<string | null>(null)
  const [focusColourName, setFocusColourName] = useState<string | null>(null)
  const [touchColourName, setTouchColourName] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState({ colourName: "", index: 0 })
  const [imageIndex, setImageIndex] = useState(0)
  const [lightboxGallery, setLightboxGallery] = useState<{
    colour: ProductColour | undefined
    images: string[]
    index: number
    isPreview: boolean
  } | null>(null)
  const lightboxOpen = lightboxGallery !== null
  const pendingLightboxGallery = useRef<typeof lightboxGallery>(null)
  const cancelledLightboxPointer = useRef(false)
  const pendingTouchPreview = useRef<{ colourName: string; wasActive: boolean } | null>(null)
  const { addItem } = useQuote()
  const { t } = useLocale()
  const { isAuthenticated } = useAuth()
  const pricingNotices = usePricingNotices()
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Reset selections whenever a new product is opened. Default-select the
  // first colour so the image carousel has something to show immediately;
  // sizes start empty so the customer makes an explicit choice.
  useEffect(() => {
    setHoverColourName(null)
    setFocusColourName(null)
    setTouchColourName(null)
    setPreviewImage({ colourName: "", index: 0 })
    setLightboxGallery(null)
    if (product && product.colours.length > 0) {
      const first = product.colours[0]
      setSelectedColours([first])
      setGalleryColour(first)
      setSelectedSizes([])
      setImageIndex(0)
    } else {
      setSelectedColours([])
      setGalleryColour(null)
      setSelectedSizes([])
      setImageIndex(0)
    }
  }, [product])

  // Temporary previews keep the normal gallery position and quote selections.
  const previewColour = product?.colours.find((colour) =>
    colour.name === (hoverColourName ?? focusColourName ?? touchColourName),
  )
  const isPreview = Boolean(previewColour?.images.length)
  const displayColour = isPreview ? previewColour : galleryColour ?? product?.colours[0]

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
      setHoverColourName(null)
      setFocusColourName(null)
      setTouchColourName(null)
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  // Dialog focus management: focus moves to the close button on open and
  // returns to the trigger (the product card) on close.
  useDialogFocus(isOpen, closeButtonRef)
  // Inert the rest of the page while the modal is the topmost dialog. When the
  // lightbox opens on top, hand the background-hiding over to it (otherwise we
  // would inert the lightbox itself, which sits in the same fragment).
  useInertBackground(isOpen && !lightboxOpen, dialogRef)

  const images = displayColour?.images ?? []

  const goPrev = useCallback(() => {
    if (images.length === 0) return
    if (isPreview && previewColour) {
      setPreviewImage((current) => ({
        colourName: previewColour.name,
        index: ((current.colourName === previewColour.name ? current.index : 0) - 1 + images.length) % images.length,
      }))
    } else {
      setImageIndex((i) => (i - 1 + images.length) % images.length)
    }
  }, [images.length, isPreview, previewColour])

  const goNext = useCallback(() => {
    if (images.length === 0) return
    if (isPreview && previewColour) {
      setPreviewImage((current) => ({
        colourName: previewColour.name,
        index: ((current.colourName === previewColour.name ? current.index : 0) + 1) % images.length,
      }))
    } else {
      setImageIndex((i) => (i + 1) % images.length)
    }
  }, [images.length, isPreview, previewColour])

  // Keyboard handling while the dialog is open (the lightbox manages its
  // own keys): Escape closes, arrows drive the carousel, and Tab is trapped
  // inside the dialog (aria-modal alone doesn't constrain keyboard focus).
  useEffect(() => {
    if (!isOpen || lightboxOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.key === "Escape") {
        if (isPreview) {
          e.preventDefault()
          setHoverColourName(null)
          setFocusColourName(null)
          setTouchColourName(null)
          return
        }
        onClose()
        return
      }
      if (e.key === "Tab") {
        trapDialogTab(e, dialogRef.current)
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
  }, [isOpen, lightboxOpen, isPreview, goPrev, goNext, onClose])

  const toggleColour = (colour: ProductColour) => {
    const exists = selectedColours.some((c) => c.name === colour.name)
    const next = exists ? selectedColours.filter((c) => c.name !== colour.name) : [...selectedColours, colour]
    setSelectedColours(next)
    if (!exists) {
      setGalleryColour(colour)
      setImageIndex(0)
    } else if (galleryColour?.name === colour.name) {
      setGalleryColour(next[0] ?? null)
      setImageIndex(0)
    }
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

  const activeImageIndex = isPreview
    ? previewImage.colourName === previewColour?.name ? previewImage.index : 0
    : imageIndex
  const displayIndex = images.length > 0 ? Math.min(activeImageIndex, images.length - 1) : 0

  const setDisplayIndex = (index: number) => {
    if (isPreview && previewColour) setPreviewImage({ colourName: previewColour.name, index })
    else setImageIndex(index)
  }

  const handleAddToQuote = () => {
    if (!canAdd) return

    // Fan out the cartesian product as individual quote line items. This
    // happens BEFORE any profile gate: the cart lives in localStorage and is
    // not profile-gated, so the visitor's selections must never be discarded.
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

    // Visitors without a saved profile pass through that profile form on
    // their way to the quote; their items are already saved in the cart.
    router.push(isAuthenticated ? "/my-quote" : "/sign-up?redirect=/my-quote")
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-5"
        onClick={onClose}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-detail-title"
          onPointerLeave={() => setHoverColourName(null)}
          className="bg-[#ededed] rounded-lg w-full max-w-[1060px] max-h-[94dvh] overflow-y-auto grid grid-cols-1 md:h-[min(820px,94dvh)] md:grid-cols-[55fr_45fr] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left - Image carousel */}
          <div className="relative min-w-0 min-h-0 bg-[#ddd] rounded-t-lg md:rounded-l-lg md:rounded-tr-none overflow-hidden flex flex-col">
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close"
              className="fixed top-4 right-4 md:absolute md:top-3.5 md:right-3.5 w-11 h-11 rounded-full bg-white/95 md:bg-black/15 flex items-center justify-center z-20 hover:bg-[#b8322c] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Keep the desktop image and thumbnails in the dialog.
                The product details scroll in a different panel. */}
            <div className="relative h-[min(55vw,240px)] flex-none md:flex-1 md:h-auto md:min-h-0 bg-[#e0e0e0]">
              {images[displayIndex] && (
                <button
                  type="button"
                  onPointerDown={(event) => {
                    if (event.isPrimary && event.button === 0) {
                      cancelledLightboxPointer.current = false
                      pendingLightboxGallery.current = { colour: displayColour, images, index: displayIndex, isPreview }
                    }
                  }}
                  onPointerUp={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect()
                    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
                      pendingLightboxGallery.current = null
                      cancelledLightboxPointer.current = true
                    }
                  }}
                  onPointerCancel={() => {
                    pendingLightboxGallery.current = null
                    cancelledLightboxPointer.current = true
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType !== "touch") pendingLightboxGallery.current = null
                  }}
                  onBlur={() => { pendingLightboxGallery.current = null }}
                  onKeyDown={() => {
                    pendingLightboxGallery.current = null
                    cancelledLightboxPointer.current = false
                  }}
                  onClick={() => {
                    if (cancelledLightboxPointer.current) return
                    setLightboxGallery(pendingLightboxGallery.current ?? { colour: displayColour, images, index: displayIndex, isPreview })
                    pendingLightboxGallery.current = null
                  }}
                  aria-label="Open full-screen view"
                  className="absolute inset-0 cursor-zoom-in group"
                >
                  <SafeImage
                    src={withMinImageWidth(images[displayIndex], 1500)}
                    alt={`${product.name} - ${displayColour?.name ?? ""} (${displayIndex + 1}/${images.length})`}
                    fill
                    className="object-contain object-center"
                    sizes="(max-width: 768px) 100vw, 55vw"
                  />
                  <span className="absolute top-3.5 left-3.5 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
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
              <div className="flex shrink-0 gap-2 p-3 bg-[#d4d4d4] overflow-x-auto">
                {images.map((img, i) => (
                  <button
                    key={`${img}-${i}`}
                    type="button"
                    onClick={() => setDisplayIndex(i)}
                    aria-label={`Show image ${i + 1}`}
                    aria-current={i === displayIndex}
                    className={`relative w-16 h-16 rounded overflow-hidden flex-shrink-0 border-2 transition-colors ${
                      i === displayIndex ? "border-[#b8322c]" : "border-transparent hover:border-[#999]"
                    }`}
                  >
                    <SafeImage src={img} alt="" fill className="object-contain" sizes="64px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right - Info */}
          <div className="min-w-0 min-h-0 p-4 md:p-11 flex flex-col bg-[#ededed] rounded-b-lg md:rounded-r-lg md:rounded-bl-none md:overflow-y-auto">
            {/* Product Name */}
            <h2
              id="product-detail-title"
              className="font-extrabold text-xl md:text-3xl leading-tight uppercase text-black tracking-tight mb-4 md:mb-7"
            >
              {product.name}
            </h2>

            {pricingEnabled ? (
              tiers.length > 0 ? (
                <section className="mb-7 rounded border border-[#d6d6d6] bg-white p-4" aria-labelledby="product-pricing-heading">
                  <h3 id="product-pricing-heading" className="mb-3 text-sm font-extrabold uppercase tracking-wider text-black">
                    Approximate Pricing
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-[#666]">
                        <tr>
                          <th scope="col" className="pb-2 pr-3">Quantity</th>
                          <th scope="col" className="pb-2 pr-3">Price basis</th>
                          <th scope="col" className="pb-2 text-right">Unit price (USD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tiers.map((tier, index) => (
                          <tr key={tier.tierStartQuantity} className="border-t border-[#eeeeee]">
                            <td className="py-2 pr-3">{tierRangeLabel(tiers, index)}</td>
                            <td className="py-2 pr-3 text-[#555]">{tierPriceBasisLabel(tier.tierStartQuantity)}</td>
                            <td className="py-2 text-right font-semibold">{formatUsd(tier.unitPriceUsd)} USD</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {tiers.some((tier) => tier.tierStartQuantity === LARGE_QUANTITY_START) ? (
                    <p className="mt-3 text-sm font-semibold leading-relaxed text-[#333]">
                      {pricingNotices.largeQuantity}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs leading-relaxed text-[#666]">{pricingNotices.approximate}</p>
                </section>
              ) : (
                <section className="mb-7 rounded border border-[#d6d6d6] bg-white p-4" aria-labelledby="product-pricing-heading">
                  <h3 id="product-pricing-heading" className="mb-2 text-sm font-extrabold uppercase tracking-wider text-black">
                    {missingPricingKind(product.sku) === "canadian"
                      ? "Canadian Pricing Coming Soon"
                      : "Pricing Available on Request"}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#666]">
                    {missingPricingNotice(pricingNotices, product.sku)}
                  </p>
                </section>
              )
            ) : null}

            {/* Colour Selection (multi-select). Clicking adds/removes; the
                coloured chips below list every selected colour. */}
            <div className="mb-7">
              <p className="text-sm text-[#111111] mb-3.5">
                Select all desired colours:{" "}
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
                    <div key={index} className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleColour(colour)}
                        onPointerEnter={(event) => {
                          if (event.pointerType !== "touch") {
                            setFocusColourName(null)
                            setPreviewImage({ colourName: colour.name, index: 0 })
                            setHoverColourName(colour.name)
                          }
                        }}
                        onFocus={() => {
                          setHoverColourName(null)
                          setPreviewImage({ colourName: colour.name, index: 0 })
                          setFocusColourName(colour.name)
                        }}
                        onBlur={() => setFocusColourName(null)}
                        aria-label={colour.name}
                        aria-pressed={active}
                        className={`relative w-11 h-11 rounded-full border-2 transition-all duration-200 flex-shrink-0 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4 focus-visible:ring-offset-[#ededed] ${
                          active
                            ? "border-black shadow-[0_0_0_3px_#ededed,0_0_0_5px_#000]"
                            : "border-[#767676]"
                        }`}
                        style={{ backgroundColor: colour.hex }}
                        title={colour.name}
                      >
                        {active && (
                          <Check className="w-4 h-4 absolute inset-0 m-auto text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={`Preview ${colour.name}`}
                        aria-pressed={touchColourName === colour.name}
                        title={`Preview ${colour.name}`}
                        className="hidden h-7 w-7 items-center justify-center rounded-full border border-[#777] bg-white text-[#373a36] [@media(hover:none)]:inline-flex [@media(pointer:coarse)]:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                        onFocus={() => {
                          setHoverColourName(null)
                          setPreviewImage({ colourName: colour.name, index: 0 })
                          setFocusColourName(colour.name)
                        }}
                        onBlur={() => {
                          setFocusColourName(null)
                          setTouchColourName(null)
                        }}
                        onPointerDown={(event) => {
                          if (event.isPrimary && event.button === 0) {
                            pendingTouchPreview.current = { colourName: colour.name, wasActive: touchColourName === colour.name }
                          }
                        }}
                        onPointerCancel={() => { pendingTouchPreview.current = null }}
                        onKeyDown={() => { pendingTouchPreview.current = null }}
                        onClick={(event) => {
                          const wasActive = pendingTouchPreview.current?.colourName === colour.name
                            ? pendingTouchPreview.current.wasActive
                            : touchColourName === colour.name
                          pendingTouchPreview.current = null
                          event.currentTarget.focus()
                          setFocusColourName(null)
                          setPreviewImage({ colourName: colour.name, index: 0 })
                          setTouchColourName(wasActive ? null : colour.name)
                        }}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Size Selection (multi-select). */}
            <div className="mb-7">
              <p className="text-sm text-[#111111] mb-3">
                Select all desired sizes:{selectedSizes.length > 0 ? <>{" "}<strong>{selectedSizes.join(", ")}</strong></> : null}
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
                          : "border-[#767676] bg-[#ededed] text-[#111111] hover:border-black"
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
            <p className={`text-xs text-[#666] mb-5 ${canAdd ? "invisible" : ""}`}>
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
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-screen lightbox overlays the modal */}
      <ProductLightbox
        isOpen={lightboxOpen}
        images={lightboxGallery?.images ?? images}
        initialIndex={lightboxGallery?.index ?? displayIndex}
        onClose={() => setLightboxGallery(null)}
        onIndexChange={(index) => {
          setLightboxGallery((current) => current ? { ...current, index } : null)
          if (lightboxGallery?.isPreview && lightboxGallery.colour) {
            setPreviewImage({ colourName: lightboxGallery.colour.name, index })
          } else {
            setImageIndex(index)
          }
        }}
        title={`${product.name}${(lightboxGallery?.colour ?? displayColour) ? ` \u2014 ${(lightboxGallery?.colour ?? displayColour)?.name}` : ""}`}
      />
    </>
  )
}
