/**
 * A CTA / link target is safe to render as an `href` only if it points at a
 * page on this site (a root-relative path) or an absolute http(s) URL. This
 * rejects `javascript:`, `data:`, `mailto:` typos, bare words, and
 * protocol-relative URLs — both `//host` and the `/\host` backslash variant,
 * which browsers normalize to `//host` (an off-site open-redirect). The
 * `(?![\/\\])` negative lookahead blocks both.
 *
 * Used on BOTH the dashboard write paths (createHeroSlide, updateHeroSlideText)
 * AND the public read path (getHeroSlides). The Supabase Table Editor is a
 * documented second editing path whose writes bypass the dashboard's server
 * actions, so the value must be re-validated on read — mirroring the
 * sanitize-on-read pattern in `lib/image-fit.ts` (normalizeImageFit) and
 * `lib/supabase/theme.ts` (safeThemeValue). React does NOT block a
 * `javascript:` href in production, so an unsanitized stored value would be a
 * clickable stored-XSS link on the public homepage.
 */
export function isSafeLinkTarget(value: string | null | undefined): boolean {
  if (!value) return false
  return /^(\/(?![/\\])|https?:\/\/)/i.test(value.trim())
}
