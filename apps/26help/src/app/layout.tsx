import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import { Analytics } from '@/components/Analytics'
import { THEME_SCRIPT, ThemeProvider, TopBar, TopBarLink, Logo, Footer, MotionProvider } from '@relentify/ui'

export const metadata: Metadata = {
  title: { template: '%s — Relentify Help', default: 'Relentify Help' },
  description: 'Guides and documentation for Relentify accounting software.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-[var(--theme-background)] text-[var(--theme-text)] min-h-screen overflow-x-hidden">
        <ThemeProvider initialPreset="B">
          <MotionProvider>
            <Analytics />
            <TopBar
              logo={
                <Link href="/" className="no-underline flex items-center">
                  <Logo className="text-lg" iconClassName="w-5 h-5" />
                </Link>
              }
              navLinks={
                <TopBarLink href="https://accounting.relentify.com">
                  Back to app
                </TopBarLink>
              }
            />
            <main className="max-w-4xl mx-auto px-6 pt-32 pb-10">
              {children}
            </main>
            <Footer />
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
