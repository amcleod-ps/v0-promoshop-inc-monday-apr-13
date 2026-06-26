"use client"

import { useState } from "react"
import Link from "next/link"
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SafeImage } from "@/components/safe-image"
import { useQuote, MAX_ITEM_QUANTITY, clampQuantity } from "@/lib/quote-context"
import { useLocale } from "@/lib/locale-context"
import { useSiteText } from "@/components/site-content-provider"
import { textFallback } from "@/lib/cms/text-slots"
import { submitQuoteRequest } from "@/app/actions/quotes"
import { HoneypotField } from "@/components/honeypot-field"

/**
 * Slim projection of the catalog for the manual "Add Product" picker —
 * the full Product shape (descriptions, deco methods, every image of every
 * colour) would be serialized into the RSC payload of the hottest
 * conversion page for a picker most visitors never open.
 */
export interface PickerProduct {
  sku: string
  name: string
  sizes: string[]
  colours: Array<{ name: string; image: string }>
}

// Rendered by the server page (app/my-quote/page.tsx), which passes the
// LIVE product catalog — the manual "Add Product" picker previously offered
// only the compiled-in seed list, hiding dashboard-created products and
// still offering deactivated ones.
export default function MyQuoteClient({ products }: { products: PickerProduct[] }) {
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
  const { t } = useLocale()
  const pageEyebrow = useSiteText("quote.page.eyebrow", textFallback("quote.page.eyebrow"))
  const pageHeading = useSiteText("quote.page.heading", textFallback("quote.page.heading"))
  const pageSubheading = useSiteText(
    "quote.page.subheading",
    textFallback("quote.page.subheading"),
  )
  const successHeading = useSiteText(
    "quote.success.heading",
    textFallback("quote.success.heading"),
  )
  const successBody = useSiteText("quote.success.body", textFallback("quote.success.body"))

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
  // info; bots that autofill it are silently discarded server-side. Not
  // named "website": browser autofill matches that name (silent lead loss).
  const [hpCheck, setHpCheck] = useState("")

  const handleAddProduct = () => {
    const product = products.find(p => p.sku === selectedProduct)
    if (!product) return
    const colour = product.colours.find(c => c.name === selectedColour)
    addItem({
      productSku: product.sku,
      productName: product.name,
      colour: selectedColour || product.colours[0]?.name || "",
      size: selectedSize || product.sizes[0] || "One Size",
      quantity: quantity,
      image: colour?.image || product.colours[0]?.image || "",
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

    // The contact inputs live on a different tab (outside this <form>), so
    // native validation never sees them — catch a malformed email here
    // instead of bouncing the visitor off the server after three tabs.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactInfo.email.trim())) {
      setSubmitError("Please enter a valid email address on the Contact Info tab.")
      setActiveTab("contact")
      return
    }
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

    // The serialized cart is machine-generated — if it exceeds the action's
    // cap, give an actionable instruction instead of letting the server
    // bounce text the visitor never wrote. 16,000 matches the Zod cap.
    if (message.length > 16_000) {
      setSubmitError(
        "This quote is too large to submit in one go — please split it into two submissions or trim the notes.",
      )
      setSubmitting(false)
      return
    }

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
        hp_check: hpCheck || undefined,
      })

      if (result.success) {
        clearItems()
        setSubmitted(true)
      } else {
        setSubmitError(
          result.error || "Something went wrong submitting your quote. Please try again.",
        )
        // The server's Zod email check is stricter than the client
        // pre-check; put the visitor on the tab that has the field.
        if (result.error?.toLowerCase().includes("email")) setActiveTab("contact")
      }
    } catch {
      setSubmitError(
        "Something went wrong submitting your quote. Check your connection and try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Single lookup for the manual-add picker (used by the colour/size
  // selects and the add handler).
  const activeProduct = products.find(p => p.sku === selectedProduct)

  // Names the gaps instead of just greying the submit button out — the
  // required fields live on a different tab from the submit control.
  const missingRequirements = [
    items.length === 0 ? "at least one product" : null,
    !contactInfo.firstName.trim() ? "first name" : null,
    !contactInfo.lastName.trim() ? "last name" : null,
    !contactInfo.email.trim() ? "email" : null,
    !contactInfo.company.trim() ? "company" : null,
  ].filter((m): m is string => m !== null)

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
        <main id="main-content" className="py-24 px-6 text-center">
          <div role="status">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-[#6abf4b]/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-[#6abf4b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-montserrat font-bold text-3xl text-[#1a1a1a] mb-4">{successHeading}</h1>
            <p className="text-[#666] mb-8 font-visby">
              {successBody}
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
        </main>
        <Footer />
      </div>
    )
  }

  // focus ring on top of the border-colour swap: a 1px border change alone
  // is an invisible focus indicator on these light inputs.
  const inputClass = "w-full bg-[#f9f9f9] border border-[#e5e5e5] text-[#1a1a1a] px-4 py-3 rounded text-sm font-visby focus:border-[#ef473f] focus:outline-none focus:ring-2 focus:ring-[#ef473f]/25 transition-colors"
  const selectClass = "w-full bg-[#f9f9f9] border border-[#e5e5e5] text-[#1a1a1a] px-4 py-3 rounded text-sm font-visby focus:border-[#ef473f] focus:outline-none focus:ring-2 focus:ring-[#ef473f]/25"
  const labelClass = "block text-xs font-bold tracking-wider text-[#6b6b6b] uppercase mb-2"

  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#1a1a1a]">
      <Header />

      <main id="main-content" className="py-12 px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Page Header */}
          <div className="mb-10">
            <p className="text-xs font-bold tracking-wider text-[#ef473f] uppercase mb-2">
              {pageEyebrow}
            </p>
            <h1 className="font-montserrat font-bold text-3xl lg:text-4xl text-[#1a1a1a]">
              {pageHeading}
            </h1>
            <p className="text-[#666] mt-2 font-visby">
              {pageSubheading}
            </p>
          </div>

          {/* Tabs — scrollable strip on phones: the three uppercase labels
              total ~460px and forced page-level horizontal scroll. */}
          <div role="tablist" aria-label="Quote builder steps" className="flex gap-1 sm:gap-2 mb-8 border-b border-[#e5e5e5] overflow-x-auto">
            {[
              { id: "items", label: "Products", count: items.length },
              { id: "contact", label: "Contact Info" },
              { id: "project", label: "Project Details" },
            ].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-3 sm:px-6 py-3 font-bold text-xs sm:text-sm uppercase tracking-wider transition-colors relative whitespace-nowrap flex-shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef473f] ${
                  activeTab === tab.id
                    ? "text-[#1a1a1a]" 
                    : "text-[#6b6b6b] hover:text-[#1a1a1a]"
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
            <div role="tabpanel" id="panel-items" aria-labelledby="tab-items">
              {items.length === 0 && !showAddProduct ? (
                <div className="bg-white border border-[#e5e5e5] rounded-lg p-12 text-center shadow-sm">
                  <ShoppingBag className="w-16 h-16 text-[#ccc] mx-auto mb-4" />
                  <h2 className="font-montserrat font-bold text-xl text-[#1a1a1a] mb-2">Your Quote is Empty</h2>
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
                      // flex-wrap: on narrow phones the qty/remove cluster
                      // drops to its own right-aligned row instead of
                      // crushing the product name to nothing.
                      <div key={item.id} className="bg-white border border-[#e5e5e5] rounded-lg p-4 flex flex-wrap items-center gap-4 shadow-sm">
                        <div className="w-20 h-20 bg-[#f0f0f0] rounded overflow-hidden flex-shrink-0">
                          {item.image && (
                            <SafeImage src={item.image} alt="" width={80} height={80} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-[10rem]">
                          <h3 className="font-bold text-sm uppercase tracking-wide mb-1 text-[#1a1a1a]">{item.productName}</h3>
                          <p className="text-xs text-[#6b6b6b] mb-2 font-visby">SKU: {item.productSku}</p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="bg-[#f0f0f0] text-[#666] px-2 py-1 rounded">{item.colour}</span>
                            <span className="bg-[#f0f0f0] text-[#666] px-2 py-1 rounded">{item.size}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <button onClick={() => updateItem(item.id, { quantity: clampQuantity(item.quantity - 1) })} aria-label={`Decrease quantity of ${item.productName}`} className="w-9 h-9 flex items-center justify-center border border-[#e5e5e5] rounded hover:border-[#ef473f] transition-colors">
                            <Minus className="w-3 h-3" aria-hidden="true" />
                          </button>
                          <span className="w-12 text-center font-bold">{item.quantity}</span>
                          <button onClick={() => updateItem(item.id, { quantity: clampQuantity(item.quantity + 1) })} aria-label={`Increase quantity of ${item.productName}`} className="w-9 h-9 flex items-center justify-center border border-[#e5e5e5] rounded hover:border-[#ef473f] transition-colors">
                            <Plus className="w-3 h-3" aria-hidden="true" />
                          </button>
                          <button onClick={() => removeItem(item.id)} aria-label={`Remove ${item.productName} from quote`} className="p-2 text-[#8a8a8a] hover:text-[#ef473f] transition-colors">
                            <Trash2 className="w-5 h-5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {showAddProduct && (
                    <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 mb-6 shadow-sm">
                      <h2 className="font-montserrat font-bold text-lg text-[#1a1a1a] mb-4">Add Product</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label htmlFor="add-product" className={labelClass}>Product</label>
                          <select id="add-product" value={selectedProduct} onChange={(e) => { setSelectedProduct(e.target.value); setSelectedColour(""); setSelectedSize("") }} className={selectClass}>
                            <option value="">{products.length === 0 ? "No products available yet" : "Select a product"}</option>
                            {products.map((p) => (<option key={p.sku} value={p.sku}>{p.name}</option>))}
                          </select>
                          {products.length === 0 && (
                            <p className="text-xs text-[#6b6b6b] mt-2 font-visby">
                              The {t("catalog")} is being stocked — use the notes on the Project Details tab to describe what you need.
                            </p>
                          )}
                        </div>
                        {activeProduct && (
                          <>
                            <div>
                              <label htmlFor="add-colour" className={labelClass}>{t("Color")}</label>
                              <select id="add-colour" value={selectedColour} onChange={(e) => setSelectedColour(e.target.value)} className={selectClass}>
                                <option value="">Select {t("color")}</option>
                                {activeProduct.colours.map((c) => (<option key={c.name} value={c.name}>{c.name}</option>))}
                              </select>
                            </div>
                            <div>
                              <label htmlFor="add-size" className={labelClass}>Size</label>
                              <select id="add-size" value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} className={selectClass}>
                                <option value="">Select size</option>
                                {activeProduct.sizes.map((s) => (<option key={s} value={s}>{s}</option>))}
                              </select>
                            </div>
                            <div>
                              <label htmlFor="add-quantity" className={labelClass}>Quantity</label>
                              <input id="add-quantity" type="number" min="1" max={MAX_ITEM_QUANTITY} value={quantity} onChange={(e) => setQuantity(clampQuantity(e.target.value))} className={inputClass} />
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
            <div role="tabpanel" id="panel-contact" aria-labelledby="tab-contact" className="bg-white border border-[#e5e5e5] rounded-lg p-6 lg:p-8 shadow-sm">
              <h2 className="font-montserrat font-bold text-xl text-[#1a1a1a] mb-4">Your Contact Information</h2>
              <p className="text-[#666] text-sm mb-6 font-visby">
                Signed-in users can auto-fill this information. <Link href="/sign-in" className="text-[#d93e36] underline hover:no-underline">Sign in</Link> to save time.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div><label htmlFor="quote-first-name" className={labelClass}>First Name *</label><input id="quote-first-name" type="text" autoComplete="given-name" maxLength={100} required value={contactInfo.firstName} onChange={(e) => setContactInfo({ firstName: e.target.value })} className={inputClass} placeholder="John" /></div>
                <div><label htmlFor="quote-last-name" className={labelClass}>Last Name *</label><input id="quote-last-name" type="text" autoComplete="family-name" maxLength={100} required value={contactInfo.lastName} onChange={(e) => setContactInfo({ lastName: e.target.value })} className={inputClass} placeholder="Doe" /></div>
                <div><label htmlFor="quote-email" className={labelClass}>Email *</label><input id="quote-email" type="email" autoComplete="email" maxLength={254} required value={contactInfo.email} onChange={(e) => setContactInfo({ email: e.target.value })} className={inputClass} placeholder="john@company.com" /></div>
                <div><label htmlFor="quote-phone" className={labelClass}>Phone</label><input id="quote-phone" type="tel" autoComplete="tel" maxLength={50} value={contactInfo.phone} onChange={(e) => setContactInfo({ phone: e.target.value })} className={inputClass} placeholder="(555) 123-4567" /></div>
                <div><label htmlFor="quote-company" className={labelClass}>Company *</label><input id="quote-company" type="text" autoComplete="organization" maxLength={200} required value={contactInfo.company} onChange={(e) => setContactInfo({ company: e.target.value })} className={inputClass} placeholder="Acme Corp" /></div>
                <div><label htmlFor="quote-job-title" className={labelClass}>Job Title</label><input id="quote-job-title" type="text" autoComplete="organization-title" maxLength={100} value={contactInfo.jobTitle} onChange={(e) => setContactInfo({ jobTitle: e.target.value })} className={inputClass} placeholder="Marketing Manager" /></div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setActiveTab("items")} className="border border-[#e5e5e5] text-[#1a1a1a] px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:border-[#ef473f] transition-colors">Back</button>
                <button onClick={() => setActiveTab("project")} className="ml-auto inline-flex items-center gap-2 bg-[#ef473f] text-white px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity">Continue <ArrowRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {/* Project Tab */}
          {activeTab === "project" && (
            <form role="tabpanel" id="panel-project" aria-labelledby="tab-project" onSubmit={handleSubmitQuote} className="bg-white border border-[#e5e5e5] rounded-lg p-6 lg:p-8 shadow-sm">
              <HoneypotField id="quote-hp-check" value={hpCheck} onChange={setHpCheck} />
              <h2 className="font-montserrat font-bold text-xl text-[#1a1a1a] mb-6">Project Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div><label htmlFor="project-event" className={labelClass}>Event / Project Name</label><input id="project-event" type="text" maxLength={200} value={projectInfo.eventName} onChange={(e) => setProjectInfo({ eventName: e.target.value })} className={inputClass} placeholder="Annual Conference 2026" /></div>
                <div><label htmlFor="project-date" className={labelClass}>In-Hands Date</label><input id="project-date" type="date" value={projectInfo.eventDate} onChange={(e) => setProjectInfo({ eventDate: e.target.value })} className={inputClass} /></div>
                <div className="md:col-span-2">
                  <label htmlFor="project-budget" className={labelClass}>Budget Range</label>
                  <select id="project-budget" value={projectInfo.budget} onChange={(e) => setProjectInfo({ budget: e.target.value })} className={selectClass}>
                    <option value="">Select budget range</option>
                    <option value="under-1000">Under $1,000</option>
                    <option value="1000-5000">$1,000 - $5,000</option>
                    <option value="5000-10000">$5,000 - $10,000</option>
                    <option value="10000-25000">$10,000 - $25,000</option>
                    <option value="25000-plus">$25,000+</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="project-notes" className={labelClass}>Additional Notes</label>
                  {/* The serialized cart shares the action's 16,000-char message
                      cap with these notes — 4,000 leaves generous headroom so a
                      long note can never make the submission bounce. */}
                  <textarea id="project-notes" rows={4} maxLength={4000} value={projectInfo.notes} onChange={(e) => setProjectInfo({ notes: e.target.value })} className={`${inputClass} resize-none`} placeholder="Tell us about your project, branding requirements, or any questions..." />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-[#f9f9f9] border border-[#e5e5e5] rounded-lg p-4 mb-6">
                <h3 className="font-montserrat font-bold text-base text-[#1a1a1a] mb-3">Quote Summary</h3>
                <div className="space-y-2 text-sm font-visby">
                  <div className="flex justify-between"><span className="text-[#6b6b6b]">Products:</span><span className="text-[#1a1a1a]">{items.length} item{items.length !== 1 ? "s" : ""}</span></div>
                  <div className="flex justify-between"><span className="text-[#6b6b6b]">Total Units:</span><span className="text-[#1a1a1a]">{items.reduce((sum, item) => sum + item.quantity, 0)}</span></div>
                  <div className="flex justify-between"><span className="text-[#6b6b6b]">Contact:</span><span className="text-[#1a1a1a]">{contactInfo.firstName} {contactInfo.lastName}</span></div>
                  <div className="flex justify-between"><span className="text-[#6b6b6b]">Company:</span><span className="text-[#1a1a1a]">{contactInfo.company || "Not specified"}</span></div>
                </div>
              </div>

              {submitError && (
                <div className="mb-4 p-3 bg-[#ef473f]/10 border border-[#ef473f]/30 rounded text-[#d93e36] text-sm" role="alert">
                  {submitError}
                </div>
              )}
              {missingRequirements.length > 0 && (
                <p className="mb-4 text-sm text-[#6b6b6b] font-visby">
                  To submit, please add: {missingRequirements.join(", ")}.
                </p>
              )}
              <div className="flex gap-4">
                <button type="button" onClick={() => setActiveTab("contact")} disabled={submitting} className="border border-[#e5e5e5] text-[#1a1a1a] px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:border-[#ef473f] transition-colors disabled:opacity-50">Back</button>
                <button type="submit" disabled={submitting || missingRequirements.length > 0} className="ml-auto inline-flex items-center gap-2 bg-[#ef473f] text-white px-8 py-3 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? "Submitting..." : <>Submit Quote Request <ArrowRight className="w-4 h-4" aria-hidden="true" /></>}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
