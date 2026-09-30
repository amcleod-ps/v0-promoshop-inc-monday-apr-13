import type { Metadata } from "next"

const version = "studio-20260930"
const iconPaths = new Set([
  "/favicon.ico",
  "/icon.svg",
  "/icon-light-32x32.png",
  "/icon-dark-32x32.png",
  "/apple-icon.png",
])

const icons = [
  { url: `/favicon.ico?v=${version}`, type: "image/x-icon", sizes: "16x16 32x32 48x48" },
  { url: `/icon-light-32x32.png?v=${version}`, type: "image/png", sizes: "32x32" },
  { url: `/icon.svg?v=${version}`, type: "image/svg+xml", sizes: "any" },
]
const apple = { url: `/apple-icon.png?v=${version}`, type: "image/png", sizes: "180x180" }

export const siteIcons: Metadata["icons"] = { icon: icons, apple: [apple] }
export const siteIconLinks = icons
  .map(({ url, type, sizes }) => `<link rel="icon" href="${url}" type="${type}" sizes="${sizes}">`)
  .join("") + `<link rel="apple-touch-icon" href="${apple.url}" sizes="${apple.sizes}">`

// Only these logo files have public access before sign-in.
export function isSiteIconRequest(pathname: string, method: string): boolean {
  return (method === "GET" || method === "HEAD") && iconPaths.has(pathname)
}
