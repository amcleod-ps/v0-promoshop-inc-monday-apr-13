"use client"

import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { DEFAULT_LOCALE, LOCALES, type Locale, type LocaleConfig } from "@/lib/cms/locale"
import { getDomainLocale, getLocaleSwitchUrl } from "@/lib/locale-routing"

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

  // Production domains control the country. Preview and local sites keep
  // the saved choice for this tab session.
  useEffect(() => {
    const domainLocale = getDomainLocale(window.location.hostname)
    if (domainLocale) {
      setLocaleState(domainLocale)
      return
    }

    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      setLocaleState(stored === "CAN" || stored === "USA" ? stored : initialLocale)
    } catch {
      setLocaleState(initialLocale)
    }
  }, [initialLocale])

  const setLocale = useCallback((next: Locale) => {
    const destination = getLocaleSwitchUrl(window.location.href, next)
    if (destination) {
      window.location.assign(destination)
      return
    }

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
