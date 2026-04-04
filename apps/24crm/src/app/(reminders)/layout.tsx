import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Settings, LayoutDashboard, Zap, History } from 'lucide-react'
import {
  NavShell, TopBar, TopBarLink, Logo, UserMenu,
  DropdownHeader, DropdownItem, DropdownSeparator,
} from '@relentify/ui'
import { getAuthUser } from '@/lib/auth'
import { getProduct, PRODUCT_NAMES } from '@/lib/product-context'

export default async function RemindersLayout({ children }: { children: React.ReactNode }) {
  const [user, product] = await Promise.all([getAuthUser(), getProduct()])
  if (!user) redirect(`https://auth.relentify.com/login?redirect=https://reminders.relentify.com/dashboard`)

  const firstName = user.fullName?.split(' ')[0] || user.email.split('@')[0]

  return (
    <NavShell
      topbar={
        <TopBar
          logo={
            <Link href="/my-tasks" className="no-underline flex items-center">
              <Logo className="text-lg" iconClassName="w-5 h-5" />
            </Link>
          }
          navLinks={
            <>
              <TopBarLink href="/my-tasks">My Tasks</TopBarLink>
              <TopBarLink href="/momentum">Momentum</TopBarLink>
              <TopBarLink href="/activity">Activity</TopBarLink>
              <TopBarLink href="/reminders-settings" aria-label="Settings">
                <Settings size={14} />
              </TopBarLink>
            </>
          }
        >
          <UserMenu name={firstName}>
            <DropdownHeader>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--theme-text-muted)] mb-1">Signed in as</p>
              <p className="text-sm font-bold truncate">{firstName}</p>
              <p className="text-[10px] text-[var(--theme-text-dim)] mt-0.5">{PRODUCT_NAMES[product]}</p>
            </DropdownHeader>
            <DropdownSeparator />
            <DropdownItem href="/reminders-settings">Settings</DropdownItem>
            <DropdownSeparator />
            <DropdownItem href="https://auth.relentify.com/api/auth/logout" variant="danger">Sign Out</DropdownItem>
          </UserMenu>
        </TopBar>
      }
    >
      <div className="p-4 sm:p-6">
        {children}
      </div>
    </NavShell>
  )
}
