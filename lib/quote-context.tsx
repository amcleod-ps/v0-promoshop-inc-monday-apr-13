"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

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
      .map((it) => ({
        id: String(it.id ?? `item_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`),
        productSku: String(it.productSku ?? ""),
        productName: String(it.productName ?? ""),
        colour: String(it.colour ?? ""),
        size: String(it.size ?? ""),
        quantity: Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 1,
        ...(typeof it.image === "string" ? { image: it.image } : {}),
      }))
  } catch {
    return []
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

  // Save to localStorage on changes
  useEffect(() => {
    if (!isLoaded) return
    localStorage.setItem("promoshop_quote_items", JSON.stringify(items))
  }, [items, isLoaded])

  useEffect(() => {
    if (!isLoaded) return
    localStorage.setItem("promoshop_quote_contact", JSON.stringify(contactInfo))
  }, [contactInfo, isLoaded])

  useEffect(() => {
    if (!isLoaded) return
    localStorage.setItem("promoshop_quote_project", JSON.stringify(projectInfo))
  }, [projectInfo, isLoaded])

  const addItem = (item: Omit<QuoteItem, "id">) => {
    const newItem: QuoteItem = {
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }
    setItems((prev) => [...prev, newItem])
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const updateItem = (id: string, updates: Partial<QuoteItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
  }

  const clearItems = () => {
    setItems([])
  }

  const setContactInfo = (info: Partial<QuoteContactInfo>) => {
    setContactInfoState((prev) => ({ ...prev, ...info }))
  }

  const setProjectInfo = (info: Partial<QuoteProjectInfo>) => {
    setProjectInfoState((prev) => ({ ...prev, ...info }))
  }

  return (
    <QuoteContext.Provider
      value={{
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
      }}
    >
      {children}
    </QuoteContext.Provider>
  )
}

export function useQuote() {
  const context = useContext(QuoteContext)
  if (context === undefined) {
    throw new Error("useQuote must be used within a QuoteProvider")
  }
  return context
}
