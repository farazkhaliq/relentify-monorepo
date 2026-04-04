import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
  ThemeProvider,
  THEME_SCRIPT,
  RegionProvider,
  TopBar,
  TopBarLink,
  TopBarDropdown,
  Logo,
} from '@relentify/ui';
import type { TopBarDropdownItem } from '@relentify/ui';
import Link from 'next/link';
import RegionSwitcher from './components/RegionSwitcher';
import Footer from './components/Footer';
import Analytics from './components/Analytics';
import ChatWidget from './components/ChatWidget';
import CookieBanner from './components/CookieBanner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Relentify — Business Software Built for Growth',
  description:
    'Accounting, property inventories, CRM, and more. Built for small businesses that move fast.',
  icons: { icon: '/favicon.svg' },
};

const appItems: TopBarDropdownItem[] = [
  { label: 'Chat', href: '/chat' },
  { label: 'Connect', href: '/connect' },
  { label: 'Accounting', href: '/accounting' },
  { label: 'Property Inventories', href: '/inventory' },
  { label: 'CRM', href: '/crm' },
  { label: 'Reminders', href: '/reminders' },
  { label: 'Timesheets', href: '/timesheets' },
  { label: 'E-Sign', href: '/esign' },
  { label: 'Payroll & HR', href: '/payroll' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider initialPreset="B">
          <RegionProvider>
            <TopBar
              logo={
                <div className="flex items-center gap-4">
                  <Link href="/" className="no-underline flex items-center">
                    <Logo className="text-xl" iconClassName="w-6 h-6" />
                  </Link>
                  <RegionSwitcher />
                </div>
              }
              navLinks={
                <>
                  <TopBarDropdown label="Apps" items={appItems} />
                  <TopBarLink href="/pricing">Pricing</TopBarLink>
                  <TopBarLink href="/blog">Blog</TopBarLink>
                  <TopBarLink href="https://auth.relentify.com/login?redirect=https://relentify.com/portal">Login</TopBarLink>
                </>
              }
            />

            <main className="pt-24">{children}</main>

            <Footer />

            <Suspense fallback={null}>
              <Analytics />
            </Suspense>

            <ChatWidget />
            <CookieBanner />
          </RegionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
