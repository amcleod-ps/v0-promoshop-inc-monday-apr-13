import { createClient } from "./server"

export interface SupabaseTeamMember {
  slug: string
  name: string
  role: string
  description: string | null
  image_url: string | null
  sort_order: number
  is_active: boolean
  updated_at: string
}

function bustedUrl(url: string | null | undefined, updatedAt: string): string | null {
  if (!url) return null
  return `${url}?v=${encodeURIComponent(updatedAt)}`
}

/**
 * Fetches the active team roster from Supabase, ordered for display.
 * Returns [] when the table doesn't exist yet (migration 0005 not
 * applied) or env vars are missing — callers fall back to the static
 * lib/cms/team.ts roster in that case.
 */
export async function getTeamMembers(): Promise<SupabaseTeamMember[]> {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    return []
  }
  const { data, error } = await supabase
    .from("team_members")
    .select("slug, name, role, description, image_url, sort_order, is_active, updated_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error || !data) return []

  return data.map((row) => ({
    ...row,
    image_url: bustedUrl(row.image_url, row.updated_at),
  }))
}
