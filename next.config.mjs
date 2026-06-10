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
].join('; ')

const nextConfig = {
  // Server Actions cap inbound request bodies at 1 MB by default. The
  // /admin-dashboard image uploader documents and validates a 10 MB
  // limit; without this override Next.js silently rejects anything over
  // 1 MB and the user sees a generic "This page couldn't load" screen
  // instead of the friendly error from our action.
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
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
