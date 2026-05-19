import type { Metadata } from 'next'
import { Montserrat, Bebas_Neue, DM_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { QuoteProvider } from '@/lib/quote-context'
import { LocaleProvider } from '@/lib/locale-context'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import { ThemeVarsProvider } from '@/components/theme-vars-provider'
import { SiteImagesProvider } from '@/components/site-images-provider'
import { SiteContentProvider } from '@/components/site-content-provider'
import { getSiteImagesMap } from '@/lib/supabase/images'
import { getSiteContentMap } from '@/lib/supabase/content'
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
  title: 'PromoShop Inc | Promotional Products',
  description: 'Welcome to our store, where promoting your business is our business. Born from an expertise in building brands, we offer unique, quality promotional products, excellent service, and customer-focused marketing.',
  generator: 'v0.app',
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
  const [siteImages, siteContent] = await Promise.all([
    getSiteImagesMap(),
    getSiteContentMap(),
  ])

  return (
    <html lang="en" className={`bg-background ${montserrat.variable} ${bebasNeue.variable} ${dmSans.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground">
        <AuthProvider>
          <LocaleProvider>
            <QuoteProvider>
              <ThemeVarsProvider>
                <SiteImagesProvider value={siteImages}>
                  <SiteContentProvider value={siteContent}>
                    {children}
                  </SiteContentProvider>
                </SiteImagesProvider>
              </ThemeVarsProvider>
            </QuoteProvider>
          </LocaleProvider>
        </AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
