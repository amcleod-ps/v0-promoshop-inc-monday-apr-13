"use client"

import { useEffect, type ReactNode } from "react"

const BRAND_THEME = {
  primary: "#ef473f",
  accent: "#bde7ff",
  surface: "#ffffff",
  text: "#111111",
} as const

export function ThemeVarsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty("--brand-primary", BRAND_THEME.primary)
    root.style.setProperty("--brand-accent", BRAND_THEME.accent)
    root.style.setProperty("--brand-surface", BRAND_THEME.surface)
    root.style.setProperty("--brand-text", BRAND_THEME.text)
  }, [])
  return <>{children}</>
}
