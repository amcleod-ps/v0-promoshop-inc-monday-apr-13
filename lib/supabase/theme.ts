import { cache } from "react"
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

export const getSiteThemeMap = cache(async (): Promise<SiteThemeMap> => {
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
})

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
 * Hard-coded companion shades used alongside a brand colour in source
 * classes (e.g. the darker red used for CTA hover states and link text).
 * When the parent colour is rebranded these classes are overridden with a
 * `color-mix()` derivation so the shade tracks the new colour.
 *
 * `uses` lists the exact variant×property combos present in source (grep
 * the hex when adding one) — emitting the full variant×prop×opacity matrix
 * for a companion would roughly double the inlined override CSS on every
 * response for rules that can never match.
 */
interface CompanionShade {
  hex: string
  derive: (next: string) => string
  uses: Array<{ variant: string; prop: string }>
}

const COMPANION_SHADES: Record<string, CompanionShade[]> = {
  "brand.primary": [
    {
      // #d93e36 — darkened brand red: CTA hover backgrounds + link text.
      hex: "#d93e36",
      derive: (next) => `color-mix(in srgb, ${next} 85%, black)`,
      uses: [
        { variant: "", prop: "text" },
        { variant: "hover:", prop: "text" },
        { variant: "hover:", prop: "bg" },
      ],
    },
  ],
}

/**
 * The admin theme editor validates colours before writing, but the
 * documented Supabase Table Editor path does not. Values are injected
 * into a <style> tag in the layout, so anything that is not a plain
 * hex colour is discarded (CSS/HTML injection guard, not just hygiene).
 */
const SAFE_HEX = /^#[0-9a-fA-F]{3,8}$/

function safeThemeValue(map: SiteThemeMap, key: string): string | null {
  const value = map[key]?.value?.trim()
  if (!value || !SAFE_HEX.test(value)) return null
  return value
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
  /** Wrap the emitted rule in `@media (hover: hover)` like Tailwind v4 does. */
  hoverGated?: boolean
}

const VARIANTS: Variant[] = [
  { twPrefix: "", buildSelector: (c) => `.${c}` },
  // Tailwind v4 wraps hover/group-hover rules in `@media (hover: hover)`;
  // the overrides must match or touch devices get tap-sticky hover colours.
  { twPrefix: "hover:", buildSelector: (c) => `.${c}:hover`, hoverGated: true },
  { twPrefix: "focus:", buildSelector: (c) => `.${c}:focus` },
  { twPrefix: "focus-visible:", buildSelector: (c) => `.${c}:focus-visible` },
  { twPrefix: "active:", buildSelector: (c) => `.${c}:active` },
  { twPrefix: "group-hover:", buildSelector: (c) => `.group:hover .${c}`, hoverGated: true },
  { twPrefix: "group-focus:", buildSelector: (c) => `.group:focus .${c}` },
]

// The opacity modifiers actually used on brand-colour classes in source
// (e.g. `bg-[#ef473f]/20`, `ring-[#ef473f]/35`). Keep this in sync with the
// codebase: a modifier that's used but missing here means that variant keeps
// the original colour after an admin rebrand (the contact form's `/35` focus
// rings were silently doing exactly that), and a modifier listed but unused
// just inflates the `!important` CSS inlined on every response.
//   grep -roE '\[#[0-9a-fA-F]{3,8}\]/[0-9]+' app components lib
const OPACITIES = [5, 10, 20, 25, 30, 35, 60]

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
      const value = safeThemeValue(map, key) ?? ORIGINAL_HEX[key]
      return `  ${cssVar}: ${value};`
    })
    .join("\n")
  return `:root {\n${vars}\n}`
}

/**
 * The shadcn semantic tokens in globals.css (`--primary`, `--accent`,
 * `--ring`) are hard-coded to the original brand red; `--ring` drives the
 * global `outline-ring/50` focus style. Re-point them when the admin
 * changes brand.primary so focus outlines (and any future primitive usage)
 * follow the rebrand. `--destructive` is deliberately left alone — "error
 * colour == brand colour" is only true of the default red, and a rebrand
 * to e.g. blue must not turn error affordances blue.
 */
function semanticTokenOverride(map: SiteThemeMap): string | null {
  const next = safeThemeValue(map, "brand.primary")
  if (!next || next.toLowerCase() === ORIGINAL_HEX["brand.primary"]) return null
  return `:root {\n  --primary: ${next};\n  --accent: ${next};\n  --ring: ${next};\n}`
}

/**
 * Generates CSS that overrides Tailwind's arbitrary-colour utilities
 * for every brand colour the admin has changed. Returns the empty
 * string (well, just :root vars) when no overrides are needed.
 */
export function themeOverrideCss(map: SiteThemeMap): string {
  const lines: string[] = [rootVars(map)]
  const semanticTokens = semanticTokenOverride(map)
  if (semanticTokens) lines.push(semanticTokens)

  for (const [key, originalHex] of Object.entries(ORIGINAL_HEX)) {
    const next = safeThemeValue(map, key)
    if (!next || next.toLowerCase() === originalHex.toLowerCase()) continue

    const emit = (variant: Variant, selector: string, declaration: string) => {
      const rule = `${selector} { ${declaration} }`
      lines.push(variant.hoverGated ? `@media (hover: hover) { ${rule} }` : rule)
    }

    // Full matrix for the brand colour itself — any variant/opacity combo
    // in source must be covered.
    for (const variant of VARIANTS) {
      for (const { tw, css } of PROPS) {
        // Base utility — no opacity modifier.
        const baseClass = `${variant.twPrefix}${tw}-[${originalHex}]`
        const baseEscaped = escapeClassSelector(baseClass)
        const baseSelector = variant.buildSelector(baseEscaped)
        emit(variant, baseSelector, `${css}: ${next} !important;`)

        // Opacity modifier variants — `bg-[#ef473f]/20`, etc.
        for (const op of OPACITIES) {
          const opClass = `${variant.twPrefix}${tw}-[${originalHex}]/${op}`
          const opEscaped = escapeClassSelector(opClass)
          const opSelector = variant.buildSelector(opEscaped)
          const blended = `color-mix(in srgb, ${next} ${op}%, transparent)`
          emit(variant, opSelector, `${css}: ${blended} !important;`)
        }
      }
    }

    // Companion shades emit only the combos that actually exist in source.
    for (const shade of COMPANION_SHADES[key] ?? []) {
      const value = shade.derive(next)
      for (const use of shade.uses) {
        const variant = VARIANTS.find((v) => v.twPrefix === use.variant)
        const prop = PROPS.find((p) => p.tw === use.prop)
        if (!variant || !prop) continue
        const cls = `${variant.twPrefix}${prop.tw}-[${shade.hex}]`
        const selector = variant.buildSelector(escapeClassSelector(cls))
        emit(variant, selector, `${prop.css}: ${value} !important;`)
      }
    }
  }

  return lines.join("\n")
}
