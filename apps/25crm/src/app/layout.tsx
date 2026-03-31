import type {Metadata} from 'next';
import { Inter } from 'next/font/google'
import './globals.css';
import { Toaster, ThemeProvider, THEME_SCRIPT } from '@relentify/ui';
import { SharedAuthProvider } from '@/hooks/use-shared-auth';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' })

export const metadata: Metadata = {
  title: 'Relentify CRM',
  description: 'A modular, multi-tenant SaaS platform for lettings agencies.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} font-body antialiased`}>
        <ThemeProvider>
          <SharedAuthProvider>
            {children}
            <Toaster />
          </SharedAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
