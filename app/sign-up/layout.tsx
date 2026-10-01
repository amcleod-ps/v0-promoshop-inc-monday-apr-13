import type { Metadata } from "next"
import type { ReactNode } from "react"

// The page itself is a client component and cannot export metadata;
// this segment layout carries it instead.
export const metadata: Metadata = {
  title: "Create an account",
  description: "Create an account to save your profile and see your sent quote requests.",
  // Thin utility page — keep it out of search results.
  robots: { index: false, follow: true },
}

export default function SignUpLayout({ children }: { children: ReactNode }) {
  return children
}
