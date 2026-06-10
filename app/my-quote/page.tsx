"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useQuote } from "@/lib/quote-context"
import { PRODUCTS } from "@/lib/products"
import { submitQuoteRequest } from "@/app/actions/quotes"

export default function MyQuotePage() {
  const { 
    items, 
    contactInfo, 
    projectInfo, 
    removeItem, 
    updateItem, 
    clearItems, 
    setContactInfo, 
    setProjectInfo,
    addItem,
    isLoaded 
  } = useQuote()
  
  const [activeTab, setActiveTab] = useState<"items" | "contact" | "project">("items")
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState("")
  const [selectedColour, setSelectedColour] = useState("")
  const [selectedSize, setSelectedSize] = useState("")
  const [quantity, setQuantity] = useState(1)
  // Honeypot — deliberately NOT part of the localStorage-persisted contact
  // info; bots that autofill it are silently discarded server-side.
  const [website, setWebsite] = useState("")

  const handleAddProduct = () => {
    const product = PRODUCTS.find(p => p.sku === selectedProduct)
    if (!product) return
    const colour = product.colours.find(c => c.name === selectedColour)
    addItem({
      productSku: product.sku,
      productName: product.name,
      colour: selectedColour || product.colours[0]?.name || "",
      size: selectedSize || product.sizes[0] || "",
      quantity: quantity,
      image: colour?.images[0] || product.colours[0]?.images[0] || "",
    })
    setSelectedProduct("")
    setSelectedColour("")
    setSelectedSize("")
    setQuantity(1)
    setShowAddProduct(false)
  }

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError("")
    setSubmitting(true)

    // The quote_requests table has no structured line-item columns, so the
    // full cart + project details are serialised into `message` (which the
    // back office reads). Persisting line items as structured jsonb is a
    // recommended follow-up.
    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)
    const itemLines = items.map(
      (item) =>
        `- ${item.productName} (SKU ${item.productSku}) — ${item.colour} / ${item.size} × ${item.quantity}`,
    )
    const message = [
      projectInfo.eventName && `Event / Project: ${projectInfo.eventName}`,
      projectInfo.eventDate && `In-hands date: ${projectInfo.eventDate}`,
      projectInfo.budget && `Budget range: ${projectInfo.budget}`,
      contactInfo.jobTitle && `Job title: ${contactInfo.jobTitle}`,
      `Items (${items.length} line${items.length === 1 ? "" : "s"}, ${totalUnits} total units):`,
      ...itemLines,
      projectInfo.notes && `\nNotes:\n${projectInfo.notes}`,
    ]
      .filter(Boolean)
      .join("\n")

    // try/catch/finally so a network failure or server error surfaces a
    // message and re-enables the button instead of leaving it stuck on
    // its pending label forever.
    try {
      const result = await submitQuoteRequest({
        first_name: contactInfo.firstName,
        last_name: contactInfo.lastName,
        email: contactInfo.email,
        phone: contactInfo.phone || undefined,
        company: contactInfo.company || undefined,
        quantity_range: String(totalUnits),
        message,
        website: website || undefined,
      })

      if (result.success) {
        clearItems()
        setSubmitted(true)
      } else {
        setSubmitError(
          result.error || "Something went wrong submitting your quote. Please try again.",
        )
      }
    } catch {
      setSubmitError(
        "Something went wrong submitting your quote. Check your connection and try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#1a1a1a] text-center">
          <div className="w-8 h-8 border-2 border-[#ef473f] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-visby">Loading your quote...</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white text-[#1a1a1a]">
        <Header />
        <div className="py-24 px-6 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-[#6abf4b]/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-[#6abf4b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-montserrat font-bold text-3xl text-[#1a1a1a] mb-4">Quote Submitted!</h1>
            <p className="text-[#666] mb-8 font-visby">
              Thank you for your quote request. Our team will review your selections and get back to you within 24-48 hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/studio"
                className="inline-flex items-center justify-center gap-2 bg-[#ef473f] text-white px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity"
              >
                Continue Shopping
              </Link>
              <button
                onClick={() => { clearItems(); setSubmitted(false) }}
                className="inline-flex items-center justify-center gap-2 border border-[#e5e5e5] text-[#1a1a1a] px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:border-[#ef473f] transition-colors"
              >
                Start New Quote
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  const inputClass = "w-full bg-[#f9f9f9] border border-[#e5e5e5] text-[#1a1a1a] px-4 py-3 rounded text-sm font-visby focus:border-[#ef473f] focus:outline-none transition-colors"
  const selectClass = "w-full bg-[#f9f9f9] border border-[#e5e5e5] text-[#1a1a1a] px-4 py-3 rounded text-sm font-visby focus:border-[#ef473f] focus:outline-none"
  const labelClass = "block text-xs font-bold tracking-wider text-[#999] uppercase mb-2"

  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#1a1a1a]">
      <Header />

      <div className="py-12 px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Page Header */}
          <div className="mb-10">
            <p className="text-xs font-bold tracking-wider text-[#ef473f] uppercase mb-2">
              Quote Builder
            </p>
            <h1 className="font-montserrat font-bold text-3xl lg:text-4xl text-[#1a1a1a]">
              My Quote
            </h1>
            <p className="text-[#666] mt-2 font-visby">
              Build your quote and submit it for pricing. We&apos;ll get back to you within 24-48 hours.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-8 border-b border-[#e5e5e5]">
            {[
              { id: "items", label: "Products", count: items.length },
              { id: "contact", label: "Contact Info" },
              { id: "project", label: "Project Details" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-6 py-3 font-bold text-sm uppercase tracking-wider transition-colors relative ${
                  activeTab === tab.id 
                    ? "text-[#1a1a1a]" 
                    : "text-[#999] hover:text-[#1a1a1a]"
                }`}
              >
                {tab.label}
                {"count" in tab && typeof tab.count === "number" && tab.count > 0 && (
                  <span className="ml-2 bg-[#ef473f] text-white text-xs px-2 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ef473f]" />
                )}
              </button>
            ))}
          </div>

          {/* Items Tab */}
          {activeTab === "items" && (
            <div>
              {items.length === 0 && !showAddProduct ? (
                <div className="bg-white border border-[#e5e5e5] rounded-lg p-12 text-center shadow-sm">
                  <ShoppingBag className="w-16 h-16 text-[#ccc] mx-auto mb-4" />
                  <h3 className="font-montserrat font-bold text-xl text-[#1a1a1a] mb-2">Your Quote is Empty</h3>
                  <p className="text-[#666] mb-6 font-visby">
                    Add products from our Studio to start building your quote.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link href="/studio" className="inline-flex items-center justify-center gap-2 bg-[#ef473f] text-white px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity">
                      Browse Products <ArrowRight className="w-4 h-4" />
                    </Link>
                    <button onClick={() => setShowAddProduct(true)} className="inline-flex items-center justify-center gap-2 border border-[#e5e5e5] text-[#1a1a1a] px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:border-[#ef473f] transition-colors">
                      <Plus className="w-4 h-4" /> Add Product Manually
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {items.map((item) => (
                      <div key={item.id} className="bg-white border border-[#e5e5e5] rounded-lg p-4 flex gap-4 shadow-sm">
                        <div className="w-20 h-20 bg-[#f0f0f0] rounded overflow-hidden flex-shrink-0">
                          {item.image && (
                            <Image src={item.image} alt={item.productName} width={80} height={80} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm uppercase tracking-wide mb-1 truncate text-[#1a1a1a]">{item.productName}</h4>
                          <p className="text-xs text-[#999] mb-2 font-visby">SKU: {item.productSku}</p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="bg-[#f0f0f0] text-[#666] px-2 py-1 rounded">{item.colour}</span>
                            <span className="bg-[#f0f0f0] text-[#666] px-2 py-1 rounded">{item.size}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })} className="w-8 h-8 flex items-center justify-center border border-[#e5e5e5] rounded hover:border-[#ef473f] transition-colors">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-12 text-center font-bold">{item.quantity}</span>
                          <button onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })} className="w-8 h-8 flex items-center justify-center border border-[#e5e5e5] rounded hover:border-[#ef473f] transition-colors">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="p-2 text-[#ccc] hover:text-[#ef473f] transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {showAddProduct && (
                    <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 mb-6 shadow-sm">
                      <h3 className="font-montserrat font-bold text-lg text-[#1a1a1a] mb-4">Add Product</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className={labelClass}>Product</label>
                          <select value={selectedProduct} onChange={(e) => { setSelectedProduct(e.target.value); setSelectedColour(""); setSelectedSize("") }} className={selectClass}>
                            <option value="">Select a product</option>
                            {PRODUCTS.map((p) => (<option key={p.sku} value={p.sku}>{p.name}</option>))}
                          </select>
                        </div>
                        {selectedProduct && (
                          <>
                            <div>
                              <label className={labelClass}>Colour</label>
                              <select value={selectedColour} onChange={(e) => setSelectedColour(e.target.value)} className={selectClass}>
                                <option value="">Select colour</option>
                                {PRODUCTS.find(p => p.sku === selectedProduct)?.colours.map((c) => (<option key={c.name} value={c.name}>{c.name}</option>))}
                              </select>
                            </div>
                            <div>
                              <label className={labelClass}>Size</label>
                              <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} className={selectClass}>
                                <option value="">Select size</option>
                                {PRODUCTS.find(p => p.sku === selectedProduct)?.sizes.map((s) => (<option key={s} value={s}>{s}</option>))}
                              </select>
                            </div>
                            <div>
                              <label className={labelClass}>Quantity</label>
                              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className={inputClass} />
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <button onClick={handleAddProduct} disabled={!selectedProduct} className="bg-[#ef473f] text-white px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">Add to Quote</button>
                        <button onClick={() => setShowAddProduct(false)} className="border border-[#e5e5e5] text-[#1a1a1a] px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:border-[#ef473f] transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4">
                    {!showAddProduct && (
                      <button onClick={() => setShowAddProduct(true)} className="inline-flex items-center gap-2 border border-[#e5e5e5] text-[#1a1a1a] px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:border-[#ef473f] transition-colors">
                        <Plus className="w-4 h-4" /> Add Another Product
                      </button>
                    )}
                    <Link href="/studio" className="inline-flex items-center gap-2 border border-[#e5e5e5] text-[#1a1a1a] px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:border-[#ef473f] transition-colors">
                      Browse More Products
                    </Link>
                    {items.length > 0 && (
                      <button onClick={() => setActiveTab("contact")} className="ml-auto inline-flex items-center gap-2 bg-[#ef473f] text-white px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity">
                        Continue <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Contact Tab */}
          {activeTab === "contact" && (
            <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 lg:p-8 shadow-sm">
              <h3 className="font-montserrat font-bold text-xl text-[#1a1a1a] mb-4">Your Contact Information</h3>
              <p className="text-[#666] text-sm mb-6 font-visby">
                Signed-in users can auto-fill this information. <Link href="/sign-in" className="text-[#ef473f] hover:underline">Sign in</Link> to save time.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div><label className={labelClass}>First Name *</label><input type="text" required value={contactInfo.firstName} onChange={(e) => setContactInfo({ firstName: e.target.value })} className={inputClass} placeholder="John" /></div>
                <div><label className={labelClass}>Last Name *</label><input type="text" required value={contactInfo.lastName} onChange={(e) => setContactInfo({ lastName: e.target.value })} className={inputClass} placeholder="Doe" /></div>
                <div><label className={labelClass}>Email *</label><input type="email" required value={contactInfo.email} onChange={(e) => setContactInfo({ email: e.target.value })} className={inputClass} placeholder="john@company.com" /></div>
                <div><label className={labelClass}>Phone</label><input type="tel" value={contactInfo.phone} onChange={(e) => setContactInfo({ phone: e.target.value })} className={inputClass} placeholder="(555) 123-4567" /></div>
                <div><label className={labelClass}>Company *</label><input type="text" required value={contactInfo.company} onChange={(e) => setContactInfo({ company: e.target.value })} className={inputClass} placeholder="Acme Corp" /></div>
                <div><label className={labelClass}>Job Title</label><input type="text" value={contactInfo.jobTitle} onChange={(e) => setContactInfo({ jobTitle: e.target.value })} className={inputClass} placeholder="Marketing Manager" /></div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setActiveTab("items")} className="border border-[#e5e5e5] text-[#1a1a1a] px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:border-[#ef473f] transition-colors">Back</button>
                <button onClick={() => setActiveTab("project")} className="ml-auto inline-flex items-center gap-2 bg-[#ef473f] text-white px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity">Continue <ArrowRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {/* Project Tab */}
          {activeTab === "project" && (
            <form onSubmit={handleSubmitQuote} className="bg-white border border-[#e5e5e5] rounded-lg p-6 lg:p-8 shadow-sm">
              {/* Honeypot field: visually removed, skipped by keyboard and
                  screen readers. Real visitors never fill it. */}
              <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                <label htmlFor="quote-website">Website</label>
                <input
                  type="text"
                  id="quote-website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              <h3 className="font-montserrat font-bold text-xl text-[#1a1a1a] mb-6">Project Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div><label className={labelClass}>Event / Project Name</label><input type="text" value={projectInfo.eventName} onChange={(e) => setProjectInfo({ eventName: e.target.value })} className={inputClass} placeholder="Annual Conference 2026" /></div>
                <div><label className={labelClass}>In-Hands Date</label><input type="date" value={projectInfo.eventDate} onChange={(e) => setProjectInfo({ eventDate: e.target.value })} className={inputClass} /></div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Budget Range</label>
                  <select value={projectInfo.budget} onChange={(e) => setProjectInfo({ budget: e.target.value })} className={selectClass}>
                    <option value="">Select budget range</option>
                    <option value="under-1000">Under $1,000</option>
                    <option value="1000-5000">$1,000 - $5,000</option>
                    <option value="5000-10000">$5,000 - $10,000</option>
                    <option value="10000-25000">$10,000 - $25,000</option>
                    <option value="25000-plus">$25,000+</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Additional Notes</label>
                  <textarea rows={4} value={projectInfo.notes} onChange={(e) => setProjectInfo({ notes: e.target.value })} className={`${inputClass} resize-none`} placeholder="Tell us about your project, branding requirements, or any questions..." />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-[#f9f9f9] border border-[#e5e5e5] rounded-lg p-4 mb-6">
                <h4 className="font-montserrat font-bold text-base text-[#1a1a1a] mb-3">Quote Summary</h4>
                <div className="space-y-2 text-sm font-visby">
                  <div className="flex justify-between"><span className="text-[#999]">Products:</span><span className="text-[#1a1a1a]">{items.length} item{items.length !== 1 ? "s" : ""}</span></div>
                  <div className="flex justify-between"><span className="text-[#999]">Total Units:</span><span className="text-[#1a1a1a]">{items.reduce((sum, item) => sum + item.quantity, 0)}</span></div>
                  <div className="flex justify-between"><span className="text-[#999]">Contact:</span><span className="text-[#1a1a1a]">{contactInfo.firstName} {contactInfo.lastName}</span></div>
                  <div className="flex justify-between"><span className="text-[#999]">Company:</span><span className="text-[#1a1a1a]">{contactInfo.company || "Not specified"}</span></div>
                </div>
              </div>

              {submitError && (
                <div className="mb-4 p-3 bg-[#ef473f]/10 border border-[#ef473f]/30 rounded text-[#ef473f] text-sm" role="alert">
                  {submitError}
                </div>
              )}
              <div className="flex gap-4">
                <button type="button" onClick={() => setActiveTab("contact")} disabled={submitting} className="border border-[#e5e5e5] text-[#1a1a1a] px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:border-[#ef473f] transition-colors disabled:opacity-50">Back</button>
                <button type="submit" disabled={submitting || items.length === 0 || !contactInfo.firstName || !contactInfo.lastName || !contactInfo.email || !contactInfo.company} className="ml-auto inline-flex items-center gap-2 bg-[#ef473f] text-white px-8 py-3 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? "Submitting..." : <>Submit Quote Request <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
