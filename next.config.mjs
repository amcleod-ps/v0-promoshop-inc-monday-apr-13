/** @type {import('next').NextConfig} */
// Next 16 moved ESLint configuration out of next.config.mjs — `pnpm lint`
// invokes `eslint .` directly via the npm-script in package.json, so there's
// nothing to gate here. The previous `eslint: { ignoreDuringBuilds: true }`
// block fired a deprecation warning on every dev start.
// Baseline security headers. Notes on the CSP:
//   * 'unsafe-inline' script/style is required by Next.js inline runtime
//     scripts and the server-rendered theme-override <style> tag (going
//     stricter needs a nonce pipeline — out of scope for a baseline).
//   * 'unsafe-eval' only in dev (React Refresh needs it).
//   * img-src allows any https host because content images are admin-edited
//     at runtime (Supabase Storage, squarespace-cdn, GitHub attachments, …).
//   * frame-ancestors 'none' + X-Frame-Options DENY block clickjacking,
//     which matters for the unauthenticated /admin-dashboard.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // No <object>/<embed>/<applet> plugins anywhere on the site — blocking them
  // closes a legacy script-execution vector that default-src doesn't fully
  // cover in older engines.
  "object-src 'none'",
  // Auto-upgrade any stray http:// subresource (e.g. an admin-pasted image
  // URL) to https:// instead of failing it as mixed content. img-src already
  // forbids plain http:, so this only ever helps. Production-only: in local
  // dev the site is served over http://localhost and upgrading same-origin
  // subresources to https would break the dev server.
  process.env.NODE_ENV === 'production' ? "upgrade-insecure-requests" : '',
].filter(Boolean).join('; ')

const nextConfig = {
  // Server Actions cap inbound request bodies at 1 MB by default. The
  // /admin-dashboard image uploader documents and validates a 10 MB content
  // limit; without this override Next.js silently rejects anything over
  // 1 MB and the user sees a generic "This page couldn't load" screen
  // instead of the friendly error from our action.
  //
  // The limit is 11 MB, deliberately ABOVE MAX_IMAGE_BYTES (10 MB): a Server
  // Action ships the file as multipart/form-data, so the encoded body is the
  // raw bytes PLUS boundary/header framing. At an exactly-10 MB limit a file at
  // the cap passes our size checks but its envelope tips the body over the
  // transport limit, falling through to the generic transport error our
  // validation exists to avoid. The 1 MB of headroom absorbs the envelope.
  experimental: {
    serverActions: {
      bodySizeLimit: '11mb',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Force HTTPS for two years (incl. subdomains). Vercel always serves
          // the site over TLS, so this only hardens against SSL-strip / downgrade
          // and accidental http:// links — it never locks out a reachable host.
          // Add `; preload` and submit to hstspreload.org once the custom domain
          // is final if you want it baked into browsers.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // Deny powerful browser APIs the site never uses, so injected/3rd-party
          // code can't silently reach them.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
          },
          // Isolate our top-level browsing context from cross-origin openers
          // (XS-Leaks / tab-nabbing hardening). `-allow-popups` keeps any future
          // popup-based flow working.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          // No Flash/Acrobat cross-domain policy files are served; say so explicitly.
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
    ]
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.squarespace-cdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'hebbkx1anhila5yf.public.blob.vercel-storage.com',
        pathname: '/**',
      },
      {
        // GitHub user-attachment images (brand logos, team photos uploaded
        // via issue/PR comments or the CMS upload flow).
        protocol: 'https',
        hostname: 'github.com',
        pathname: '/user-attachments/**',
      },
      {
        protocol: 'https',
        hostname: 'user-images.githubusercontent.com',
        pathname: '/**',
      },
      {
        // Supabase Storage — every image uploaded from /admin-dashboard
        // lands at <project-ref>.supabase.co/storage/v1/object/public/...
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
