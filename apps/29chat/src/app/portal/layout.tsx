import '../globals.css'
import { ThemeProvider, THEME_SCRIPT, Toaster } from '@relentify/ui'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-body' })

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} font-body antialiased`}>
      {children}
    </div>
  )
}
