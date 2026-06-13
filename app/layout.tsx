import type { Metadata } from 'next'
import { Montserrat, Bebas_Neue, DM_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { QuoteProvider } from '@/lib/quote-context'
import { LocaleProvider } from '@/lib/locale-context'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import { SiteImagesProvider } from '@/components/site-images-provider'
import { SiteContentProvider } from '@/components/site-content-provider'
import { TeamMembersProvider } from '@/components/team-provider'
import { getSiteImagesMap } from '@/lib/supabase/images'
import { getSiteContentMap } from '@/lib/supabase/content'
import { getTeamMembers } from '@/lib/supabase/team'
import { getSiteThemeMap, themeOverrideCss } from '@/lib/supabase/theme'
import { SITE_URL } from '@/lib/site-url'
import './globals.css'

// Force every page render to fetch fresh data so URL changes made in the
// Supabase Table Editor are visible on the next request.
export const dynamic = 'force-dynamic'

const montserrat = Montserrat({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-montserrat'
})

const bebasNeue = Bebas_Neue({ 
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas'
})

const dmSans = DM_Sans({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-dm-sans'
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'PromoShop Inc | Promotional Products',
    template: '%s | PromoShop Inc',
  },
  description: 'Welcome to our store, where promoting your business is our business. Born from an expertise in building brands, we offer unique, quality promotional products, excellent service, and customer-focused marketing.',
  alternates: { canonical: './' },
  openGraph: {
    siteName: 'PromoShop Inc',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [siteImages, siteContent, teamMembers, siteTheme] = await Promise.all([
    getSiteImagesMap(),
    getSiteContentMap(),
    getTeamMembers(),
    getSiteThemeMap(),
  ])
  const overrideCss = themeOverrideCss(siteTheme)

  return (
    <html lang="en" className={`bg-background ${montserrat.variable} ${bebasNeue.variable} ${dmSans.variable}`}>
      <head>
        {/* Server-rendered theme override. Lives in <head> so the admin's
            colour choices apply before any utility class paints, avoiding
            a flash of the original palette. */}
        <style id="site-theme-override" dangerouslySetInnerHTML={{ __html: overrideCss }} />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:text-[#1a1a1a] focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:outline focus:outline-2 focus:outline-[#1a1a1a]"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <LocaleProvider>
            <QuoteProvider>
              <SiteImagesProvider value={siteImages}>
                <SiteContentProvider value={siteContent}>
                  <TeamMembersProvider value={teamMembers}>
                    {children}
                  </TeamMembersProvider>
                </SiteContentProvider>
              </SiteImagesProvider>
            </QuoteProvider>
          </LocaleProvider>
        </AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
