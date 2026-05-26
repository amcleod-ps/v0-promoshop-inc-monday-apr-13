"use client"

import { TEAM_MEMBERS, type TeamMember } from "@/lib/cms/team"
import { resolveSiteText, useSiteContentMap } from "@/components/site-content-provider"
import { useDbTeamMembers } from "@/components/team-provider"
import { teamImageId } from "@/lib/image-registry"

function slugFromImageId(id: string): string {
  return id.replace(/^team\./, "")
}

/**
 * Returns the team roster. Behaviour:
 *   1. If the `team_members` Supabase table has rows (migration 0005
 *      applied), use those — admins can now add/remove people from the
 *      dashboard.
 *   2. Otherwise, fall back to the hard-coded TEAM_MEMBERS and apply any
 *      per-member text overrides in `site_content`. This is the legacy
 *      path that worked before migration 0005.
 */
export function useTeamMembers(): TeamMember[] {
  const dbMembers = useDbTeamMembers()
  const content = useSiteContentMap()

  if (dbMembers && dbMembers.length > 0) {
    return dbMembers.map((m) => ({
      name: m.name,
      role: m.role,
      description: m.description ?? "",
      // Set both imagePath (legacy fallback if directImageUrl is ignored
      // anywhere) and directImageUrl (the field TeamMemberAvatar prefers,
      // bypassing the site_images registry that still holds the seeded
      // default photo). Without this the public site keeps showing
      // /placeholder-user.jpg even after the admin uploads via the
      // Team tab — `site_images['team.<slug>']` shadows the new DB url.
      imagePath: m.image_url ?? undefined,
      directImageUrl: m.image_url ?? undefined,
    }))
  }

  return TEAM_MEMBERS.map((member) => {
    const slug = slugFromImageId(teamImageId(member.name))
    return {
      ...member,
      name: resolveSiteText(content, `team.${slug}.name`, member.name),
      role: resolveSiteText(content, `team.${slug}.role`, member.role),
      description: resolveSiteText(
        content,
        `team.${slug}.description`,
        member.description,
      ),
    }
  })
}
