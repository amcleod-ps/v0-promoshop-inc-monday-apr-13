/** @type {import('next').NextConfig} */
// Next 16 moved ESLint configuration out of next.config.mjs — `pnpm lint`
// invokes `eslint .` directly via the npm-script in package.json, so there's
// nothing to gate here. The previous `eslint: { ignoreDuringBuilds: true }`
// block fired a deprecation warning on every dev start.
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
