"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, ArrowRight } from "lucide-react"
import { setFallbackUser } from "@/lib/auth/AuthProvider"
import { toSafeRedirect } from "@/lib/auth/safe-redirect"
import { SiteImage } from "@/components/site-image"

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInPageInner />
    </Suspense>
  )
}

function SignInPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const redirectTarget = toSafeRedirect(searchParams?.get("redirect"))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    await new Promise(resolve => setTimeout(resolve, 1000))
    if (email && password) {
      setFallbackUser({
        email,
        firstName: email.split("@")[0],
        lastName: "",
        company: "",
      })
      router.push(redirectTarget)
    } else {
      setError("Please enter your email and password")
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#f9f9f9] flex">
      {/* Left Panel - Form */}
      <main id="main-content" className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-block mb-12">
            <SiteImage
              imageId="site.logo"
              defaultSrc="/images/mainmemory/promoshop-logo.png"
              alt="PromoShop Inc"
              width={220}
              height={147}
              className="h-14 w-auto"
              unoptimized
            />
          </Link>

          <h1 className="font-montserrat font-bold text-3xl text-[#1a1a1a] mb-2">
            Welcome Back
          </h1>
          <p className="text-[#666] mb-8 font-visby">
            Sign in to your account to manage quotes and access saved information.
          </p>

          {error && (
            <div role="alert" className="bg-[#ef473f]/10 border border-[#ef473f]/30 text-[#d93e36] px-4 py-3 rounded mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="signin-email" className="block text-xs font-bold tracking-wider text-[#6b6b6b] uppercase mb-2">
                Email Address
              </label>
              <input
                id="signin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-[#e5e5e5] text-[#1a1a1a] px-4 py-3.5 rounded text-sm font-visby focus:border-[#ef473f] focus:outline-none transition-colors"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="signin-password" className="block text-xs font-bold tracking-wider text-[#6b6b6b] uppercase mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="signin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-[#e5e5e5] text-[#1a1a1a] px-4 py-3.5 rounded text-sm font-visby focus:border-[#ef473f] focus:outline-none transition-colors pr-12"
                  placeholder="Enter your password"
                />
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
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#ef473f] text-white py-4 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                  Signing In...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-[#e5e5e5] text-center">
            <p className="text-[#666] font-visby">
              Don&apos;t have an account?{" "}
              <Link href="/sign-up" className="text-[#d93e36] underline hover:no-underline font-semibold">Sign up</Link>
            </p>
          </div>

          <div className="mt-8 text-center">
            <Link href="/" className="text-sm text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors font-visby">
              Back to Home
            </Link>
          </div>
        </div>
      </main>

      {/* Right Panel - Branding.
          PS logo was invisible on the black panel (dark-on-dark). Wrapping
          it in a white rounded card gives it a proper carrier the way real
          brand marks sit on dark hero sections. */}
      <div className="hidden lg:flex flex-1 bg-[#0d0d0d] border-l border-[#2a2a2a] items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="inline-flex items-center justify-center bg-white rounded-2xl px-8 py-6 mb-8 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
            <SiteImage
              imageId="site.logo"
              defaultSrc="/images/mainmemory/promoshop-logo.png"
              alt="PromoShop Inc"
              width={260}
              height={173}
              className="h-16 w-auto"
              unoptimized
            />
          </div>
          <h2 className="font-montserrat font-bold text-2xl text-white mb-4">
            Premium Branded Merchandise
          </h2>
          <p className="text-[#888] leading-relaxed font-visby">
            Access your account to manage quotes, save your information,
            and auto-fill quote forms for faster ordering.
          </p>
        </div>
      </div>
    </div>
  )
}
