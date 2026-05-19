"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "site-images"

export type ReplaceTarget =
  | "site_images"
  | "brand"
  | "hero_slide"
  | "product_image"

interface SuccessResult {
  ok: true
  url: string
}
interface ErrorResult {
  ok: false
  error: string
}
export type ReplaceResult = SuccessResult | ErrorResult

interface SimpleSuccess {
  ok: true
}
export type SimpleResult = SimpleSuccess | ErrorResult

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

function bumpCaches() {
  // Tell Next.js to rebuild every cached page so changes are visible
  // immediately on the live site, not just the dashboard.
  revalidatePath("/", "layout")
  revalidatePath("/admin-dashboard")
}

/**
 * Replaces an image on the website. Steps:
 *   1. Validate inputs (allowlisted target, file present, under 10 MB).
 *   2. Upload the file to the `site-images` Storage bucket under a unique
 *      path that includes a timestamp.
 *   3. Update the database row that referenced the old URL. The new public
 *      URL is what the site renders on the next page load.
 *
 * Cache-busting is automatic because the file path is unique per upload
 * AND the row's `updated_at` changes, so the site's `?v=<updated_at>` query
 * string also changes.
 */
export async function replaceImage(
  target: ReplaceTarget,
  id: string,
  formData: FormData,
): Promise<ReplaceResult> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please pick a file before clicking Replace." }
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_BYTES / 1024 / 1024} MB.`,
    }
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: `Not an image file (got ${file.type || "unknown"}).` }
  }
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Missing row identifier." }
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Server is not configured.",
    }
  }

  const safeId = id.replace(/[^a-z0-9._-]/gi, "_").slice(0, 80)
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "")
  const storagePath = `${target}/${safeId}-${Date.now()}.${ext}`

  const buffer = await file.arrayBuffer()
  const upload = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (upload.error) {
    return { ok: false, error: `Upload failed: ${upload.error.message}` }
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(upload.data.path)
  const url = pub.publicUrl

  const writeErr = await writeImageUrl(target, id, url)
  if (writeErr) return { ok: false, error: `Database update failed: ${writeErr}` }

  bumpCaches()
  return { ok: true, url }
}

/**
 * "Removes" an image from the website by clearing its URL on the
 * referencing row. For product images, which represent a specific gallery
 * tile, the row itself is deleted so the gallery shrinks. The previously
 * uploaded file stays in Supabase Storage so it can be re-attached from
 * the Supabase Dashboard if removal was a mistake.
 */
export async function removeImage(
  target: ReplaceTarget,
  id: string,
): Promise<SimpleResult> {
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Missing row identifier." }
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Server is not configured.",
    }
  }

  let dbError: string | null = null
  switch (target) {
    case "site_images": {
      const { error } = await supabase
        .from("site_images")
        .update({ url: "" })
        .eq("key", id)
      if (error) dbError = error.message
      break
    }
    case "brand": {
      // Mirror the replaceImage flow: clear both the canonical brand row
      // AND the legacy site_images override so neither shadows the other.
      const { error: e1 } = await supabase
        .from("brands")
        .update({ logo_url: null })
        .eq("slug", id)
      if (e1) {
        dbError = e1.message
        break
      }
      await supabase
        .from("site_images")
        .update({ url: "" })
        .eq("key", `brand.${id}.logo`)
      break
    }
    case "hero_slide": {
      const { error } = await supabase
        .from("hero_slides")
        .update({ image_url: null })
        .eq("id", id)
      if (error) dbError = error.message
      break
    }
    case "product_image": {
      const { error } = await supabase
        .from("product_images")
        .delete()
        .eq("id", id)
      if (error) dbError = error.message
      break
    }
    default: {
      return { ok: false, error: `Unknown target: ${String(target)}` }
    }
  }

  if (dbError) return { ok: false, error: `Database update failed: ${dbError}` }

  bumpCaches()
  return { ok: true }
}

async function writeImageUrl(
  target: ReplaceTarget,
  id: string,
  url: string,
): Promise<string | null> {
  const supabase = createAdminClient()
  switch (target) {
    case "site_images": {
      const { error } = await supabase
        .from("site_images")
        .update({ url })
        .eq("key", id)
      return error?.message ?? null
    }
    case "brand": {
      // Brand logos are referenced from TWO places at render time:
      //   * brands.logo_url            (canonical column)
      //   * site_images."brand.X.logo" (legacy override slot the site
      //                                 still checks first via useImageSrc)
      // Both must point at the new file or the override shadows the
      // canonical column and the site keeps rendering the old logo.
      const { error: e1 } = await supabase
        .from("brands")
        .update({ logo_url: url })
        .eq("slug", id)
      if (e1) return e1.message
      await supabase
        .from("site_images")
        .update({ url })
        .eq("key", `brand.${id}.logo`)
      return null
    }
    case "hero_slide": {
      const { error } = await supabase
        .from("hero_slides")
        .update({ image_url: url })
        .eq("id", id)
      return error?.message ?? null
    }
    case "product_image": {
      const { error } = await supabase
        .from("product_images")
        .update({ url })
        .eq("id", id)
      return error?.message ?? null
    }
    default:
      return `Unknown target: ${String(target)}`
  }
}

const MAX_TEXT_LEN = 5000

/**
 * Upserts a row in `site_content` with a new value. The site_content
 * table backs every editable headline, paragraph, label, and CTA on the
 * public site that isn't already a column on another table.
 */
export async function updateSiteContent(
  key: string,
  label: string,
  value: string,
): Promise<SimpleResult> {
  if (!key) return { ok: false, error: "Missing content key." }
  if (typeof value !== "string") return { ok: false, error: "Value must be text." }
  if (value.length > MAX_TEXT_LEN) {
    return { ok: false, error: `Text too long. Limit is ${MAX_TEXT_LEN} characters.` }
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Server is not configured.",
    }
  }

  const { error } = await supabase
    .from("site_content")
    .upsert({ key, label, value }, { onConflict: "key" })

  if (error) return { ok: false, error: `Database update failed: ${error.message}` }

  bumpCaches()
  return { ok: true }
}

export type HeroSlideField = "title" | "subtitle" | "cta_text" | "cta_url"

const HERO_SLIDE_FIELDS: HeroSlideField[] = [
  "title",
  "subtitle",
  "cta_text",
  "cta_url",
]

/**
 * Updates one editable text column on a hero_slides row. Used by the
 * dashboard's hero-slide editor.
 */
export async function updateHeroSlideText(
  id: string,
  field: HeroSlideField,
  value: string,
): Promise<SimpleResult> {
  if (!id) return { ok: false, error: "Missing slide id." }
  if (!HERO_SLIDE_FIELDS.includes(field)) {
    return { ok: false, error: `Unknown field: ${String(field)}` }
  }
  if (typeof value !== "string") return { ok: false, error: "Value must be text." }
  if (value.length > MAX_TEXT_LEN) {
    return { ok: false, error: `Text too long. Limit is ${MAX_TEXT_LEN} characters.` }
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Server is not configured.",
    }
  }

  // Empty strings on optional columns should become NULL so the renderer
  // treats them as "unset" rather than rendering an empty button.
  const stored = field === "title" ? value : value.length === 0 ? null : value

  const { error } = await supabase
    .from("hero_slides")
    .update({ [field]: stored })
    .eq("id", id)

  if (error) return { ok: false, error: `Database update failed: ${error.message}` }

  bumpCaches()
  return { ok: true }
}

export type BrandField = "name" | "description"
const BRAND_FIELDS: BrandField[] = ["name", "description"]

/**
 * Updates one editable text column on a brand row (name or description).
 */
export async function updateBrandText(
  slug: string,
  field: BrandField,
  value: string,
): Promise<SimpleResult> {
  if (!slug) return { ok: false, error: "Missing brand slug." }
  if (!BRAND_FIELDS.includes(field)) {
    return { ok: false, error: `Unknown field: ${String(field)}` }
  }
  if (typeof value !== "string") return { ok: false, error: "Value must be text." }
  if (value.length > MAX_TEXT_LEN) {
    return { ok: false, error: `Text too long. Limit is ${MAX_TEXT_LEN} characters.` }
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Server is not configured.",
    }
  }

  const stored = field === "description" && value.length === 0 ? null : value

  const { error } = await supabase
    .from("brands")
    .update({ [field]: stored })
    .eq("slug", slug)

  if (error) return { ok: false, error: `Database update failed: ${error.message}` }

  bumpCaches()
  return { ok: true }
}
