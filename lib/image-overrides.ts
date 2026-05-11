"use client"

export const IMAGE_OVERRIDES_STORAGE_KEY = "promoshop_image_overrides_v1"
export const IMAGE_OVERRIDES_EVENT = "promoshop:image-overrides-changed"

export type ImageOverrides = Record<string, string>

export function getAllOverrides(): ImageOverrides {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(IMAGE_OVERRIDES_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: ImageOverrides = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.length > 0) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}
