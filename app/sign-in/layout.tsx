import type { Metadata } from "next"
import type { ReactNode } from "react"

// The page itself is a client component and cannot export metadata;
// this segment layout carries it instead.
export const metadata: Metadata = {
  title: "Continue with Saved Profile",
  description: "Use a browser-saved PromoShop quote profile to auto-fill your information.",
  // Thin utility page — keep it out of search results.
  robots: { index: false, follow: true },
}

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children
}
