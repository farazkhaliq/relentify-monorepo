import type { Metadata } from 'next'
import '@/styles/globals.css'
import { SEO } from '@/lib/constants'
import { ThemeProvider, NoiseOverlay } from '@relentify/ui'

export const metadata: Metadata = {
  title: SEO.title,
  description: SEO.description,
  keywords: SEO.keywords,
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: SEO.title,
    description: SEO.description,
    url: SEO.url,
    images: [SEO.image],
    locale: SEO.locale,
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased font-sans transition-colors duration-700">
        <ThemeProvider initialPreset="B">
          <NoiseOverlay />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
