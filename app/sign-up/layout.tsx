import type { Metadata } from "next"
import type { ReactNode } from "react"

// The page itself is a client component and cannot export metadata;
// this segment layout carries it instead.
export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a PromoShop profile to streamline your quote requests.",
  // Thin utility page — keep it out of search results.
  robots: { index: false, follow: true },
}

export default function SignUpLayout({ children }: { children: ReactNode }) {
  return children
}
