import type { Metadata } from 'next'
import { Suspense } from 'react'
import '@/src/styles/globals.css'
import { THEME_SCRIPT, ThemeProvider } from '@relentify/ui'
import Analytics from '@/src/components/Analytics'

export const metadata: Metadata = {
  title: 'Relentify — Sign In',
  description: 'Sign in to your Relentify account',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased font-sans">
        <ThemeProvider initialPreset="B">
          <Suspense fallback={null}><Analytics /></Suspense>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
