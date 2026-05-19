"use client"

import { useTeamMembers } from "@/hooks/use-team-members"
import { TeamMemberAvatar } from "@/components/team-member-avatar"
import { useSiteText } from "@/components/site-content-provider"

/**
 * Team grid rendered on /about. Uses the useTeamMembers() hook so the
 * admin dashboard's text overrides (name, role, description per member)
 * and the section-level heading overrides show up live.
 */
export function TeamSection() {
  const members = useTeamMembers()
  const heading = useSiteText("team.section.heading", "Meet Our Team")
  const subheading = useSiteText(
    "team.section.subheading",
    "These industry experts will ensure your promotions shine.",
  )

  return (
    <section className="py-16 lg:py-20 px-6 lg:px-8 bg-[#111111]">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <h2 className="font-montserrat font-bold text-2xl lg:text-3xl text-white mb-3">
            {heading}
          </h2>
          <p className="text-[#888] font-visby max-w-xl mx-auto">
            {subheading}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {members.map((member) => (
            <div key={member.name} className="text-center group">
              <div className="w-28 h-28 mx-auto mb-4 rounded-full bg-[#1a1a1a] flex items-center justify-center border-2 border-[#333] group-hover:border-[#ef473f] transition-colors overflow-hidden">
                <TeamMemberAvatar member={member} size={112} />
              </div>
              <h3 className="font-montserrat font-bold text-sm text-white">{member.name}</h3>
              <p className="text-xs text-[#ef473f] font-bold uppercase tracking-wider mt-1">{member.role}</p>
              {member.description && (
                <p className="text-xs text-[#888] font-visby mt-2 leading-snug">{member.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
