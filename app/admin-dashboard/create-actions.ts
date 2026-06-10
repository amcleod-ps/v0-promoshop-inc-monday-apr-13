"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdminAction } from "@/lib/admin-auth-action"
import { validateImageUpload } from "@/lib/image-upload"
import { checkUploadRateLimit } from "@/lib/upload-rate-limit"

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

const STALE_ROW_ERROR =
  "No changes applied — this row no longer exists. Refresh the dashboard."

function bumpCaches() {
  revalidatePath("/", "layout")
  revalidatePath("/admin-dashboard")
}

async function adminOrError(): Promise<
  | { ok: true; supabase: ReturnType<typeof createAdminClient> }
  | { ok: false; error: string }
> {
  // Every create/update/delete in this file goes through here, so the
  // ADMIN_DASHBOARD_PASSWORD gate (when enabled) covers them all. Server
  // actions are invocable from any route via their Next-Action id, so the
  // proxy.ts matcher alone cannot protect them.
  const denied = await requireAdminAction()
  if (denied) return denied
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

interface PgError {
  code?: string
  message: string
}

// Postgres unique_violation. Matching the SQLSTATE code is locale- and
// wording-independent, unlike substring-matching on the message.
function isDuplicate(error: PgError | null | undefined): boolean {
  return error?.code === "23505"
}

/**
 * Inserts a row whose sort_order is assigned atomically by the
 * `assign_sort_order` trigger from migration 0006 (inserting NULL lets the
 * trigger fill in max+1 under an advisory lock). On a database where 0006
 * hasn't been applied yet the NULL violates the NOT NULL constraint (23502);
 * in that case fall back to the legacy read-max-then-insert, accepting its
 * small concurrency race until the migration is run.
 */
async function insertWithAtomicSortOrder(
  supabase: ReturnType<typeof createAdminClient>,
  table: string,
  row: Record<string, unknown>,
  opts: { scopeColumn?: string; returning?: string } = {},
): Promise<{ data: Record<string, unknown> | null; error: PgError | null }> {
  const run = async (sortOrder: number | null) => {
    const builder = supabase.from(table).insert({ ...row, sort_order: sortOrder })
    if (opts.returning) {
      const { data, error } = await builder.select(opts.returning).single()
      return { data: (data as Record<string, unknown> | null) ?? null, error }
    }
    const { error } = await builder
    return { data: null, error }
  }

  let result = await run(null)
  if (result.error?.code === "23502") {
    let query = supabase
      .from(table)
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
    if (opts.scopeColumn) {
      query = query.eq(opts.scopeColumn, row[opts.scopeColumn] as string)
    }
    const { data: last } = await query.maybeSingle()
    result = await run(((last?.sort_order as number | undefined) ?? -1) + 1)
  }
  return result
}

// ===========================================================================
// Brand creation / deletion / editing
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

  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const { error } = await insertWithAtomicSortOrder(supabase, "brands", {
    slug,
    name,
    description: input.description?.trim() || null,
    categories: input.categories ?? [],
    featured: input.featured ?? false,
    is_active: true,
  })
  if (error) {
    if (isDuplicate(error)) {
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
  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { data, error } = await supabase
    .from("brands")
    .update({ is_active: false })
    .eq("slug", slug)
    .select("slug")
  if (error) return { ok: false, error: `Could not delete brand: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }
  bumpCaches()
  return { ok: true }
}

/**
 * Replaces a brand's category tag list (shown on the brands listing and
 * detail pages). Previously create-only.
 */
export async function updateBrandCategories(
  slug: string,
  categories: string[],
): Promise<SimpleResult> {
  if (!slug) return { ok: false, error: "Missing brand slug." }
  if (!Array.isArray(categories)) {
    return { ok: false, error: "Categories must be a list." }
  }
  const cleaned = categories.map((c) => String(c).trim()).filter(Boolean)
  if (cleaned.some((c) => c.length > 80)) {
    return { ok: false, error: "Each category must be 80 characters or fewer." }
  }

  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { data, error } = await supabase
    .from("brands")
    .update({ categories: cleaned })
    .eq("slug", slug)
    .select("slug")
  if (error) return { ok: false, error: `Could not update categories: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }
  bumpCaches()
  return { ok: true }
}

// ===========================================================================
// Product creation / deletion / editing
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

  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const { error } = await insertWithAtomicSortOrder(supabase, "products", {
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
  })
  if (error) {
    if (isDuplicate(error)) {
      return { ok: false, error: `A product with SKU "${sku}" already exists.` }
    }
    return { ok: false, error: `Could not create product: ${error.message}` }
  }

  bumpCaches()
  return { ok: true, id: sku }
}

export async function softDeleteProduct(sku: string): Promise<SimpleResult> {
  if (!sku) return { ok: false, error: "Missing SKU." }
  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { data, error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("sku", sku)
    .select("sku")
  if (error) return { ok: false, error: `Could not delete product: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }
  bumpCaches()
  return { ok: true }
}

export type ProductTextField = "name" | "category" | "description"
const PRODUCT_TEXT_FIELDS: ProductTextField[] = ["name", "category", "description"]

/**
 * Updates one editable text column on a products row. These fields were
 * previously create-only, forcing corrections through the Table Editor.
 */
export async function updateProductText(
  sku: string,
  field: ProductTextField,
  value: string,
): Promise<SimpleResult> {
  if (!sku) return { ok: false, error: "Missing SKU." }
  if (!PRODUCT_TEXT_FIELDS.includes(field)) {
    return { ok: false, error: `Unknown field: ${String(field)}` }
  }
  if (typeof value !== "string") return { ok: false, error: "Value must be text." }
  if (value.length > 5000) return { ok: false, error: "Too long (5000 char max)." }
  const trimmed = value.trim()
  if (field !== "description" && !trimmed) {
    return { ok: false, error: `${field === "name" ? "Name" : "Category"} cannot be empty.` }
  }

  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const stored = field === "description" && trimmed.length === 0 ? null : trimmed
  const { data, error } = await supabase
    .from("products")
    .update({ [field]: stored })
    .eq("sku", sku)
    .select("sku")
  if (error) return { ok: false, error: `Could not update product: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }
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

  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const { data, error } = await insertWithAtomicSortOrder(
    supabase,
    "product_colours",
    { product_sku: productSku, name, hex },
    { scopeColumn: "product_sku", returning: "id" },
  )
  if (error || !data) {
    if (isDuplicate(error)) {
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

  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { data, error } = await supabase
    .from("product_colours")
    .update(update)
    .eq("id", input.id)
    .select("id")
  if (error) return { ok: false, error: `Could not update colour: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }
  bumpCaches()
  return { ok: true }
}

export async function deleteProductColour(id: string): Promise<SimpleResult> {
  if (!id) return { ok: false, error: "Missing colour id." }
  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  // ON DELETE CASCADE from product_colours → product_images, so all
  // images attached to this colour disappear with it.
  const { data, error } = await supabase
    .from("product_colours")
    .delete()
    .eq("id", id)
    .select("id")
  if (error) return { ok: false, error: `Could not delete colour: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }
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
  const rate = checkUploadRateLimit()
  if (!rate.ok) return rate
  const validation = await validateImageUpload(formData.get("file"))
  if (!validation.ok) return { ok: false, error: validation.error }
  const { buffer, contentType, ext } = validation

  const adminResult = await adminOrError()
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

  // Appends to the end of the colour's existing gallery (scoped max+1).
  const { error } = await insertWithAtomicSortOrder(
    supabase,
    "product_images",
    {
      product_sku: productSku,
      colour_id: colourId,
      label: label.trim() || `${productSku} image`,
      url,
    },
    { scopeColumn: "colour_id" },
  )
  if (error) return { ok: false, error: `Could not create image: ${error.message}` }

  bumpCaches()
  return { ok: true, url }
}

// ===========================================================================
// Hero slide creation / deletion / editing
// ===========================================================================

export async function createHeroSlide(input: {
  title: string
  subtitle?: string
  ctaText?: string
  ctaUrl?: string
}): Promise<CreateResult> {
  const title = (input.title ?? "").trim()
  if (!title) return { ok: false, error: "Slide title is required." }
  const ctaUrl = input.ctaUrl?.trim() || null
  if (ctaUrl !== null && !/^(\/|https?:\/\/)/.test(ctaUrl)) {
    return {
      ok: false,
      error:
        "CTA URL must start with / (a page on this site) or http:// / https:// (an external link).",
    }
  }

  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const { data, error } = await insertWithAtomicSortOrder(
    supabase,
    "hero_slides",
    {
      title,
      subtitle: input.subtitle?.trim() || null,
      cta_text: input.ctaText?.trim() || null,
      cta_url: ctaUrl,
      image_url: null,
      is_active: true,
    },
    { returning: "id" },
  )
  if (error || !data) return { ok: false, error: `Could not create slide: ${error?.message ?? "unknown"}` }

  bumpCaches()
  return { ok: true, id: data.id as string }
}

export async function softDeleteHeroSlide(id: string): Promise<SimpleResult> {
  if (!id) return { ok: false, error: "Missing slide id." }
  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { data, error } = await supabase
    .from("hero_slides")
    .update({ is_active: false })
    .eq("id", id)
    .select("id")
  if (error) return { ok: false, error: `Could not delete slide: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }
  bumpCaches()
  return { ok: true }
}

/**
 * Sets or clears a hero slide's solid background colour. Empty value
 * clears it; otherwise must be #rrggbb. Previously create-only.
 */
export async function updateHeroSlideBgColor(
  id: string,
  value: string,
): Promise<SimpleResult> {
  if (!id) return { ok: false, error: "Missing slide id." }
  const hex = (value ?? "").trim()
  if (hex && !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return { ok: false, error: "Background colour must be in the form #rrggbb, or empty to clear it." }
  }

  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { data, error } = await supabase
    .from("hero_slides")
    .update({ bg_color: hex || null })
    .eq("id", id)
    .select("id")
  if (error) return { ok: false, error: `Could not update colour: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }
  bumpCaches()
  return { ok: true }
}

// ===========================================================================
// Display order (sort_order) editing — shared across entity types
// ===========================================================================

export type SortableEntity =
  | "brand"
  | "product"
  | "hero_slide"
  | "product_colour"
  | "product_image"
  | "team_member"

const SORTABLE_ENTITIES: Record<SortableEntity, { table: string; pk: string }> = {
  brand: { table: "brands", pk: "slug" },
  product: { table: "products", pk: "sku" },
  hero_slide: { table: "hero_slides", pk: "id" },
  product_colour: { table: "product_colours", pk: "id" },
  product_image: { table: "product_images", pk: "id" },
  team_member: { table: "team_members", pk: "slug" },
}

/**
 * Updates a row's sort_order (lower = earlier). sort_order values were
 * previously assigned only at creation; this lets admins reorder without
 * the Table Editor.
 */
export async function updateSortOrder(
  entity: SortableEntity,
  id: string,
  sortOrder: number,
): Promise<SimpleResult> {
  const config = SORTABLE_ENTITIES[entity]
  if (!config) return { ok: false, error: `Unknown entity: ${String(entity)}` }
  if (!id) return { ok: false, error: "Missing row identifier." }
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) {
    return { ok: false, error: "Display order must be a whole number between 0 and 100000." }
  }

  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { data, error } = await supabase
    .from(config.table)
    .update({ sort_order: sortOrder })
    .eq(config.pk, id)
    .select(config.pk)
  if (error) return { ok: false, error: `Could not update order: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }
  bumpCaches()
  return { ok: true }
}

// ===========================================================================
// Site image slot creation / deletion / editing (keyed registry)
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

  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const { error } = await supabase
    .from("site_images")
    .insert({ key, label, url: "", alt_text: input.altText?.trim() || null })
  if (error) {
    if (isDuplicate(error)) {
      return { ok: false, error: `Image slot with key "${key}" already exists.` }
    }
    return { ok: false, error: `Could not create site image: ${error.message}` }
  }

  bumpCaches()
  return { ok: true, id: key }
}

export async function deleteSiteImage(key: string): Promise<SimpleResult> {
  if (!key) return { ok: false, error: "Missing key." }
  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { data, error } = await supabase
    .from("site_images")
    .delete()
    .eq("key", key)
    .select("key")
  if (error) return { ok: false, error: `Could not delete site image: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }
  bumpCaches()
  return { ok: true }
}

/**
 * Updates a site image slot's alt text (read by screen readers wherever the
 * image renders via <SiteImage>). Previously create-only.
 */
export async function updateSiteImageAltText(
  key: string,
  value: string,
): Promise<SimpleResult> {
  if (!key) return { ok: false, error: "Missing key." }
  if (typeof value !== "string") return { ok: false, error: "Value must be text." }
  if (value.length > 500) return { ok: false, error: "Alt text too long (500 char max)." }

  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { data, error } = await supabase
    .from("site_images")
    .update({ alt_text: value.trim() || null })
    .eq("key", key)
    .select("key")
  if (error) return { ok: false, error: `Could not update alt text: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }
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

  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const { error } = await insertWithAtomicSortOrder(supabase, "team_members", {
    slug,
    name,
    role,
    description: input.description?.trim() || null,
    image_url: null,
    is_active: true,
  })
  if (error) {
    if (isDuplicate(error)) {
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

  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  const stored = field === "description" && value.length === 0 ? null : value
  const { data, error } = await supabase
    .from("team_members")
    .update({ [field]: stored })
    .eq("slug", slug)
    .select("slug")
  if (error) return { ok: false, error: `Could not update: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }
  bumpCaches()
  return { ok: true }
}

export async function softDeleteTeamMember(slug: string): Promise<SimpleResult> {
  if (!slug) return { ok: false, error: "Missing slug." }
  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult
  const { data, error } = await supabase
    .from("team_members")
    .update({ is_active: false })
    .eq("slug", slug)
    .select("slug")
  if (error) return { ok: false, error: `Could not delete member: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }
  bumpCaches()
  return { ok: true }
}

export async function replaceTeamMemberImage(
  slug: string,
  formData: FormData,
): Promise<UploadResult> {
  if (!slug) return { ok: false, error: "Missing slug." }
  const rate = checkUploadRateLimit()
  if (!rate.ok) return rate
  const validation = await validateImageUpload(formData.get("file"))
  if (!validation.ok) return { ok: false, error: validation.error }
  const { buffer, contentType, ext } = validation

  const adminResult = await adminOrError()
  if (!adminResult.ok) return adminResult
  const { supabase } = adminResult

  // Remember the old photo so it can be pruned once the row points at the
  // new one — replaced uploads shouldn't accumulate in storage forever.
  const { data: existing } = await supabase
    .from("team_members")
    .select("image_url")
    .eq("slug", slug)
    .maybeSingle()
  const oldUrl = (existing?.image_url as string | null) ?? null

  const safeSlug = slug.replace(/[^a-z0-9._-]/gi, "_").slice(0, 60)
  const storagePath = `team/${safeSlug}-${Date.now()}.${ext}`
  const upload = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: false,
  })
  if (upload.error) return { ok: false, error: `Upload failed: ${upload.error.message}` }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(upload.data.path)
  const url = pub.publicUrl

  const { data, error } = await supabase
    .from("team_members")
    .update({ image_url: url })
    .eq("slug", slug)
    .select("slug")
  if (error) return { ok: false, error: `Could not save team photo: ${error.message}` }
  if (!data || data.length === 0) return { ok: false, error: STALE_ROW_ERROR }

  const marker = `/storage/v1/object/public/${BUCKET}/`
  const oldPathIdx = oldUrl ? oldUrl.indexOf(marker) : -1
  if (oldUrl && oldPathIdx !== -1) {
    const oldPath = decodeURIComponent(oldUrl.slice(oldPathIdx + marker.length).split("?")[0])
    if (oldPath && oldPath !== upload.data.path) {
      try {
        await supabase.storage.from(BUCKET).remove([oldPath])
      } catch {
        // Pruning is opportunistic — never fail the save over it.
      }
    }
  }

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
  const adminResult = await adminOrError()
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
