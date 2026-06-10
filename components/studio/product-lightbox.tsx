"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { SafeImage } from "@/components/safe-image"
import { useDialogFocus, trapDialogTab } from "@/hooks/use-dialog-focus"

interface ProductLightboxProps {
  isOpen: boolean
  images: string[]
  initialIndex: number
  title: string
  onClose: () => void
  onIndexChange: (index: number) => void
}

export function ProductLightbox({
  isOpen,
  images,
  initialIndex,
  title,
  onClose,
  onIndexChange,
}: ProductLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const touchStartX = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) setIndex(initialIndex)
  }, [initialIndex, isOpen])

  // Dialog focus management: focus moves in on open, returns to the
  // trigger (the modal's zoom button) on close.
  useDialogFocus(isOpen, closeButtonRef)

  // Navigation computes the next index OUTSIDE the state updater and
  // notifies the parent from the event handler. Do not sync via an effect
  // keyed on `index`: on open it re-broadcasts this component's stale
  // retained index while the reset effect pulls in `initialIndex`, and when
  // the two differ each commit swaps them — an infinite update loop.
  const changeIndex = useCallback(
    (next: number) => {
      setIndex(next)
      onIndexChange(next)
    },
    [onIndexChange],
  )

  const goPrev = useCallback(() => {
    changeIndex((index - 1 + images.length) % images.length)
  }, [changeIndex, index, images.length])

  const goNext = useCallback(() => {
    changeIndex((index + 1) % images.length)
  }, [changeIndex, index, images.length])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key === "Tab") {
        trapDialogTab(e, rootRef.current)
        return
      }
      if (e.key === "ArrowLeft") goPrev()
      else if (e.key === "ArrowRight") goNext()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, onClose, goPrev, goNext])

  if (!isOpen || images.length === 0) return null

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 40) {
      if (delta > 0) goPrev()
      else goNext()
    }
    touchStartX.current = null
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — full-screen image view`}
      className="fixed inset-0 z-[60] bg-black/95 flex flex-col"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between p-4 text-white z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-bold uppercase tracking-wider truncate">{title}</p>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold tracking-wider text-white/70">
            {index + 1} / {images.length}
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close full-screen view"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#ef473f] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main image */}
      <div
        className="flex-1 relative flex items-center justify-center p-4 md:p-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full h-full max-w-5xl">
          <SafeImage
            key={images[index]}
            src={images[index]}
            alt={`${title} (${index + 1}/${images.length})`}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                goPrev()
              }}
              aria-label="Previous image"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                goNext()
              }}
              aria-label="Next image"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
