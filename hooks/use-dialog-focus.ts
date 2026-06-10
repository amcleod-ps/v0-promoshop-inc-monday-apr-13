"use client"

import { useEffect, type RefObject } from "react"

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Shared dialog focus management (the product modal and lightbox hand-roll
 * their dialogs): moves focus to `initialFocusRef` when the dialog opens
 * and returns it to the previously focused element (the trigger) on close.
 * Pair with `trapDialogTab` in the dialog's keydown handler — `aria-modal`
 * alone doesn't constrain keyboard focus.
 */
export function useDialogFocus(
  isOpen: boolean,
  initialFocusRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    initialFocusRef.current?.focus()
    return () => previouslyFocused?.focus()
  }, [isOpen, initialFocusRef])
}

/**
 * Tab/Shift+Tab handler that wraps focus inside `root`. Call from a keydown
 * listener when `e.key === "Tab"`; handles preventDefault itself.
 */
export function trapDialogTab(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return
  const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
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
}
