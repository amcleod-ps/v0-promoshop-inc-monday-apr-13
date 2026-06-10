"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, ArrowRight, Check } from "lucide-react"
import { setFallbackUser } from "@/lib/auth/AuthProvider"
import { toSafeRedirect } from "@/lib/auth/safe-redirect"
import { useQuote } from "@/lib/quote-context"
import { SiteImage } from "@/components/site-image"

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpPageInner />
    </Suspense>
  )
}

function SignUpPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setContactInfo } = useQuote()
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", company: "", phone: "", password: "", confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const redirectTarget = toSafeRedirect(searchParams?.get("redirect"))

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (formData.password !== formData.confirmPassword) { setError("Passwords do not match"); return }
    if (formData.password.length < 8) { setError("Password must be at least 8 characters"); return }
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setFallbackUser({
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
      company: formData.company,
    })
    // Pre-fill the quote contact form through the provider (it is mounted in
    // the root layout and survives client-side navigation, so writing to
    // localStorage directly would be overwritten by its stale in-memory state).
    setContactInfo({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      company: formData.company,
    })
    router.push(redirectTarget)
    setIsLoading(false)
  }

  const passwordStrength = () => {
    const p = formData.password
    if (p.length === 0) return { text: "", color: "" }
    if (p.length < 6) return { text: "Weak", color: "text-red-700" }
    if (p.length < 10) return { text: "Medium", color: "text-yellow-700" }
    return { text: "Strong", color: "text-[#2e7d32]" }
  }
  const strength = passwordStrength()

  const inputClass = "w-full bg-white border border-[#e5e5e5] text-[#1a1a1a] px-4 py-3 rounded text-sm font-visby focus:border-[#ef473f] focus:outline-none focus:ring-2 focus:ring-[#ef473f]/25 transition-colors"
  const labelClass = "block text-xs font-bold tracking-wider text-[#6b6b6b] uppercase mb-2"

  return (
    <div className="min-h-screen bg-[#f9f9f9] flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-1 bg-[#f9f9f9] border-r border-[#e5e5e5] items-center justify-center p-12">
        <div className="max-w-md">
          <SiteImage
            imageId="site.logo"
            defaultSrc="/images/promoshop-logo-full.png"
            alt="PromoShop - Creative happens here"
            width={240}
            height={117}
            className="h-16 w-auto mb-8"
          />
          <h2 className="font-montserrat font-bold text-2xl text-[#1a1a1a] mb-4">
            Join PromoShop
          </h2>
          <p className="text-[#666] leading-relaxed mb-8 font-visby">
            Create a profile to streamline your quote requests.
          </p>
          <div className="space-y-4">
            {[
              "Auto-fill quote forms with your information",
              "Keep your quote selections saved as you browse",
            ].map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#ef473f]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-[#ef473f]" aria-hidden="true" />
                </div>
                <p className="text-[#666] text-sm font-visby">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <main id="main-content" className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-block mb-8">
            <SiteImage
              imageId="site.logo"
              defaultSrc="/images/promoshop-logo-full.png"
              alt="PromoShop - Creative happens here"
              width={220}
              height={108}
              className="h-14 w-auto"
            />
          </Link>

          <h1 className="font-montserrat font-bold text-3xl text-[#1a1a1a] mb-2">Create Account</h1>
          <p className="text-[#666] mb-6 font-visby">Get started with PromoShop today.</p>

          {error && (
            <div role="alert" className="bg-[#ef473f]/10 border border-[#ef473f]/30 text-[#d93e36] px-4 py-3 rounded mb-6 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label htmlFor="signup-first-name" className={labelClass}>First Name *</label><input id="signup-first-name" type="text" name="firstName" autoComplete="given-name" required value={formData.firstName} onChange={handleChange} className={inputClass} placeholder="John" /></div>
              <div><label htmlFor="signup-last-name" className={labelClass}>Last Name *</label><input id="signup-last-name" type="text" name="lastName" autoComplete="family-name" required value={formData.lastName} onChange={handleChange} className={inputClass} placeholder="Doe" /></div>
            </div>
            <div><label htmlFor="signup-email" className={labelClass}>Email Address *</label><input id="signup-email" type="email" name="email" autoComplete="email" required value={formData.email} onChange={handleChange} className={inputClass} placeholder="you@company.com" /></div>
            <div><label htmlFor="signup-company" className={labelClass}>Company *</label><input id="signup-company" type="text" name="company" autoComplete="organization" required value={formData.company} onChange={handleChange} className={inputClass} placeholder="Acme Corp" /></div>
            <div><label htmlFor="signup-phone" className={labelClass}>Phone</label><input id="signup-phone" type="tel" name="phone" autoComplete="tel" value={formData.phone} onChange={handleChange} className={inputClass} placeholder="(555) 123-4567" /></div>
            <div>
              <label htmlFor="signup-password" className={labelClass}>Password *</label>
              <div className="relative">
                <input id="signup-password" type={showPassword ? "text" : "password"} name="password" autoComplete="new-password" required value={formData.password} onChange={handleChange} className={`${inputClass} pr-12`} placeholder="Minimum 8 characters" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                </button>
              </div>
              {strength.text && <p className={`text-xs mt-1 ${strength.color}`}>Password strength: {strength.text}</p>}
            </div>
            <div><label htmlFor="signup-confirm-password" className={labelClass}>Confirm Password *</label><input id="signup-confirm-password" type="password" name="confirmPassword" autoComplete="new-password" required value={formData.confirmPassword} onChange={handleChange} className={inputClass} placeholder="Re-enter your password" /></div>

            <button type="submit" disabled={isLoading} className="w-full bg-[#ef473f] text-white py-4 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-6">
              {isLoading ? (<><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />Creating Account...</>) : (<>Create Account <ArrowRight className="w-4 h-4" aria-hidden="true" /></>)}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#666] font-visby">Already have an account? <Link href="/sign-in" className="text-[#d93e36] underline hover:no-underline font-semibold">Sign in</Link></p>
          </div>
          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors font-visby">Back to Home</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
