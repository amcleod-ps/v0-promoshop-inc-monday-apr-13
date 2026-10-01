"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signInCustomer, signUpCustomer } from "@/app/actions/customer-auth"
import { useAuth } from "@/lib/auth/AuthProvider"
import { useQuote } from "@/lib/quote-context"
import { toSafeRedirect } from "@/lib/auth/safe-redirect"
import { SiteImage } from "@/components/site-image"

const inputClass = "w-full bg-white border border-[#767676] text-[#1a1a1a] px-4 py-3 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#b8322c]"
export function CustomerAuthForm({ mode }: { mode: "signin" | "signup" }) {
  return <Suspense fallback={<p role="status">Load the account form...</p>}><Form mode={mode} /></Suspense>
}
function Form({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter()
  const search = useSearchParams()
  const { refreshUser } = useAuth()
  const { setContactInfo } = useQuote()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const signup = mode === "signup"
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setBusy(true)
    const data = new FormData(event.currentTarget)
    const field = (name: string) => String(data.get(name) ?? "")
    const profile = { username: field("username"), firstName: field("firstName"), lastName: field("lastName"), company: field("company"), phone: field("phone"), jobTitle: field("jobTitle") }
    try {
      const result = signup ? await signUpCustomer({ ...profile, email: field("email"), password: field("password") }) : await signInCustomer({ identifier: field("identifier"), password: field("password") })
      if (!result.ok) { setError(result.error); return }
      if (signup) setContactInfo({ ...profile, email: field("email") })
      await refreshUser()
      router.push(toSafeRedirect(search.get("redirect"), "/account"))
      router.refresh()
    } catch { setError("The account service is not available. Try again.") } finally { setBusy(false) }
  }
  const fields = signup ? [
    ["email", "Email address", "email", "email", true], ["username", "Username", "text", "username", true],
    ["firstName", "First name", "text", "given-name", true], ["lastName", "Last name", "text", "family-name", true],
    ["company", "Company", "text", "organization", false], ["phone", "Phone", "tel", "tel", false], ["jobTitle", "Job title", "text", "organization-title", false],
  ] as const : [["identifier", "Email address or username", "text", "username", true]] as const
  return <main id="main-content" className="min-h-screen bg-[#f9f9f9] px-6 py-12 flex justify-center items-center">
    <div className="w-full max-w-md">
      <Link href="/" className="inline-block mb-8"><SiteImage imageId="site.logo" defaultSrc="/images/mainmemory/promoshop-logo.png" alt="PromoShop Inc" width={220} height={147} className="h-14 w-auto" /></Link>
      <h1 className="text-3xl font-bold text-[#1a1a1a] mb-3">{signup ? "Create an account" : "Sign in"}</h1>
      <p className="text-[#666] mb-6">{signup ? "Save your profile and see your sent quote requests." : "Enter your account details to see your profile and quote requests."}</p>
      {error && <p id="account-error" role="alert" className="p-4 mb-4 bg-red-50 text-[#b8322c] border border-[#b8322c] rounded">{error}</p>}
      <form onSubmit={submit} className="space-y-4" aria-describedby={error ? "account-error" : undefined}>
        {fields.map(([name, label, type, autoComplete, required]) => <div key={name}><label htmlFor={`account-${name}`} className="block font-semibold text-sm mb-2">{label}{required ? " (required)" : ""}</label><input id={`account-${name}`} name={name} type={type} autoComplete={autoComplete} required={required} maxLength={name === "email" || name === "identifier" ? 254 : name === "username" ? 40 : name === "company" ? 200 : name === "phone" ? 50 : 100} pattern={name === "username" ? "[A-Za-z0-9_-]{3,40}" : undefined} aria-describedby={name === "username" ? "username-help" : undefined} className={inputClass} />{name === "username" && <p id="username-help" className="text-sm text-[#666] mt-1">Use 3 to 40 letters, numbers, underscores or hyphens.</p>}</div>)}
        <div><label htmlFor="account-password" className="block font-semibold text-sm mb-2">Password (required)</label><input id="account-password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 12 : undefined} maxLength={128} className={inputClass} aria-describedby={signup ? "password-help" : undefined} />{signup && <p id="password-help" className="text-sm text-[#666] mt-1">Use 12 to 128 characters. You can paste a password.</p>}</div>
        <button type="submit" disabled={busy} className="w-full rounded bg-[#b8322c] text-white py-3 font-bold disabled:opacity-60">{busy ? "Wait..." : signup ? "Create account" : "Sign in"}</button>
      </form>
      <p className="mt-6 text-center"><Link href={`${signup ? "/sign-in" : "/sign-up"}?redirect=${encodeURIComponent(toSafeRedirect(search.get("redirect"), "/account"))}`} className="text-[#b8322c] underline">{signup ? "Sign in to an account" : "Create an account"}</Link></p>
      <p className="mt-4 text-center"><Link href="/" className="underline">Back to Home</Link></p>
    </div>
  </main>
}
