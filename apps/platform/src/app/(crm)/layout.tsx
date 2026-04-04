import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings, MessageSquare, Ticket, BookOpen, BarChart3, Eye, Bot, Workflow, FileText, Headphones, Users, Home, Building, Wrench, FileBox, CreditCard, ClipboardList, ClipboardCheck, Archive } from 'lucide-react'
import {
  NavShell, TopBar, TopBarLink, TopBarDropdown, Logo, UserMenu,
  DropdownHeader, DropdownItem, DropdownSeparator,
} from '@relentify/ui'
import type { TopBarDropdownItem } from '@relentify/ui'
import { getAuthUser } from '@/lib/auth'
import { getProduct, PRODUCT_NAMES } from '@/lib/product-context'
import { canAccess } from '@/lib/feature-flags'

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const [user, product] = await Promise.all([getAuthUser(), getProduct()])
  if (!user) redirect(`https://auth.relentify.com/login?redirect=https://crm.relentify.com/dashboard`)
  if (!canAccess(product, 'contacts')) redirect('/inbox')

  const firstName = user.fullName?.split(' ')[0] || user.email.split('@')[0]

  const coreLinks = (
    <>
      <TopBarLink href="/dashboard">Dashboard</TopBarLink>
      <TopBarLink href="/inbox">Inbox</TopBarLink>
      <TopBarLink href="/tickets">Tickets</TopBarLink>
      <TopBarLink href="/knowledge">Knowledge Base</TopBarLink>
    </>
  )

  const connectItems: TopBarDropdownItem[] = [
    { label: 'Channels', href: '/channels' },
    { label: 'Bots', href: '/bots' },
    { label: 'Workflows', href: '/workflows' },
    { label: 'Templates', href: '/templates' },
  ]

  const crmItems: TopBarDropdownItem[] = [
    { label: 'Contacts', href: '/contacts' },
    { label: 'Properties', href: '/properties' },
    { label: 'Tenancies', href: '/tenancies' },
    { label: 'Maintenance', href: '/maintenance' },
  ]

  const crmOpsItems: TopBarDropdownItem[] = [
    { label: 'Tasks', href: '/tasks' },
    { label: 'Documents', href: '/documents' },
    { label: 'Transactions', href: '/transactions' },
    { label: 'Reports', href: '/reports' },
  ]

  return (
    <NavShell
      topbar={
        <TopBar
          logo={
            <Link href="/dashboard" className="no-underline flex items-center">
              <Logo className="text-lg" iconClassName="w-5 h-5" />
            </Link>
          }
          navLinks={
            <>
              {coreLinks}
              <TopBarDropdown label="Channels" items={connectItems} />
              <TopBarDropdown label="Management" items={crmItems} />
              <TopBarDropdown label="Operations" items={crmOpsItems} />
              <TopBarLink href="/analytics">Analytics</TopBarLink>
              <TopBarLink href="/settings" aria-label="Settings">
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
            <DropdownItem href="/settings">Settings</DropdownItem>
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
