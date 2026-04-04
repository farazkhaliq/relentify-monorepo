import type { Metadata } from 'next'
import '@/styles/globals.css'
import { ThemeProvider, NoiseOverlay } from '@relentify/ui'

export const metadata: Metadata = {
  title: 'Relentify Sign — Digital Signature Service',
  description: 'Legally binding digital signatures with tamper-evident audit trails. Compliant with UK ECA 2000, eIDAS, and ESIGN Act.',
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
