import type { Metadata } from "next"
import type { ReactNode } from "react"

// The page itself is a client component and cannot export metadata;
// this segment layout carries it instead.
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to see your profile and sent quote requests.",
  // Thin utility page — keep it out of search results.
  robots: { index: false, follow: true },
}

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children
}
