"use client"

import { useSiteImageUrl } from "@/components/site-images-provider"

export function useImageSrc(id: string, fallback: string): string {
  return useSiteImageUrl(id, fallback)
}
