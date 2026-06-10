"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react"

export interface QuoteItem {
  id: string
  productSku: string
  productName: string
  colour: string
  size: string
  quantity: number
  image?: string
}

export interface QuoteContactInfo {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  jobTitle: string
}

export interface QuoteProjectInfo {
  eventName: string
  eventDate: string
  budget: string
  notes: string
}

interface QuoteContextType {
  items: QuoteItem[]
  contactInfo: QuoteContactInfo
  projectInfo: QuoteProjectInfo
  addItem: (item: Omit<QuoteItem, "id">) => void
  removeItem: (id: string) => void
  updateItem: (id: string, updates: Partial<QuoteItem>) => void
  clearItems: () => void
  setContactInfo: (info: Partial<QuoteContactInfo>) => void
  setProjectInfo: (info: Partial<QuoteProjectInfo>) => void
  isLoaded: boolean
}

const defaultContactInfo: QuoteContactInfo = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  jobTitle: "",
}

const defaultProjectInfo: QuoteProjectInfo = {
  eventName: "",
  eventDate: "",
  budget: "",
  notes: "",
}

// Hard ceiling on a single line item's quantity — generous for promo
// orders, small enough to stop a tampered/corrupt value from breaking
// the serialized submission.
export const MAX_ITEM_QUANTITY = 100000

function clampQuantity(value: unknown): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, MAX_ITEM_QUANTITY)
}

// next/image throws on src values that are neither a path nor an absolute
// URL, so only keep image strings that can actually render.
function safeImagePath(value: unknown): string | null {
  if (typeof value !== "string") return null
  return /^(\/|https?:\/\/)/.test(value) ? value : null
}

// localStorage is user-writable and can hold stale data from an older schema.
// Parse defensively so a bad value can't crash the cart (items.map /
// items.length) or de-control the form inputs (value={undefined}).
function parseQuoteItems(raw: string | null): QuoteItem[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null)
      .map((it) => {
        const image = safeImagePath(it.image)
        return {
          id: String(it.id ?? `item_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`),
          productSku: String(it.productSku ?? ""),
          productName: String(it.productName ?? ""),
          colour: String(it.colour ?? ""),
          size: String(it.size ?? ""),
          quantity: clampQuantity(it.quantity),
          ...(image ? { image } : {}),
        }
      })
  } catch {
    return []
  }
}

// Storage can be full or disabled (private mode, quota); a failed save must
// never crash the render — the in-memory cart keeps working for the session.
function trySetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    console.error(`Could not persist ${key} to localStorage:`, e)
  }
}

// Merge a parsed object over the defaults, keeping only known string fields —
// guarantees every field is present and a string (no uncontrolled inputs).
function mergeStringShape<T extends object>(raw: string | null, defaults: T): T {
  if (!raw) return defaults
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return defaults
    const src = parsed as Record<string, unknown>
    const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) }
    for (const key of Object.keys(out)) {
      if (typeof src[key] === "string") out[key] = src[key]
    }
    return out as T
  } catch {
    return defaults
  }
}

const QuoteContext = createContext<QuoteContextType | undefined>(undefined)

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<QuoteItem[]>([])
  const [contactInfo, setContactInfoState] = useState<QuoteContactInfo>(defaultContactInfo)
  const [projectInfo, setProjectInfoState] = useState<QuoteProjectInfo>(defaultProjectInfo)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount (shape-guarded — see parsers above)
  useEffect(() => {
    try {
      setItems(parseQuoteItems(localStorage.getItem("promoshop_quote_items")))
      setContactInfoState(mergeStringShape(localStorage.getItem("promoshop_quote_contact"), defaultContactInfo))
      setProjectInfoState(mergeStringShape(localStorage.getItem("promoshop_quote_project"), defaultProjectInfo))
    } catch (e) {
      console.error("Error loading quote from localStorage:", e)
    }
    setIsLoaded(true)
  }, [])

  // Keep this tab in sync when another tab edits the cart (the `storage`
  // event only fires in *other* documents, so this can't loop).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "promoshop_quote_items") {
        setItems(parseQuoteItems(e.newValue))
      } else if (e.key === "promoshop_quote_contact") {
        setContactInfoState(mergeStringShape(e.newValue, defaultContactInfo))
      } else if (e.key === "promoshop_quote_project") {
        setProjectInfoState(mergeStringShape(e.newValue, defaultProjectInfo))
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  // Save to localStorage on changes
  useEffect(() => {
    if (!isLoaded) return
    trySetItem("promoshop_quote_items", JSON.stringify(items))
  }, [items, isLoaded])

  useEffect(() => {
    if (!isLoaded) return
    trySetItem("promoshop_quote_contact", JSON.stringify(contactInfo))
  }, [contactInfo, isLoaded])

  useEffect(() => {
    if (!isLoaded) return
    trySetItem("promoshop_quote_project", JSON.stringify(projectInfo))
  }, [projectInfo, isLoaded])

  const addItem = useCallback((item: Omit<QuoteItem, "id">) => {
    setItems((prev) => {
      // Same product/colour/size already in the cart → merge quantities
      // instead of stacking duplicate quantity-1 lines.
      const existing = prev.find(
        (it) =>
          it.productSku === item.productSku &&
          it.colour === item.colour &&
          it.size === item.size,
      )
      if (existing) {
        return prev.map((it) =>
          it.id === existing.id
            ? { ...it, quantity: clampQuantity(it.quantity + item.quantity) }
            : it,
        )
      }
      const newItem: QuoteItem = {
        ...item,
        quantity: clampQuantity(item.quantity),
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      }
      return [...prev, newItem]
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const updateItem = useCallback((id: string, updates: Partial<QuoteItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const next = { ...item, ...updates }
        if (updates.quantity !== undefined) next.quantity = clampQuantity(updates.quantity)
        return next
      })
    )
  }, [])

  const clearItems = useCallback(() => {
    setItems([])
  }, [])

  const setContactInfo = useCallback((info: Partial<QuoteContactInfo>) => {
    setContactInfoState((prev) => ({ ...prev, ...info }))
  }, [])

  const setProjectInfo = useCallback((info: Partial<QuoteProjectInfo>) => {
    setProjectInfoState((prev) => ({ ...prev, ...info }))
  }, [])

  const value = useMemo(
    () => ({
      items,
      contactInfo,
      projectInfo,
      addItem,
      removeItem,
      updateItem,
      clearItems,
      setContactInfo,
      setProjectInfo,
      isLoaded,
    }),
    [items, contactInfo, projectInfo, addItem, removeItem, updateItem, clearItems, setContactInfo, setProjectInfo, isLoaded],
  )

  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>
}

export function useQuote() {
  const context = useContext(QuoteContext)
  if (context === undefined) {
    throw new Error("useQuote must be used within a QuoteProvider")
  }
  return context
}
