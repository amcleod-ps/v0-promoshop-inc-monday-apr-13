"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  company: string
}

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const USER_KEY = "promoshop_user"

interface StoredUser {
  email?: string
  firstName?: string
  lastName?: string
  company?: string
}

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredUser
    const email = typeof parsed.email === "string" ? parsed.email : ""
    if (!email) return null
    return {
      id: email,
      email,
      firstName: typeof parsed.firstName === "string" ? parsed.firstName : "",
      lastName: typeof parsed.lastName === "string" ? parsed.lastName : "",
      company: typeof parsed.company === "string" ? parsed.company : "",
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    setUser(readStoredUser())
    const sync = () => setUser(readStoredUser())
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])

  const signIn = useCallback(async () => {
    // The sign-in / sign-up pages render their own forms and call
    // setFallbackUser() to persist the record. This stub exists so consumers
    // that read useAuth().signIn don't crash.
  }, [])

  const signOut = useCallback(async () => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.removeItem(USER_KEY)
    } catch {
      // Storage unavailable — the in-memory state still signs the user out.
    }
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      signIn,
      signOut,
    }),
    [user, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    return {
      user: null,
      isAuthenticated: false,
      signIn: async () => {},
      signOut: async () => {},
    }
  }
  return ctx
}

export function setFallbackUser(user: {
  email: string
  firstName: string
  lastName?: string
  company?: string
}): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName ?? "",
        company: user.company ?? "",
      }),
    )
  } catch (e) {
    // Storage full/disabled: the session still proceeds, it just won't
    // survive a reload. Never let this throw inside a submit handler.
    console.error("Could not persist user to localStorage:", e)
  }
  window.dispatchEvent(new StorageEvent("storage", { key: USER_KEY }))
}
