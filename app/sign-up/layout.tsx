import type { Metadata } from "next"
import type { ReactNode } from "react"

// The page itself is a client component and cannot export metadata;
// this segment layout carries it instead.
export const metadata: Metadata = {
  title: "Save Quote Profile",
  description: "Save a browser-local PromoShop profile to streamline quote requests.",
  // Thin utility page — keep it out of search results.
  robots: { index: false, follow: true },
}

export default function SignUpLayout({ children }: { children: ReactNode }) {
  return children
}
