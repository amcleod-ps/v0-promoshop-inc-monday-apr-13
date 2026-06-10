/**
 * Shared text-override resolver — the single definition consumed by both
 * the server path (`lib/supabase/content.ts`) and the client path
 * (`components/site-content-provider.tsx`). The override wins only when it
 * exists and is non-empty; an admin clearing a value falls back to the
 * compiled-in copy. Pure module: no "use client", no server imports.
 */
export function resolveSiteText(
  map: Record<string, { value: string } | undefined>,
  key: string,
  fallback: string,
): string {
  const row = map[key]
  if (row && row.value && row.value.length > 0) return row.value
  return fallback
}
