"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateImageUpload } from "@/lib/image-upload"

const BUCKET = "site-images"

interface SuccessResultBase {
  ok: true
}
interface ErrorResult {
  ok: false
  error: string
}
export interface SuccessWithId extends SuccessResultBase {
  id: string
}
export interface SuccessWithUrl extends SuccessResultBase {
  url: string
}
export type SimpleResult = SuccessResultBase | ErrorResult
export type CreateResult = SuccessWithId | ErrorResult
export type UploadResult = SuccessWithUrl | ErrorResult

function bumpCaches() {
  revalidatePath("/", "layout")
  revalidatePath("/admin-dashboard")
}

function adminOrError():
  | { ok: true; supabase: ReturnType<typeof createAdminClient> }
  | { ok: false; error: string } {
  try {
    return { ok: true, supabase: createAdminClient() }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Server is not configured.",
    }
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80)
}

// ===========================================================================
// Brand creation / deletion
// ===========================================================================

export async function createBrand(input: {
  slug?: string
  name: string
  description?: string
  categories?: string[]
  featured?: boolean
}): Promise<CreateResult> {
  const name = (input.name ?? "").trim()
  if (!name) return { ok: false, error: "Brand name is required." }
  const slug = (input.slug?.trim() || slugify(name)).slice(0, 80)
  if (!slug) return { ok: false, error: "Could not derive a slug from the name." }

  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  // Pick the next sort_order so new brands land at the end of the list.
  const { data: last } = await supabase
    .from("brands")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const sort_order = ((last?.sort_order as number | undefined) ?? -1) + 1

  const { error } = await supabase.from("brands").insert({
    slug,
    name,
    description: input.description?.trim() || null,
    categories: input.categories ?? [],
    featured: input.featured ?? false,
    is_active: true,
    sort_order,
  })
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `A brand with slug "${slug}" already exists.` }
    }
    return { ok: false, error: `Could not create brand: ${error.message}` }
  }

  bumpCaches()
  return { ok: true, id: slug }
}

/**
 * Soft delete: marks the brand as inactive so it disappears from the
 * public site but stays in the database. The admin can re-activate or
 * the team can hard-delete from the Supabase Dashboard if needed.
 */
export async function softDeleteBrand(slug: string): Promise<SimpleResult> {
  if (!slug) return { ok: false, error: "Missing brand slug." }
  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { error } = await supabase
    .from("brands")
    .update({ is_active: false })
    .eq("slug", slug)
  if (error) return { ok: false, error: `Could not delete brand: ${error.message}` }
  bumpCaches()
  return { ok: true }
}

// ===========================================================================
// Product creation / deletion
// ===========================================================================

export async function createProduct(input: {
  sku: string
  name: string
  category: string
  description?: string
  brandSlugs?: string[]
  genders?: string[]
  sizes?: string[]
  minQty?: number
}): Promise<CreateResult> {
  const sku = (input.sku ?? "").trim()
  const name = (input.name ?? "").trim()
  const category = (input.category ?? "").trim()
  if (!sku) return { ok: false, error: "SKU is required." }
  if (!name) return { ok: false, error: "Product name is required." }
  if (!category) return { ok: false, error: "Category is required." }

  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const { data: last } = await supabase
    .from("products")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const sort_order = ((last?.sort_order as number | undefined) ?? -1) + 1

  const { error } = await supabase.from("products").insert({
    sku,
    name,
    category,
    description: input.description?.trim() || null,
    brand_slugs: input.brandSlugs ?? [],
    genders: input.genders ?? [],
    sizes: input.sizes ?? [],
    min_qty: Math.max(1, Math.floor(input.minQty ?? 1)),
    deco_locations: [],
    deco_methods: [],
    is_active: true,
    sort_order,
  })
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `A product with SKU "${sku}" already exists.` }
    }
    return { ok: false, error: `Could not create product: ${error.message}` }
  }

  bumpCaches()
  return { ok: true, id: sku }
}

export async function softDeleteProduct(sku: string): Promise<SimpleResult> {
  if (!sku) return { ok: false, error: "Missing SKU." }
  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("sku", sku)
  if (error) return { ok: false, error: `Could not delete product: ${error.message}` }
  bumpCaches()
  return { ok: true }
}

// ===========================================================================
// Product colour CRUD
// ===========================================================================

export async function createProductColour(input: {
  productSku: string
  name: string
  hex: string
}): Promise<CreateResult> {
  const productSku = (input.productSku ?? "").trim()
  const name = (input.name ?? "").trim()
  const hex = (input.hex ?? "").trim()
  if (!productSku) return { ok: false, error: "SKU is required." }
  if (!name) return { ok: false, error: "Colour name is required." }
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return { ok: false, error: "Hex must be in the form #rrggbb (e.g. #ef473f)." }
  }

  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const { data: last } = await supabase
    .from("product_colours")
    .select("sort_order")
    .eq("product_sku", productSku)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const sort_order = ((last?.sort_order as number | undefined) ?? -1) + 1

  const { data, error } = await supabase
    .from("product_colours")
    .insert({ product_sku: productSku, name, hex, sort_order })
    .select("id")
    .single()
  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: `Colour "${name}" already exists for this product.` }
    }
    return { ok: false, error: `Could not create colour: ${error?.message ?? "unknown"}` }
  }

  bumpCaches()
  return { ok: true, id: data.id as string }
}

export async function updateProductColour(input: {
  id: string
  name?: string
  hex?: string
}): Promise<SimpleResult> {
  if (!input.id) return { ok: false, error: "Missing colour id." }
  const update: Record<string, string> = {}
  if (input.name != null) {
    const n = input.name.trim()
    if (!n) return { ok: false, error: "Name cannot be empty." }
    update.name = n
  }
  if (input.hex != null) {
    const h = input.hex.trim()
    if (!/^#[0-9a-fA-F]{6}$/.test(h)) {
      return { ok: false, error: "Hex must be in the form #rrggbb." }
    }
    update.hex = h
  }
  if (Object.keys(update).length === 0) return { ok: true }

  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { error } = await supabase
    .from("product_colours")
    .update(update)
    .eq("id", input.id)
  if (error) return { ok: false, error: `Could not update colour: ${error.message}` }
  bumpCaches()
  return { ok: true }
}

export async function deleteProductColour(id: string): Promise<SimpleResult> {
  if (!id) return { ok: false, error: "Missing colour id." }
  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  // ON DELETE CASCADE from product_colours → product_images, so all
  // images attached to this colour disappear with it.
  const { error } = await supabase.from("product_colours").delete().eq("id", id)
  if (error) return { ok: false, error: `Could not delete colour: ${error.message}` }
  bumpCaches()
  return { ok: true }
}

// ===========================================================================
// Product image creation (attach a new gallery image to an existing colour)
// ===========================================================================

export async function createProductImage(
  productSku: string,
  colourId: string,
  label: string,
  formData: FormData,
): Promise<UploadResult> {
  if (!productSku) return { ok: false, error: "SKU is required." }
  if (!colourId) return { ok: false, error: "Colour is required." }
  const validation = await validateImageUpload(formData.get("file"))
  if (!validation.ok) return { ok: false, error: validation.error }
  const { buffer, contentType, ext } = validation

  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const safeSku = productSku.replace(/[^a-z0-9._-]/gi, "_").slice(0, 60)
  const storagePath = `product_image/${safeSku}-${Date.now()}.${ext}`
  const upload = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: false,
  })
  if (upload.error) return { ok: false, error: `Upload failed: ${upload.error.message}` }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(upload.data.path)
  const url = pub.publicUrl

  // Append to the end of the colour's existing gallery.
  const { data: last } = await supabase
    .from("product_images")
    .select("sort_order")
    .eq("colour_id", colourId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const sort_order = ((last?.sort_order as number | undefined) ?? -1) + 1

  const { error } = await supabase.from("product_images").insert({
    product_sku: productSku,
    colour_id: colourId,
    label: (typeof label === "string" ? label.trim() : "") || `${productSku} image`,
    url,
    sort_order,
  })
  if (error) return { ok: false, error: `Could not create image: ${error.message}` }

  bumpCaches()
  return { ok: true, url }
}

// ===========================================================================
// Hero slide creation / deletion
// ===========================================================================

export async function createHeroSlide(input: {
  title: string
  subtitle?: string
  ctaText?: string
  ctaUrl?: string
}): Promise<CreateResult> {
  const title = (input.title ?? "").trim()
  if (!title) return { ok: false, error: "Slide title is required." }

  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const { data: last } = await supabase
    .from("hero_slides")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const sort_order = ((last?.sort_order as number | undefined) ?? -1) + 1

  const { data, error } = await supabase
    .from("hero_slides")
    .insert({
      title,
      subtitle: input.subtitle?.trim() || null,
      cta_text: input.ctaText?.trim() || null,
      cta_url: input.ctaUrl?.trim() || null,
      image_url: null,
      is_active: true,
      sort_order,
    })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: `Could not create slide: ${error?.message ?? "unknown"}` }

  bumpCaches()
  return { ok: true, id: data.id as string }
}

export async function softDeleteHeroSlide(id: string): Promise<SimpleResult> {
  if (!id) return { ok: false, error: "Missing slide id." }
  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { error } = await supabase
    .from("hero_slides")
    .update({ is_active: false })
    .eq("id", id)
  if (error) return { ok: false, error: `Could not delete slide: ${error.message}` }
  bumpCaches()
  return { ok: true }
}

// ===========================================================================
// Site image slot creation / deletion (keyed registry)
// ===========================================================================

export async function createSiteImage(input: {
  key: string
  label: string
  altText?: string
}): Promise<CreateResult> {
  const key = (input.key ?? "").trim()
  const label = (input.label ?? "").trim()
  if (!key) return { ok: false, error: "Key is required." }
  if (!/^[a-z0-9._-]+$/.test(key)) {
    return { ok: false, error: "Key may only contain lowercase letters, digits, dots, hyphens, and underscores." }
  }
  if (!label) return { ok: false, error: "Label is required." }

  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const { error } = await supabase
    .from("site_images")
    .insert({ key, label, url: "", alt_text: input.altText?.trim() || null })
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `Image slot with key "${key}" already exists.` }
    }
    return { ok: false, error: `Could not create site image: ${error.message}` }
  }

  bumpCaches()
  return { ok: true, id: key }
}

export async function deleteSiteImage(key: string): Promise<SimpleResult> {
  if (!key) return { ok: false, error: "Missing key." }
  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { error } = await supabase.from("site_images").delete().eq("key", key)
  if (error) return { ok: false, error: `Could not delete site image: ${error.message}` }
  bumpCaches()
  return { ok: true }
}

// ===========================================================================
// Team members CRUD
// ===========================================================================

export async function createTeamMember(input: {
  slug?: string
  name: string
  role: string
  description?: string
}): Promise<CreateResult> {
  const name = (input.name ?? "").trim()
  const role = (input.role ?? "").trim()
  if (!name) return { ok: false, error: "Name is required." }
  if (!role) return { ok: false, error: "Role is required." }
  const slug = (input.slug?.trim() || slugify(name)).slice(0, 80)
  if (!slug) return { ok: false, error: "Could not derive a slug from the name." }

  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const { data: last } = await supabase
    .from("team_members")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const sort_order = ((last?.sort_order as number | undefined) ?? -1) + 1

  const { error } = await supabase.from("team_members").insert({
    slug,
    name,
    role,
    description: input.description?.trim() || null,
    image_url: null,
    sort_order,
    is_active: true,
  })
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `A team member with slug "${slug}" already exists.` }
    }
    return { ok: false, error: `Could not create team member: ${error.message}` }
  }

  bumpCaches()
  return { ok: true, id: slug }
}

export type TeamMemberField = "name" | "role" | "description"
const TEAM_FIELDS: TeamMemberField[] = ["name", "role", "description"]

export async function updateTeamMemberText(
  slug: string,
  field: TeamMemberField,
  value: string,
): Promise<SimpleResult> {
  if (!slug) return { ok: false, error: "Missing slug." }
  if (!TEAM_FIELDS.includes(field)) return { ok: false, error: `Unknown field: ${field}` }
  if (typeof value !== "string") return { ok: false, error: "Value must be text." }
  if (value.length > 5000) return { ok: false, error: "Too long (5000 char max)." }

  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const stored = field === "description" && value.length === 0 ? null : value
  const { error } = await supabase
    .from("team_members")
    .update({ [field]: stored })
    .eq("slug", slug)
  if (error) return { ok: false, error: `Could not update: ${error.message}` }
  bumpCaches()
  return { ok: true }
}

export async function softDeleteTeamMember(slug: string): Promise<SimpleResult> {
  if (!slug) return { ok: false, error: "Missing slug." }
  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { error } = await supabase
    .from("team_members")
    .update({ is_active: false })
    .eq("slug", slug)
  if (error) return { ok: false, error: `Could not delete member: ${error.message}` }
  bumpCaches()
  return { ok: true }
}

export async function replaceTeamMemberImage(
  slug: string,
  formData: FormData,
): Promise<UploadResult> {
  if (!slug) return { ok: false, error: "Missing slug." }
  const validation = await validateImageUpload(formData.get("file"))
  if (!validation.ok) return { ok: false, error: validation.error }
  const { buffer, contentType, ext } = validation

  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const safeSlug = slug.replace(/[^a-z0-9._-]/gi, "_").slice(0, 60)
  const storagePath = `team/${safeSlug}-${Date.now()}.${ext}`
  const upload = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: false,
  })
  if (upload.error) return { ok: false, error: `Upload failed: ${upload.error.message}` }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(upload.data.path)
  const url = pub.publicUrl

  const { error } = await supabase
    .from("team_members")
    .update({ image_url: url })
    .eq("slug", slug)
  if (error) return { ok: false, error: `Could not save team photo: ${error.message}` }

  bumpCaches()
  return { ok: true, url }
}

// ===========================================================================
// Theme colours
// ===========================================================================

export async function updateThemeColor(
  key: string,
  value: string,
): Promise<SimpleResult> {
  if (!key) return { ok: false, error: "Missing key." }
  const hex = (value ?? "").trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return { ok: false, error: "Hex must be in the form #rrggbb." }
  }
  const adminResult = adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  // Looking up the label by key first preserves it on upsert without
  // forcing the client to send the label too.
  const { data: existing } = await supabase
    .from("site_theme")
    .select("label")
    .eq("key", key)
    .maybeSingle()
  const label = (existing?.label as string | undefined) ?? key

  const { error } = await supabase
    .from("site_theme")
    .upsert({ key, label, value: hex }, { onConflict: "key" })
  if (error) return { ok: false, error: `Could not save colour: ${error.message}` }

  bumpCaches()
  return { ok: true }
}
