"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

export interface AuthUser {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  company: string
  phone: string
  jobTitle: string
}
export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoaded: boolean
  signIn: () => Promise<void>
  refreshUser: () => Promise<void>
  signOut: () => Promise<void>
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const client = useMemo(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null
    return createClient()
  }, [])
  const refreshUser = useCallback(async () => {
    if (!client) { setUser(null); setIsLoaded(true); return }
    try {
      const { data: { user: verified }, error } = await client.auth.getUser()
      if (error || !verified) { setUser(null); return }
      const { data: profile } = await client.from("customer_profiles").select("username,first_name,last_name,company,phone,job_title").eq("id", verified.id).single()
      const metadata = verified.user_metadata
      const fields: Record<string, unknown> | null = profile
      const value = (field: string, fallback: string): string => {
        const stored = fields?.[field]
        const saved = metadata[fallback]
        return typeof stored === "string" ? stored : typeof saved === "string" ? saved : ""
      }
      setUser({ id: verified.id, email: verified.email ?? "", username: value("username", "username"), firstName: value("first_name", "firstName"), lastName: value("last_name", "lastName"), company: value("company", "company"), phone: value("phone", "phone"), jobTitle: value("job_title", "jobTitle") })
    } catch { setUser(null) } finally { setIsLoaded(true) }
  }, [client])
  useEffect(() => {
    try { window.localStorage.removeItem("promoshop_user") } catch {}
    void refreshUser()
    if (!client) return
    const { data: { subscription } } = client.auth.onAuthStateChange(() => {
      // Read the verified identity after the Auth callback releases its lock.
      setTimeout(() => { void refreshUser() }, 0)
    })
    return () => subscription.unsubscribe()
  }, [client, refreshUser])
  const signOut = useCallback(async () => {
    if (client) {
      const { error } = await client.auth.signOut()
      if (error) throw new Error("The account service cannot close the session. Try again.")
    }
    setUser(null)
    try { window.localStorage.removeItem("promoshop_quote_contact") } catch {}
    window.location.assign("/")
  }, [client])
  const value = useMemo(() => ({ user, isAuthenticated: user !== null, isLoaded, signIn: refreshUser, refreshUser, signOut }), [user, isLoaded, refreshUser, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error("AuthProvider is required")
  return value
}
