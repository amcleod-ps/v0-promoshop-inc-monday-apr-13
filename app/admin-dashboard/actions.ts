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

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

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

  let dbError: string | null = null
  switch (target) {
    case "site_images": {
      const { error } = await supabase
        .from("site_images")
        .update({ url })
        .eq("key", id)
      if (error) dbError = error.message
      break
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
      if (e1) {
        dbError = e1.message
        break
      }
      await supabase
        .from("site_images")
        .update({ url })
        .eq("key", `brand.${id}.logo`)
      break
    }
    case "hero_slide": {
      const { error } = await supabase
        .from("hero_slides")
        .update({ image_url: url })
        .eq("id", id)
      if (error) dbError = error.message
      break
    }
    case "product_image": {
      const { error } = await supabase
        .from("product_images")
        .update({ url })
        .eq("id", id)
      if (error) dbError = error.message
      break
    }
    default: {
      return { ok: false, error: `Unknown target: ${String(target)}` }
    }
  }

  if (dbError) {
    return { ok: false, error: `Database update failed: ${dbError}` }
  }

  // Tell Next.js to rebuild every cached page so the new image is visible
  // immediately on the live site, not just the dashboard.
  revalidatePath("/", "layout")
  revalidatePath("/admin-dashboard")

  return { ok: true, url }
}
