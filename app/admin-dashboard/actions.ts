"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdminAction } from "@/lib/admin-auth-action"
import { validateImageUpload } from "@/lib/image-upload"
import { checkUploadRateLimit } from "@/lib/upload-rate-limit"
import { adminActionError } from "@/lib/admin-error"

const BUCKET = "site-images"

export type ReplaceTarget =
  | "site_images"
  | "brand"
  | "hero_slide"
  | "product_image"

const REPLACE_TARGETS: ReplaceTarget[] = [
  "site_images",
  "brand",
  "hero_slide",
  "product_image",
]

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

// Shown when an update matched zero rows — e.g. a stale dashboard tab editing
// a row that was deleted from another tab or the Supabase Table Editor.
const STALE_ROW_ERROR =
  "No changes applied — this row no longer exists. Refresh the dashboard."

// Image read/write failures can carry raw Postgres/Storage messages (table
// and column names); log the detail server-side and return a clean line for
// the dashboard. Shared by writeImageUrl/removeImage, which compose a string
// rather than an ErrorResult.
function imageWriteFailure(detail: string): string {
  console.error("[admin-dashboard] image write failed:", detail)
  return "Couldn't update the image. Please try again."
}

function bumpCaches() {
  // Tell Next.js to rebuild every cached page so changes are visible
  // immediately on the live site, not just the dashboard.
  revalidatePath("/", "layout")
  revalidatePath("/admin-dashboard")
}

/**
 * Extracts the object path within our bucket from a public Storage URL.
 * Returns null for external URLs (seed images, /images/* paths, other
 * hosts) so we never try to prune files we don't own.
 */
function storagePathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  const path = url.slice(i + marker.length).split("?")[0]
  return path ? decodeURIComponent(path) : null
}

/**
 * Best-effort removal of replaced files so storage stays bounded. Failures
 * are ignored: a stale file is preferable to failing the admin's save after
 * the database already points at the new upload.
 */
async function pruneReplacedFiles(
  supabase: ReturnType<typeof createAdminClient>,
  oldUrls: Array<string | null | undefined>,
  newUrl: string,
) {
  const newPath = storagePathFromPublicUrl(newUrl)
  const paths = Array.from(
    new Set(
      oldUrls
        .map((u) => storagePathFromPublicUrl(u))
        .filter((p): p is string => !!p && p !== newPath),
    ),
  )
  if (paths.length === 0) return
  try {
    await supabase.storage.from(BUCKET).remove(paths)
  } catch {
    // Ignore — pruning is opportunistic.
  }
}

/**
 * Replaces an image on the website. Steps:
 *   1. Validate inputs (allowlisted target, file present, under 10 MB).
 *   2. Upload the file to the `site-images` Storage bucket under a unique
 *      path that includes a timestamp.
 *   3. Update the database row that referenced the old URL. The new public
 *      URL is what the site renders on the next page load.
 *   4. Delete the file the row previously pointed at (when it lives in our
 *      bucket) so replaced uploads don't accumulate forever.
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
  // Server actions are invocable from any route via their Next-Action id,
  // so the proxy.ts gate on /admin-dashboard alone cannot protect them —
  // each action re-verifies the (optional) admin password itself.
  const denied = await requireAdminAction()
  if (denied) return denied
  // Validate the target BEFORE touching storage so a bad target can never
  // leave an orphaned file under an unintended path.
  if (!REPLACE_TARGETS.includes(target)) {
    return { ok: false, error: `Unknown target: ${String(target)}` }
  }
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Missing row identifier." }
  }
  const rate = checkUploadRateLimit()
  if (!rate.ok) return rate
  // Sniff magic bytes and allowlist raster formats — never trust the
  // client-supplied MIME/filename. Blocks SVG/HTML stored-XSS payloads.
  const validation = await validateImageUpload(formData.get("file"))
  if (!validation.ok) return { ok: false, error: validation.error }
  const { buffer, contentType, ext } = validation

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    return adminActionError("Server is not configured.", err)
  }

  const oldUrls = await readImageUrls(supabase, target, id)

  const safeId = id.replace(/[^a-z0-9._-]/gi, "_").slice(0, 80)
  const storagePath = `${target}/${safeId}-${Date.now()}.${ext}`

  const upload = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: false,
  })
  if (upload.error) {
    return adminActionError("Image upload failed. Please try again.", upload.error.message)
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(upload.data.path)
  const url = pub.publicUrl

  // writeImageUrl already returns a dashboard-safe message (STALE_ROW_ERROR or
  // imageWriteFailure), so surface it as-is rather than re-wrapping.
  const writeErr = await writeImageUrl(supabase, target, id, url)
  if (writeErr) return { ok: false, error: writeErr }

  await pruneReplacedFiles(supabase, oldUrls, url)

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
  const denied = await requireAdminAction()
  if (denied) return denied
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Missing row identifier." }
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    return adminActionError("Server is not configured.", err)
  }

  let dbError: string | null = null
  switch (target) {
    case "site_images": {
      const { data, error } = await supabase
        .from("site_images")
        .update({ url: "" })
        .eq("key", id)
        .select("key")
      if (error) dbError = imageWriteFailure(error.message)
      else if (!data || data.length === 0) dbError = STALE_ROW_ERROR
      break
    }
    case "brand": {
      // Mirror the replaceImage flow: clear both the canonical brand row
      // AND the legacy site_images override so neither shadows the other.
      const { data, error: e1 } = await supabase
        .from("brands")
        .update({ logo_url: null })
        .eq("slug", id)
        .select("slug")
      if (e1) {
        dbError = imageWriteFailure(e1.message)
        break
      }
      if (!data || data.length === 0) {
        dbError = STALE_ROW_ERROR
        break
      }
      // The override row may legitimately not exist for dashboard-created
      // brands, so zero rows here is not an error.
      const { error: e2 } = await supabase
        .from("site_images")
        .update({ url: "" })
        .eq("key", `brand.${id}.logo`)
      if (e2) dbError = imageWriteFailure(e2.message)
      break
    }
    case "hero_slide": {
      const { data, error } = await supabase
        .from("hero_slides")
        .update({ image_url: null })
        .eq("id", id)
        .select("id")
      if (error) dbError = imageWriteFailure(error.message)
      else if (!data || data.length === 0) dbError = STALE_ROW_ERROR
      break
    }
    case "product_image": {
      const { data, error } = await supabase
        .from("product_images")
        .delete()
        .eq("id", id)
        .select("id")
      if (error) dbError = imageWriteFailure(error.message)
      else if (!data || data.length === 0) dbError = STALE_ROW_ERROR
      break
    }
    default: {
      return { ok: false, error: `Unknown target: ${String(target)}` }
    }
  }

  if (dbError) return { ok: false, error: dbError }

  bumpCaches()
  return { ok: true }
}

/**
 * Reads the URL(s) the target row currently points at, so replaceImage can
 * prune the old file(s) after a successful swap. Read failures return []
 * (we just skip pruning).
 */
async function readImageUrls(
  supabase: ReturnType<typeof createAdminClient>,
  target: ReplaceTarget,
  id: string,
): Promise<Array<string | null>> {
  switch (target) {
    case "site_images": {
      const { data } = await supabase
        .from("site_images")
        .select("url")
        .eq("key", id)
        .maybeSingle()
      return [data?.url ?? null]
    }
    case "brand": {
      const [{ data: brand }, { data: override }] = await Promise.all([
        supabase.from("brands").select("logo_url").eq("slug", id).maybeSingle(),
        supabase
          .from("site_images")
          .select("url")
          .eq("key", `brand.${id}.logo`)
          .maybeSingle(),
      ])
      return [brand?.logo_url ?? null, override?.url ?? null]
    }
    case "hero_slide": {
      const { data } = await supabase
        .from("hero_slides")
        .select("image_url")
        .eq("id", id)
        .maybeSingle()
      return [data?.image_url ?? null]
    }
    case "product_image": {
      const { data } = await supabase
        .from("product_images")
        .select("url")
        .eq("id", id)
        .maybeSingle()
      return [data?.url ?? null]
    }
    default:
      return []
  }
}

async function writeImageUrl(
  supabase: ReturnType<typeof createAdminClient>,
  target: ReplaceTarget,
  id: string,
  url: string,
): Promise<string | null> {
  switch (target) {
    case "site_images": {
      const { data, error } = await supabase
        .from("site_images")
        .update({ url })
        .eq("key", id)
        .select("key")
      if (error) return imageWriteFailure(error.message)
      if (!data || data.length === 0) return STALE_ROW_ERROR
      return null
    }
    case "brand": {
      // Brand logos are referenced from TWO places at render time:
      //   * brands.logo_url            (canonical column)
      //   * site_images."brand.X.logo" (legacy override slot the site
      //                                 still checks first via useImageSrc)
      // Both must point at the new file or the override shadows the
      // canonical column and the site keeps rendering the old logo.
      const { data, error: e1 } = await supabase
        .from("brands")
        .update({ logo_url: url })
        .eq("slug", id)
        .select("slug")
      if (e1) return imageWriteFailure(e1.message)
      if (!data || data.length === 0) return STALE_ROW_ERROR
      // Capture the override write's error too — it was previously discarded,
      // so a failed write here returned success while the (non-empty) override
      // kept shadowing the canonical column and the site showed the old logo.
      // Zero rows is fine: dashboard-created brands have no override slot.
      const { error: e2 } = await supabase
        .from("site_images")
        .update({ url })
        .eq("key", `brand.${id}.logo`)
      return e2 ? imageWriteFailure(e2.message) : null
    }
    case "hero_slide": {
      const { data, error } = await supabase
        .from("hero_slides")
        .update({ image_url: url })
        .eq("id", id)
        .select("id")
      if (error) return imageWriteFailure(error.message)
      if (!data || data.length === 0) return STALE_ROW_ERROR
      return null
    }
    case "product_image": {
      const { data, error } = await supabase
        .from("product_images")
        .update({ url })
        .eq("id", id)
        .select("id")
      if (error) return imageWriteFailure(error.message)
      if (!data || data.length === 0) return STALE_ROW_ERROR
      return null
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
  const denied = await requireAdminAction()
  if (denied) return denied
  if (!key) return { ok: false, error: "Missing content key." }
  if (typeof value !== "string") return { ok: false, error: "Value must be text." }
  if (value.length > MAX_TEXT_LEN) {
    return { ok: false, error: `Text too long. Limit is ${MAX_TEXT_LEN} characters.` }
  }
  // `label` is an admin-supplied descriptor; cap it so the otherwise
  // uncapped field can't be used to write oversized rows.
  if (typeof label === "string" && label.length > 200) {
    return { ok: false, error: "Label is too long (200 character limit)." }
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    return adminActionError("Server is not configured.", err)
  }

  const { error } = await supabase
    .from("site_content")
    .upsert({ key, label, value }, { onConflict: "key" })

  if (error) return adminActionError("Couldn't save your changes. Please try again.", error.message)

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
  const denied = await requireAdminAction()
  if (denied) return denied
  if (!id) return { ok: false, error: "Missing slide id." }
  if (!HERO_SLIDE_FIELDS.includes(field)) {
    return { ok: false, error: `Unknown field: ${String(field)}` }
  }
  if (typeof value !== "string") return { ok: false, error: "Value must be text." }
  if (value.length > MAX_TEXT_LEN) {
    return { ok: false, error: `Text too long. Limit is ${MAX_TEXT_LEN} characters.` }
  }

  // Empty strings on optional columns should become NULL so the renderer
  // treats them as "unset" rather than rendering an empty button.
  const stored = field === "title" ? value : value.length === 0 ? null : value

  // Only relative paths and http(s) URLs make valid link targets; anything
  // else (javascript:, mailto typos, bare words) would render a broken or
  // dangerous CTA button. `(?!\/)` rejects protocol-relative `//host` URLs,
  // which browsers treat as an external link to that host.
  if (field === "cta_url" && stored !== null && !/^(\/(?!\/)|https?:\/\/)/.test(stored)) {
    return {
      ok: false,
      error:
        "CTA URL must start with / (a page on this site) or http:// / https:// (an external link).",
    }
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    return adminActionError("Server is not configured.", err)
  }

  const { data, error } = await supabase
    .from("hero_slides")
    .update({ [field]: stored })
    .eq("id", id)
    .select("id")

  if (error) return adminActionError("Couldn't save your changes. Please try again.", error.message)
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }

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
  const denied = await requireAdminAction()
  if (denied) return denied
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
    return adminActionError("Server is not configured.", err)
  }

  const stored = field === "description" && value.length === 0 ? null : value

  const { data, error } = await supabase
    .from("brands")
    .update({ [field]: stored })
    .eq("slug", slug)
    .select("slug")

  if (error) return adminActionError("Couldn't save your changes. Please try again.", error.message)
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }

  bumpCaches()
  return { ok: true }
}
