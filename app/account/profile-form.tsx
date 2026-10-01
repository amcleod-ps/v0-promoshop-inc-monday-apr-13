"use client"

import { useState } from "react"
import { saveCustomerProfile } from "@/app/actions/customer-auth"
import { useAuth } from "@/lib/auth/AuthProvider"
import { useQuote } from "@/lib/quote-context"
import type { CustomerProfileInput } from "@/lib/auth/customer-schema"

export function CustomerProfileForm({ email, initial }: { email: string; initial: CustomerProfileInput }) {
  const [profile, setProfile] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  const { refreshUser } = useAuth()
  const { setContactInfo } = useQuote()
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage("")
    try {
      const result = await saveCustomerProfile(profile)
      setFailed(!result.ok)
      setMessage(result.ok ? "The profile is saved." : result.error)
      if (result.ok) { setContactInfo({ ...profile, email }); await refreshUser() }
    } catch { setFailed(true); setMessage("The account service cannot save the profile. Try again.") } finally { setBusy(false) }
  }
  return <form onSubmit={submit} className="space-y-4 max-w-lg">
    <p>Email address: {email}</p>
    {([ ["username", "Username"], ["firstName", "First name"], ["lastName", "Last name"], ["company", "Company"], ["phone", "Phone"], ["jobTitle", "Job title"] ] as const).map(([key, label]) => <div key={key}><label htmlFor={`profile-${key}`} className="block font-semibold mb-2">{label}</label><input id={`profile-${key}`} name={key} value={profile[key]} onChange={event => setProfile(prev => ({ ...prev, [key]: event.target.value }))} required={["username", "firstName", "lastName"].includes(key)} maxLength={key === "username" ? 40 : key === "company" ? 200 : key === "phone" ? 50 : 100} type={key === "phone" ? "tel" : "text"} autoComplete={key === "username" ? "username" : key === "firstName" ? "given-name" : key === "lastName" ? "family-name" : key === "company" ? "organization" : key === "phone" ? "tel" : "organization-title"} className="w-full border border-[#767676] p-3 rounded focus:ring-2 focus:ring-[#b8322c]" /></div>)}
    <button disabled={busy} className="rounded bg-[#b8322c] text-white px-6 py-3 font-bold disabled:opacity-60">{busy ? "Wait..." : "Save profile"}</button>
    {message && <p role={failed ? "alert" : "status"}>{message}</p>}
  </form>
}
