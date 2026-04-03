import type { Metadata } from 'next'
import '@/src/styles/globals.css'
import { THEME_SCRIPT, ThemeProvider } from '@relentify/ui'

export const metadata: Metadata = {
  title: 'Relentify Timesheets',
  description: 'GPS-verified mobile timesheets for field staff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-[var(--theme-background)] text-[var(--theme-text)] min-h-screen overflow-x-hidden selection:bg-[var(--theme-accent)]/30">
        <ThemeProvider initialPreset="B">
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
