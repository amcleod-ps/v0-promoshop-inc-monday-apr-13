"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, ArrowRight, Check } from "lucide-react"
import { setFallbackUser } from "@/lib/auth/AuthProvider"
import { toSafeRedirect } from "@/lib/auth/safe-redirect"

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
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", company: "", phone: "", password: "", confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const redirectTarget = toSafeRedirect(searchParams?.get("redirect"))

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (formData.password !== formData.confirmPassword) { setError("Passwords do not match"); return }
    if (formData.password.length < 8) { setError("Password must be at least 8 characters"); return }
    if (!agreedToTerms) { setError("Please agree to the Terms of Service"); return }
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setFallbackUser({
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
      company: formData.company,
    })
    localStorage.setItem("promoshop_quote_contact", JSON.stringify({ firstName: formData.firstName, lastName: formData.lastName, email: formData.email, phone: formData.phone, company: formData.company, jobTitle: "" }))
    router.push(redirectTarget)
    setIsLoading(false)
  }

  const passwordStrength = () => {
    const p = formData.password
    if (p.length === 0) return { text: "", color: "" }
    if (p.length < 6) return { text: "Weak", color: "text-red-500" }
    if (p.length < 10) return { text: "Medium", color: "text-yellow-600" }
    return { text: "Strong", color: "text-[#6abf4b]" }
  }
  const strength = passwordStrength()

  const inputClass = "w-full bg-white border border-[#e5e5e5] text-[#1a1a1a] px-4 py-3 rounded text-sm font-visby focus:border-[#ef473f] focus:outline-none transition-colors"
  const labelClass = "block text-xs font-bold tracking-wider text-[#999] uppercase mb-2"

  return (
    <div className="min-h-screen bg-[#f9f9f9] flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-1 bg-[#f9f9f9] border-r border-[#e5e5e5] items-center justify-center p-12">
        <div className="max-w-md">
          <Image
            src="/images/promoshop-logo-full.png"
            alt="PromoShop - Creative happens here"
            width={240}
            height={80}
            className="h-16 w-auto mb-8"
          />
          <h2 className="font-montserrat font-bold text-2xl text-[#1a1a1a] mb-4">
            Join PromoShop
          </h2>
          <p className="text-[#666] leading-relaxed mb-8 font-visby">
            Create an account to unlock exclusive features and streamline your ordering experience.
          </p>
          <div className="space-y-4">
            {[
              "Save favorite products to your wishlist",
              "Auto-fill quote forms with your information",
              "Track order history and reorder easily",
              "Get personalized product recommendations",
            ].map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#ef473f]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-[#ef473f]" />
                </div>
                <p className="text-[#666] text-sm font-visby">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-block mb-8">
            <Image
              src="/images/promoshop-logo-full.png"
              alt="PromoShop - Creative happens here"
              width={220}
              height={72}
              className="h-14 w-auto"
            />
          </Link>

          <h1 className="font-montserrat font-bold text-3xl text-[#1a1a1a] mb-2">Create Account</h1>
          <p className="text-[#666] mb-6 font-visby">Get started with PromoShop today.</p>

          {error && (
            <div className="bg-[#ef473f]/10 border border-[#ef473f]/30 text-[#ef473f] px-4 py-3 rounded mb-6 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelClass}>First Name *</label><input type="text" name="firstName" required value={formData.firstName} onChange={handleChange} className={inputClass} placeholder="John" /></div>
              <div><label className={labelClass}>Last Name *</label><input type="text" name="lastName" required value={formData.lastName} onChange={handleChange} className={inputClass} placeholder="Doe" /></div>
            </div>
            <div><label className={labelClass}>Email Address *</label><input type="email" name="email" required value={formData.email} onChange={handleChange} className={inputClass} placeholder="you@company.com" /></div>
            <div><label className={labelClass}>Company *</label><input type="text" name="company" required value={formData.company} onChange={handleChange} className={inputClass} placeholder="Acme Corp" /></div>
            <div><label className={labelClass}>Phone</label><input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={inputClass} placeholder="(555) 123-4567" /></div>
            <div>
              <label className={labelClass}>Password *</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} name="password" required value={formData.password} onChange={handleChange} className={`${inputClass} pr-12`} placeholder="Minimum 8 characters" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#1a1a1a] transition-colors">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {strength.text && <p className={`text-xs mt-1 ${strength.color}`}>Password strength: {strength.text}</p>}
            </div>
            <div><label className={labelClass}>Confirm Password *</label><input type="password" name="confirmPassword" required value={formData.confirmPassword} onChange={handleChange} className={inputClass} placeholder="Re-enter your password" /></div>

            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="w-4 h-4 mt-0.5 rounded border-[#e5e5e5] bg-white text-[#ef473f] focus:ring-[#ef473f]" />
                <span className="text-sm text-[#666] font-visby">
                  I agree to the <Link href="#" className="text-[#ef473f] hover:underline">Terms of Service</Link> and <Link href="#" className="text-[#ef473f] hover:underline">Privacy Policy</Link>
                </span>
              </label>
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-[#ef473f] text-white py-4 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-6">
              {isLoading ? (<><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating Account...</>) : (<>Create Account <ArrowRight className="w-4 h-4" /></>)}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#666] font-visby">Already have an account? <Link href="/sign-in" className="text-[#ef473f] hover:underline font-semibold">Sign in</Link></p>
          </div>
          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-[#999] hover:text-[#1a1a1a] transition-colors font-visby">Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
