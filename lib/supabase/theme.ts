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
 * lookup target for the runtime CSS override below.
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

// ---------------------------------------------------------------------------
// CSS override generator
//
// The public site uses Tailwind arbitrary-value classes like
// `text-[#ef473f]`, `bg-[#ef473f]/20`, `hover:border-[#ef473f]`, etc.
// When the admin picks a new colour we need to override every one of
// those generated CSS rules without editing source files.
//
// We do that by emitting CSS rules that target the EXACT escaped class
// selectors Tailwind produces and applying `!important` so the override
// always wins. Naïve attribute-contains selectors (e.g. `[class*="bg-[#ef473f]"]`)
// look simpler but they accidentally match `hover:bg-[#ef473f]` and the
// opacity-modifier classes too, which would force-paint elements in
// their hover state at load time.
// ---------------------------------------------------------------------------

const ORIGINAL_HEX: Record<string, string> = {
  "brand.primary": "#ef473f",
  "brand.dark": "#111111",
  "brand.slate": "#373a36",
  "brand.accent": "#bde7ff",
}

/**
 * Tailwind utility prefixes that take an arbitrary colour and the CSS
 * property each one writes to. Properties marked with a `--*` value are
 * actually CSS custom properties Tailwind uses internally (gradient
 * stops, ring colour).
 */
const PROPS: Array<{ tw: string; css: string }> = [
  { tw: "text", css: "color" },
  { tw: "bg", css: "background-color" },
  { tw: "border", css: "border-color" },
  { tw: "ring", css: "--tw-ring-color" },
  { tw: "from", css: "--tw-gradient-from" },
  { tw: "to", css: "--tw-gradient-to" },
  { tw: "decoration", css: "text-decoration-color" },
  { tw: "placeholder", css: "color" },
]

/**
 * Tailwind state variants that wrap the utility. The selector builder
 * turns the bare class name into the full selector Tailwind generates
 * (e.g. `hover:` → `.hover\:bg-…:hover`, `group-hover:` →
 * `.group:hover .group-hover\:bg-…`).
 */
interface Variant {
  twPrefix: string
  buildSelector: (escapedClass: string) => string
}

const VARIANTS: Variant[] = [
  { twPrefix: "", buildSelector: (c) => `.${c}` },
  { twPrefix: "hover:", buildSelector: (c) => `.${c}:hover` },
  { twPrefix: "focus:", buildSelector: (c) => `.${c}:focus` },
  { twPrefix: "focus-visible:", buildSelector: (c) => `.${c}:focus-visible` },
  { twPrefix: "active:", buildSelector: (c) => `.${c}:active` },
  { twPrefix: "group-hover:", buildSelector: (c) => `.group:hover .${c}` },
  { twPrefix: "group-focus:", buildSelector: (c) => `.group:focus .${c}` },
]

const OPACITIES = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90]

/**
 * Escapes characters that are syntactically significant in a CSS class
 * selector. Tailwind escapes the same set when it emits class names.
 *   bg-[#ef473f]   →  bg-\[\#ef473f\]
 *   bg-[#ef473f]/20→  bg-\[\#ef473f\]\/20
 */
function escapeClassSelector(input: string): string {
  return input.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, (m) => `\\${m}`)
}

/**
 * Builds the CSS-Custom-Property fallback values exposed at :root.
 * Components can opt in via `var(--brand-primary)` etc. without going
 * through the class-override path.
 */
function rootVars(map: SiteThemeMap): string {
  const vars = Object.keys(ORIGINAL_HEX)
    .map((key) => {
      const cssVar = `--${key.replace(/\./g, "-")}`
      const value = map[key]?.value ?? ORIGINAL_HEX[key]
      return `  ${cssVar}: ${value};`
    })
    .join("\n")
  return `:root {\n${vars}\n}`
}

/**
 * Generates CSS that overrides Tailwind's arbitrary-colour utilities
 * for every brand colour the admin has changed. Returns the empty
 * string (well, just :root vars) when no overrides are needed.
 */
export function themeOverrideCss(map: SiteThemeMap): string {
  const lines: string[] = [rootVars(map)]

  for (const [key, originalHex] of Object.entries(ORIGINAL_HEX)) {
    const next = map[key]?.value
    if (!next || next.toLowerCase() === originalHex.toLowerCase()) continue

    for (const variant of VARIANTS) {
      for (const { tw, css } of PROPS) {
        // Base utility — no opacity modifier.
        const baseClass = `${variant.twPrefix}${tw}-[${originalHex}]`
        const baseEscaped = escapeClassSelector(baseClass)
        const baseSelector = variant.buildSelector(baseEscaped)
        // placeholder uses a ::placeholder pseudo on top of the variant.
        const suffix = tw === "placeholder" ? "::placeholder" : ""
        lines.push(`${baseSelector}${suffix} { ${css}: ${next} !important; }`)

        // Opacity modifier variants — `bg-[#ef473f]/20`, etc.
        for (const op of OPACITIES) {
          const opClass = `${variant.twPrefix}${tw}-[${originalHex}]/${op}`
          const opEscaped = escapeClassSelector(opClass)
          const opSelector = variant.buildSelector(opEscaped)
          const blended = `color-mix(in srgb, ${next} ${op}%, transparent)`
          lines.push(`${opSelector}${suffix} { ${css}: ${blended} !important; }`)
        }
      }
    }
  }

  return lines.join("\n")
}
