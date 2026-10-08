"use client"

import type { ProductSortOrder } from "@/lib/pricing/catalog-sort"

export function ProductSort({
  value,
  onChange,
  pricingEnabled,
  tone = "light",
}: {
  value: ProductSortOrder
  onChange: (value: ProductSortOrder) => void
  pricingEnabled: boolean
  tone?: "light" | "dark"
}) {
  if (!pricingEnabled) return null
  const dark = tone === "dark"
  return (
    <div className={`mb-5 ${dark ? "text-white" : "text-[#373a36]"}`}>
      <label className="flex flex-wrap items-center gap-3 text-sm font-semibold">
        <span>Sort products</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value === "price-asc" ? "price-asc" : "recommended")}
          className={`min-h-11 max-w-full rounded-md border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8322c] focus-visible:ring-offset-2 ${dark ? "border-[#888] bg-[#222] text-white focus-visible:ring-offset-[#111111]" : "border-[#888] bg-white text-[#373a36] focus-visible:ring-offset-[#ededed]"}`}
        >
          <option value="recommended">Recommended</option>
          <option value="price-asc">Price: low to high</option>
        </select>
      </label>
      {value === "price-asc" && (
        <p className={`mt-2 text-sm ${dark ? "text-[#bbb]" : "text-[#555]"}`} role="status">
          The sort uses the price at the smallest listed quantity. Prices stay in CAD or USD. Products without prices are last.
        </p>
      )}
    </div>
  )
}
