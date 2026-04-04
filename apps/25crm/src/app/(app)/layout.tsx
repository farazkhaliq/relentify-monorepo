import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Settings } from 'lucide-react';
import {
  NavShell,
  TopBar,
  TopBarLink,
  TopBarDropdown,
  Logo,
  UserMenu,
  DropdownHeader,
  DropdownItem,
  DropdownSeparator,
} from '@relentify/ui';
import { getAuthUser } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect('https://auth.relentify.com/login?redirect=https://crm.relentify.com/dashboard');

  const firstName = user.fullName?.split(' ')[0] || user.email.split('@')[0];

  const managementItems = [
    { label: 'Properties', href: '/properties' },
    { label: 'Tenancies', href: '/tenancies' },
    { label: 'Maintenance', href: '/maintenance' },
  ];

  const operationsItems = [
    { label: 'Inbox', href: '/inbox' },
    { label: 'Communications', href: '/communications' },
    { label: 'Tasks', href: '/tasks' },
    { label: 'Documents', href: '/documents' },
    { label: 'Transactions', href: '/transactions' },
    { label: 'Reports', href: '/reports' },
  ];

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
              <TopBarLink href="/dashboard">Dashboard</TopBarLink>
              <TopBarLink href="/contacts">Contacts</TopBarLink>
              <TopBarDropdown label="Management" items={managementItems} />
              <TopBarDropdown label="Operations" items={operationsItems} />
              <TopBarLink href="/audit-log">Audit Log</TopBarLink>
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
            </DropdownHeader>
            <div className="px-4 pt-3 pb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--theme-text-muted)]">Apps</p>
            </div>
            <DropdownItem href="https://accounting.relentify.com">Accounting</DropdownItem>
            <DropdownItem href="https://inventory.relentify.com">Property Inventories</DropdownItem>
            <DropdownItem href="https://crm.relentify.com">CRM</DropdownItem>
            <DropdownItem href="https://reminders.relentify.com">Reminders</DropdownItem>
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
  );
}
