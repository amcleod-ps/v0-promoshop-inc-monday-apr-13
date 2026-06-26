import type { Locale } from "@/lib/cms/locale"

/**
 * Product filter tags — the team-managed, "forgiving" tagging behind the
 * US/Canada toggle (Priority 3).
 *
 * "Forgiving" means: a tag is normalized to a single canonical form so that
 * casing, surrounding/internal whitespace, and unicode width differences can't
 * spawn messy duplicates ("Canada", "  canada ", "CANADA" → "canada"). It is
 * deliberately NOT fuzzy spell-correction — merging "canda" into "canada" would
 * risk collapsing genuinely distinct tags. Display chips title-case the
 * canonical form back for humans.
 *
 * Pure module — safe on server and client.
 */

/** Collapse to a canonical lowercase form: NFKC, trim, single-space runs. */
export function normalizeTag(raw: string): string {
  return raw.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
}

/** Title-case a normalized tag for display in filter chips ("usa" → "Usa"). */
export function displayTag(tag: string): string {
  return tag.replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Per-tag character cap, applied before normalization rejects nothing. */
export const MAX_TAG_LEN = 40
/** Per-product tag-count cap. */
export const MAX_TAGS_PER_PRODUCT = 20

/**
 * Normalize a raw tag list: drop empties/over-long entries, dedupe by canonical
 * form (first spelling wins), and cap the count — preserving input order.
 */
export function normalizeTagList(raw: string[], max = MAX_TAGS_PER_PRODUCT): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of raw) {
    if (typeof r !== "string") continue
    const t = normalizeTag(r)
    if (!t || t.length > MAX_TAG_LEN || seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= max) break
  }
  return out
}

/** Parse a free-text tag field (comma- or newline-separated) into canonical tags. */
export function parseTagInput(value: string): string[] {
  return normalizeTagList(value.split(/[,\n]/))
}

/**
 * The two region tags the US/Canada toggle keys off. Seeded as the team's
 * starting tags; they are ordinary tags, so the team can add more freely.
 */
export const REGION_TAGS: Record<Locale, string> = {
  CAN: "canada",
  USA: "usa",
}

export const ALL_REGION_TAGS: string[] = Object.values(REGION_TAGS)

export function regionTagForLocale(locale: Locale): string {
  return REGION_TAGS[locale]
}

/** True when the catalog has any region tag worth prioritizing by. */
export function hasAnyRegionTag(tagLists: Array<string[] | undefined>): boolean {
  return tagLists.some((tags) => tags?.some((t) => ALL_REGION_TAGS.includes(t)))
}
