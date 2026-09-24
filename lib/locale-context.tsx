"use client"

import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { DEFAULT_LOCALE, LOCALES, type Locale, type LocaleConfig } from "@/lib/cms/locale"

interface LocaleContextType {
  locale: Locale
  config: LocaleConfig
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined)

const STORAGE_KEY = "promoshop-locale"

export function LocaleProvider({ children, initialLocale = DEFAULT_LOCALE }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  // Each new visit follows its country domain. An explicit choice lasts for
  // this tab session; legacy localStorage cannot override the .ca default.
  useEffect(() => {
    const host = window.location.hostname.toLowerCase()
    const initial: Locale = host === "promoshopstudio.com" || host === "www.promoshopstudio.com" ? "USA" : "CAN"
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      setLocaleState(stored === "CAN" || stored === "USA" ? stored : initial)
    } catch {
      setLocaleState(initial)
    }
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      sessionStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }, [])

  const value = useMemo<LocaleContextType>(() => {
    const config = LOCALES[locale]
    return {
      locale,
      config,
      setLocale,
      t: (key: string) => config.spelling[key] ?? key,
    }
  }, [locale, setLocale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider")
  return ctx
}
