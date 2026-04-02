import { NavShell, TopBar, TopBarLink, UserMenu, DropdownHeader, DropdownItem, DropdownSeparator, Logo } from '@relentify/ui'
import { getAuthUser } from '@/lib/auth'
import Link from 'next/link'
import { headers } from 'next/headers'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  const firstName = user?.fullName?.split(' ')[0] || 'Account'

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || '/'

  return (
    <NavShell
      compact={true}
      topbar={
        <TopBar
          logo={
            <Link href="/" className="no-underline flex items-center">
              <Logo className="text-lg" iconClassName="w-5 h-5" />
            </Link>
          }
          navLinks={
            <TopBarLink href="/" active={pathname === '/' || pathname === ''}>
              Dashboard
            </TopBarLink>
          }
        >
          <div className="flex items-center gap-4">
            <UserMenu name={firstName}>
              <DropdownHeader>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--theme-text-muted)] mb-1">Signed in as</p>
                <p className="text-sm font-bold text-[var(--theme-text)] truncate">{firstName}</p>
              </DropdownHeader>
              <div className="px-4 pt-3 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--theme-text-muted)]">Apps</p>
              </div>
              <DropdownItem href="https://accounting.relentify.com">Accounting</DropdownItem>
              <DropdownItem href="https://inventory.relentify.com">Property Inventories</DropdownItem>
              <DropdownItem href="https://esign.relentify.com">E-Sign</DropdownItem>
              <DropdownItem href="https://crm.relentify.com">CRM</DropdownItem>
              <DropdownItem href="https://reminders.relentify.com">Reminders</DropdownItem>
              <DropdownSeparator />
              <DropdownItem href="https://auth.relentify.com/api/auth/logout" variant="danger">Sign Out</DropdownItem>
            </UserMenu>
          </div>
        </TopBar>
      }
    >
      <div className="pt-20">
        {children}
      </div>
    </NavShell>
  )
}
