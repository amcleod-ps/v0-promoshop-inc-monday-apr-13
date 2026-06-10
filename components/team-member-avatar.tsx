"use client"

import Image from "next/image"
import type { TeamMember } from "@/lib/cms/team"
import { SiteImage } from "@/components/site-image"
import { teamImageId } from "@/lib/image-registry"
import { useImageSrc } from "@/hooks/use-image-src"

interface TeamMemberAvatarProps {
  member: TeamMember
  size: number
}

export function TeamMemberAvatar({ member, size }: TeamMemberAvatarProps) {
  // useImageSrc must be called unconditionally to satisfy the rules of
  // hooks. We always compute the legacy-registry src up front, then
  // pick between it and `directImageUrl` after. `directImageUrl` is
  // set by useTeamMembers when this row came from the Supabase
  // `team_members` table; without taking precedence over the registry
  // a Team-tab photo upload would be shadowed by the seeded
  // /placeholder-user.jpg in site_images['team.<slug>'].
  //
  // Key on the member's stable slug when available — the display name
  // can be overridden/renamed, which would otherwise re-derive a
  // different registry key and orphan the photo.
  const id = teamImageId(member.slug ?? member.name)
  const legacySrc = useImageSrc(id, member.imagePath ?? "")
  const directSrc = member.directImageUrl ?? ""

  if (directSrc) {
    return (
      // alt="": the member's name is printed directly beside the photo, so
      // naming the image too would double-announce it to screen readers.
      <Image
        src={directSrc}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="w-full h-full object-cover rounded-full"
      />
    )
  }

  if (legacySrc) {
    return (
      <SiteImage
        imageId={id}
        defaultSrc={member.imagePath ?? ""}
        alt=""
        width={size}
        height={size}
        className="w-full h-full object-cover rounded-full"
      />
    )
  }

  return (
    <span className="font-montserrat font-bold text-2xl text-[#ef473f]">
      {member.name
        .split(" ")
        .map((n) => n[0])
        .join("")}
    </span>
  )
}
