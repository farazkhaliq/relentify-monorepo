'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@relentify/ui'
import { LayoutDashboard, Wrench, Landmark, File, LogOut } from 'lucide-react'
import { usePortalUserProfile } from '@/hooks/use-portal-user-profile'

const PortalNavLink = ({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) => {
  const pathname = usePathname()
  const isActive = pathname.startsWith(href)
  return (
    <Button
      asChild
      variant={isActive ? 'secondary' : 'ghost'}
      className="justify-start"
    >
      <Link href={href}>{children}</Link>
    </Button>
  )
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { portalUserProfile } = usePortalUserProfile()

  // Don't render nav shell on login/signup
  const isAuthPage = pathname === '/portal/login' || pathname === '/portal/signup'
  if (isAuthPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        {children}
      </div>
    )
  }

  const isTenant = portalUserProfile?.role === 'Tenant'
  const isLandlord = portalUserProfile?.role === 'Landlord'

  const handleLogout = async () => {
    await fetch('/api/portal/auth/me', { method: 'DELETE' })
    router.push('/portal/login')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <h1 className="text-xl font-bold">Relentify Portal</h1>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {portalUserProfile && (
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden md:flex w-64 flex-col border-r bg-background p-4">
          <nav className="flex flex-col gap-2">
            <PortalNavLink href="/portal/dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </PortalNavLink>
            {isTenant && (
              <PortalNavLink href="/portal/maintenance">
                <Wrench className="mr-2 h-4 w-4" />
                Maintenance
              </PortalNavLink>
            )}
            {isLandlord && (
              <PortalNavLink href="/portal/financials">
                <Landmark className="mr-2 h-4 w-4" />
                Financials
              </PortalNavLink>
            )}
            {isLandlord && (
              <PortalNavLink href="/portal/documents">
                <File className="mr-2 h-4 w-4" />
                Documents
              </PortalNavLink>
            )}
          </nav>
        </aside>
        <main className="flex flex-1 items-start justify-center bg-muted/40 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
