"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { SupabaseTeamMember } from "@/lib/supabase/team"

const TeamMembersContext = createContext<SupabaseTeamMember[] | null>(null)

export function TeamMembersProvider({
  value,
  children,
}: {
  // null = team_members unavailable (missing migration / env / outage), so
  // consumers fall back to the static roster. An empty array is a genuine
  // "no active members" answer and renders an empty roster.
  value: SupabaseTeamMember[] | null
  children: ReactNode
}) {
  return (
    <TeamMembersContext.Provider value={value}>
      {children}
    </TeamMembersContext.Provider>
  )
}

/**
 * Returns the Supabase-backed team roster, or `null` when the table is
 * unavailable so the caller can fall back to the static roster in
 * lib/cms/team.ts.
 */
export function useDbTeamMembers(): SupabaseTeamMember[] | null {
  return useContext(TeamMembersContext)
}
