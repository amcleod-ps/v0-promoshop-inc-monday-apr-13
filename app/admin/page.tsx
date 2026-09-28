// /admin is the primary dashboard address. /admin-dashboard remains as the
// legacy address whose GET redirects here (see proxy.ts); the page itself is
// identical, so it is re-exported rather than duplicated.
export { metadata } from "../admin-dashboard/page"
export { default } from "../admin-dashboard/page"

export const dynamic = "force-dynamic"
