import { createClient } from "./server"

export interface SiteThemeRow {
  key: string
  label: string
  value: string
  updatedAt: string
}

export type SiteThemeMap = Record<string, SiteThemeRow>

/**
 * Default palette baked into the public site. Used as a fallback when
 * the `site_theme` table is unreachable, missing, or empty, and as the
 * lookup target for the runtime CSS override: every Tailwind utility
 * class that hard-codes one of these hexes (e.g. `text-[#ef473f]`,
 * `bg-[#111111]`) gets swapped to the admin's current value via
 * `themeOverrideCss` below.
 */
export const DEFAULT_THEME: SiteThemeMap = {
  "brand.primary": {
    key: "brand.primary",
    label: "Brand accent (red) — CTAs, eyebrows, hover states",
    value: "#ef473f",
    updatedAt: "",
  },
  "brand.dark": {
    key: "brand.dark",
    label: "Dark background — homepage, header utility bar",
    value: "#111111",
    updatedAt: "",
  },
  "brand.slate": {
    key: "brand.slate",
    label: "Slate — header utility bar / muted UI",
    value: "#373a36",
    updatedAt: "",
  },
  "brand.accent": {
    key: "brand.accent",
    label: "Soft accent (sky blue) — footer separator",
    value: "#bde7ff",
    updatedAt: "",
  },
}

export async function getSiteThemeMap(): Promise<SiteThemeMap> {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    return DEFAULT_THEME
  }
  const { data, error } = await supabase
    .from("site_theme")
    .select("key, label, value, updated_at")

  if (error || !data || data.length === 0) return DEFAULT_THEME

  const map: SiteThemeMap = { ...DEFAULT_THEME }
  for (const row of data) {
    map[row.key] = {
      key: row.key,
      label: row.label,
      value: row.value,
      updatedAt: row.updated_at,
    }
  }
  return map
}

const ORIGINAL_HEX: Record<string, string> = {
  "brand.primary": "#ef473f",
  "brand.dark": "#111111",
  "brand.slate": "#373a36",
  "brand.accent": "#bde7ff",
}

/**
 * Escapes a hex code so it matches the Tailwind-generated class name.
 *   #ef473f → \#ef473f (CSS escape for the `#` character)
 */
function escapeForCssSelector(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`)
}

/**
 * Builds the CSS that overrides every Tailwind arbitrary utility class
 * baking in one of the four default brand hexes. The selectors include
 * a trailing `\\/digit` form for opacity-modifier variants (e.g.
 * `bg-[#ef473f]/20`) so those track the new colour too.
 *
 * Components using `text-[#ef473f]` keep their literal Tailwind class —
 * we just shadow the generated CSS rule with an `!important` override
 * at the end of the stylesheet so the admin's choice wins. When the
 * admin's value equals the original, no override is emitted.
 */
export function themeOverrideCss(map: SiteThemeMap): string {
  const lines: string[] = []
  for (const [key, originalHex] of Object.entries(ORIGINAL_HEX)) {
    const next = map[key]?.value
    if (!next || next.toLowerCase() === originalHex.toLowerCase()) continue
    const esc = escapeForCssSelector(originalHex)
    // Tailwind v4 emits arbitrary classes like `.bg-\[\#ef473f\]`. We use
    // the `*=` attribute-contains selector so opacity modifiers
    // (`bg-[#ef473f]/20`) and inset variants stay covered too. The
    // attribute name we look for ends with the bracketed colour token
    // so unrelated utility classes don't get hit.
    lines.push(`[class*="text-[${originalHex}]"] { color: ${next} !important; }`)
    lines.push(`[class*="bg-[${originalHex}]"] { background-color: ${next} !important; }`)
    lines.push(`[class*="border-[${originalHex}]"] { border-color: ${next} !important; }`)
    lines.push(`[class*="ring-[${originalHex}]"] { --tw-ring-color: ${next} !important; }`)
    lines.push(`[class*="from-[${originalHex}]"] { --tw-gradient-from: ${next} !important; }`)
    lines.push(`[class*="to-[${originalHex}]"] { --tw-gradient-to: ${next} !important; }`)
    // Silence the escape-function lint — `esc` is intentionally precomputed
    // for future use if we move to escaped class selectors instead of *=.
    void esc
  }
  // Always publish the CSS variables so consumers that opt in via
  // var(--brand-primary) etc. pick up the latest values too.
  const vars = Object.entries(ORIGINAL_HEX)
    .map(([key]) => {
      const cssVar = `--${key.replace(/\./g, "-")}`
      const value = map[key]?.value ?? ORIGINAL_HEX[key]
      return `  ${cssVar}: ${value};`
    })
    .join("\n")
  lines.unshift(`:root {\n${vars}\n}`)
  return lines.join("\n")
}
