// Open-redirect guard for post-auth navigation.
//
// `/sign-in` and `/sign-up` read a `?redirect=` query param and push the user
// there after "authenticating". Left unvalidated, an attacker can craft
// `/sign-in?redirect=https://evil.example` (or the protocol-relative
// `//evil.example`, or the backslash-tricked `/\evil.example` that browsers
// normalise to `//`) and bounce the victim off-site — a phishing vector.
//
// Allow only same-origin, root-relative paths: a single leading "/" that is
// not followed by another "/" or "\". Anything else falls back to a safe
// internal default.
export function toSafeRedirect(
  target: string | null | undefined,
  fallback = "/my-quote",
): string {
  if (!target) return fallback
  if (target[0] !== "/") return fallback // absolute URL / scheme / relative
  if (target[1] === "/" || target[1] === "\\") return fallback // protocol-relative
  return target
}
