"use client"

import { TEAM_MEMBERS, type TeamMember } from "@/lib/cms/team"
import { resolveSiteText, useSiteContentMap } from "@/components/site-content-provider"
import { teamImageId } from "@/lib/image-registry"

function slugFromImageId(id: string): string {
  return id.replace(/^team\./, "")
}

/**
 * Returns the team roster, applying any per-member text overrides from the
 * `site_content` table (name, role, description) on top of the hard-coded
 * defaults in `lib/cms/team.ts`.
 *
 * Per-member content keys are derived from the slug of the original name
 * so renaming a person via the dashboard does not orphan the override.
 */
export function useTeamMembers(): TeamMember[] {
  const content = useSiteContentMap()
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
