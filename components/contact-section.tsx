"use client"

import { Mail, Phone, MapPin } from "lucide-react"
import { useState } from "react"
import { useLocale } from "@/lib/locale-context"
import { useSiteText } from "@/components/site-content-provider"
import { submitQuoteRequest } from "@/app/actions/quotes"
import { HoneypotField } from "@/components/honeypot-field"

export function ContactSection() {
  const heading = useSiteText("contact.section.heading", "Contact Us")
  const subheading = useSiteText(
    "contact.section.subheading",
    "Have questions? Need a custom quote? Our team is here to help bring your vision to life.",
  )
  const emailAddress = useSiteText("contact.section.email", "info@promoshopinc.com")
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    message: "",
    // Honeypot — hidden from real visitors; bots that autofill it are
    // silently discarded server-side. Deliberately NOT named "website":
    // Chrome's address autofill matches that name and would silently
    // swallow real submissions from visitors with autofill profiles.
    hpCheck: ""
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const { config } = useLocale()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)

    // try/catch/finally so a network failure or server error surfaces a
    // message and re-enables the button instead of leaving it stuck on
    // "Sending..." forever.
    try {
      const result = await submitQuoteRequest({
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone || undefined,
        company: formData.company || undefined,
        message: formData.message,
        hp_check: formData.hpCheck || undefined,
      })

      if (result.success) {
        setSubmitted(true)
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          company: "",
          message: "",
          hpCheck: ""
        })
        setTimeout(() => setSubmitted(false), 5000)
      } else {
        setError(result.error || "An error occurred. Please try again.")
      }
    } catch {
      setError("Something went wrong sending your message. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="py-16 lg:py-20 px-6 lg:px-8 bg-[#111111]" id="contact">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <h2 className="font-montserrat font-bold text-2xl lg:text-3xl text-white mb-3">
            {heading}
          </h2>
          <p className="text-[#888] max-w-xl mx-auto font-visby leading-relaxed">
            {subheading}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Contact Info (locale-aware) */}
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[#ef473f]/20 flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-[#ef473f]" />
              </div>
              <div>
                <h3 className="font-montserrat font-bold text-base text-white mb-2">Phone</h3>
                <div className="space-y-1 text-[#888] font-visby">
                  {config.allContacts.map((contact) => (
                    <p key={contact.phoneHref}>
                      <span className="text-[#999] text-sm">{contact.phoneLabel}: </span>
                      <a href={contact.phoneHref} className="hover:text-[#ef473f] transition-colors">{contact.phone}</a>
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[#ef473f]/20 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-[#ef473f]" />
              </div>
              <div>
                <h3 className="font-montserrat font-bold text-base text-white mb-2">Email</h3>
                <a
                  href={`mailto:${emailAddress}`}
                  className="text-[#888] hover:text-[#ef473f] transition-colors font-visby"
                >
                  {emailAddress}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[#ef473f]/20 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-[#ef473f]" />
              </div>
              <div>
                <h3 className="font-montserrat font-bold text-base text-white mb-2">Locations</h3>
                <div className="text-[#888] space-y-1 font-visby">
                  {config.allContacts.map((contact) => (
                    <p key={contact.phoneHref}>{contact.city}, {contact.region}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 shadow-sm">
            {submitted ? (
              <div role="status" className="h-full flex items-center justify-center text-center">
                <div>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#6abf4b]/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#6abf4b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-montserrat font-bold text-xl text-white mb-2">Message Sent!</h3>
                  <p className="text-[#888] font-visby">We&apos;ll get back to you shortly.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <HoneypotField
                  id="contact-hp-check"
                  value={formData.hpCheck}
                  onChange={(hpCheck) => setFormData({ ...formData, hpCheck })}
                />
                {error && (
                  <div role="alert" className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-xs font-bold tracking-wider text-[#888] uppercase mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      autoComplete="given-name"
                      maxLength={100}
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full bg-[#111111] border border-[#333] text-white px-4 py-3 rounded text-sm font-visby focus:border-[#ef473f] focus:outline-none focus:ring-2 focus:ring-[#ef473f]/35 transition-colors placeholder:text-[#8a8a8a]"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-xs font-bold tracking-wider text-[#888] uppercase mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      autoComplete="family-name"
                      maxLength={100}
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full bg-[#111111] border border-[#333] text-white px-4 py-3 rounded text-sm font-visby focus:border-[#ef473f] focus:outline-none focus:ring-2 focus:ring-[#ef473f]/35 transition-colors placeholder:text-[#8a8a8a]"
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-bold tracking-wider text-[#888] uppercase mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="contact-email"
                      autoComplete="email"
                      maxLength={254}
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-[#111111] border border-[#333] text-white px-4 py-3 rounded text-sm font-visby focus:border-[#ef473f] focus:outline-none focus:ring-2 focus:ring-[#ef473f]/35 transition-colors placeholder:text-[#8a8a8a]"
                      placeholder="you@company.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-xs font-bold tracking-wider text-[#888] uppercase mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      autoComplete="tel"
                      maxLength={50}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-[#111111] border border-[#333] text-white px-4 py-3 rounded text-sm font-visby focus:border-[#ef473f] focus:outline-none focus:ring-2 focus:ring-[#ef473f]/35 transition-colors placeholder:text-[#8a8a8a]"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="company" className="block text-xs font-bold tracking-wider text-[#888] uppercase mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    id="company"
                    autoComplete="organization"
                    maxLength={200}
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full bg-[#111111] border border-[#333] text-white px-4 py-3 rounded text-sm font-visby focus:border-[#ef473f] focus:outline-none focus:ring-2 focus:ring-[#ef473f]/35 transition-colors placeholder:text-[#8a8a8a]"
                    placeholder="Your company name"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-xs font-bold tracking-wider text-[#888] uppercase mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    required
                    maxLength={10000}
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full bg-[#111111] border border-[#333] text-white px-4 py-3 rounded text-sm font-visby focus:border-[#ef473f] focus:outline-none focus:ring-2 focus:ring-[#ef473f]/35 transition-colors resize-none placeholder:text-[#8a8a8a]"
                    placeholder="Tell us about your project..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#ef473f] text-white py-3.5 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? "Sending..." : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
