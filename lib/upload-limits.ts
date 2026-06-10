// Shared between the server-side upload validator (lib/image-upload.ts) and
// the client-side pre-checks in the admin dashboard, so the two never drift.
// Must stay in sync with `serverActions.bodySizeLimit` in next.config.mjs.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB
