"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { useQuote } from "@/lib/quote-context"

export function CustomerProfileSync() {
  const { user, isLoaded: authLoaded } = useAuth()
  const { setContactInfo, isLoaded: quoteLoaded } = useQuote()
  const lastUser = useRef<string | null>(null)
  useEffect(() => {
    if (!authLoaded || !quoteLoaded) return
    if (!user) { lastUser.current = null; return }
    if (lastUser.current === user.id) return
    setContactInfo({ firstName: user.firstName, lastName: user.lastName, email: user.email, company: user.company, phone: user.phone, jobTitle: user.jobTitle })
    lastUser.current = user.id
  }, [user, authLoaded, quoteLoaded, setContactInfo])
  return null
}
