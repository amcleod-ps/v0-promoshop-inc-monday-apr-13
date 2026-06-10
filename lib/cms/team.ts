export interface TeamMember {
  name: string
  role: string
  description: string
  /**
   * Stable registry slug for the `site_images['team.<slug>']` photo slot.
   * Always set from the authoritative source (DB row's slug column or the
   * original static name) — deriving it from the *display* name breaks the
   * photo lookup the moment an admin renames someone.
   */
  slug?: string
  /** URL to profile picture. Leave empty to render initials fallback. */
  imagePath?: string
  /**
   * Direct image URL set when this row was sourced from the
   * `team_members` Supabase table. Takes precedence over the
   * legacy `site_images['team.<slug>']` registry lookup, so a photo
   * uploaded via the Team tab in /admin-dashboard shows up
   * immediately on the public site instead of being shadowed by
   * the seeded default.
   */
  directImageUrl?: string
}

// Edited via the upcoming admin dashboard. Shared by the Home and About pages
// so both always render the same roster.
export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: "Phil Duym",
    role: "Owner & President",
    description: "Leading PromoShop's vision for premium branded merchandise.",
    imagePath: "/placeholder-user.jpg",
  },
  {
    name: "Amy Duquette",
    role: "Account Executive",
    description: "Dedicated to delivering exceptional client experiences.",
    imagePath: "/placeholder-user.jpg",
  },
  {
    name: "Ania Wlodarkiewicz",
    role: "Account Executive",
    description: "Helping brands find the perfect promotional products.",
    imagePath: "/placeholder-user.jpg",
  },
  {
    name: "Alex Cyrenne",
    role: "Account Executive",
    description: "Building lasting partnerships with our clients.",
    imagePath: "/placeholder-user.jpg",
  },
]
