// Shared between the server-side upload validator (lib/image-upload.ts) and
// the client-side pre-checks in the admin dashboard, so the two never drift.
// `serverActions.bodySizeLimit` in next.config.mjs must stay slightly LARGER
// than this content cap (it is 11 MB) so the multipart/form-data envelope
// around a 10 MB file doesn't tip the request over the transport limit.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB
