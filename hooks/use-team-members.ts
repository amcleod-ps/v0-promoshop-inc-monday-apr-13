"use client"

import { TEAM_MEMBERS, type TeamMember } from "@/lib/cms/team"

export function useTeamMembers(): TeamMember[] {
  return TEAM_MEMBERS
}
