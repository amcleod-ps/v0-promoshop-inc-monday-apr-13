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
 * While a hand-rolled dialog is open, marks every element *outside* it as
 * `inert` so assistive tech (browse/virtual-cursor mode) and keyboard/pointer
 * focus can't reach the background — the robust complement to `aria-modal`,
 * which not every browser/AT honours on its own. Radix dialogs do this for
 * free; the product modal and lightbox need it explicitly.
 *
 * Walks from the dialog up to <body>, inerting the siblings at each level (the
 * standard "hide others" algorithm), so it works wherever the dialog is
 * mounted without portaling. Only attributes we add are restored on close, so
 * stacked dialogs (modal → lightbox) don't clobber each other. `inert` is a
 * no-op on browsers that lack it, leaving the focus trap + `aria-modal` as the
 * graceful fallback.
 */
export function useInertBackground(
  isOpen: boolean,
  dialogRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!isOpen) return
    const dialog = dialogRef.current
    if (!dialog) return
    const inerted: HTMLElement[] = []
    let node: HTMLElement | null = dialog
    while (node && node !== document.body) {
      const parent: HTMLElement | null = node.parentElement
      if (parent) {
        for (const child of Array.from(parent.children)) {
          if (
            child !== node &&
            child instanceof HTMLElement &&
            !child.hasAttribute("inert")
          ) {
            child.setAttribute("inert", "")
            inerted.push(child)
          }
        }
      }
      node = parent
    }
    return () => inerted.forEach((el) => el.removeAttribute("inert"))
  }, [isOpen, dialogRef])
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
