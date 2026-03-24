import type { Metadata } from 'next';
import { Suspense } from 'react';
import '@/src/styles/globals.css';
import { SEO, CONTACT_INFO } from '@/src/lib/constants';
import { THEME_SCRIPT, ThemeProvider } from '@relentify/ui';
import Analytics from '@/app/components/Analytics';

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
    type: 'website',
    url: SEO.url,
    title: SEO.title,
    description: SEO.description,
    locale: SEO.locale,
    images: [{ url: SEO.image, width: 1200, height: 630, alt: SEO.title }],
  },
  alternates: { canonical: SEO.url },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': ['Organization', 'LocalBusiness'],
              name: 'Relentify',
              description: SEO.description,
              url: SEO.url,
              email: CONTACT_INFO.email,
              address: CONTACT_INFO.address,
            }),
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-[var(--theme-background)] text-[var(--theme-text)] min-h-screen overflow-x-hidden selection:bg-[var(--theme-accent)]/30">
        <ThemeProvider initialPreset="B">
          {children}
          <Suspense>
            <Analytics />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
