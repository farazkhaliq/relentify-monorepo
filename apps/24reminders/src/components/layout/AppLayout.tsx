'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';
import {
  NavShell,
  TopBar,
  TopBarLink,
  UserMenu,
  DropdownHeader,
  DropdownItem,
  DropdownSeparator,
  Logo
} from '@relentify/ui';
import { NAV_ITEMS } from '@/lib/navigation';

interface AppLayoutProps {
  user: any;
  children: React.ReactNode;
}

export function AppLayout({ user, children }: AppLayoutProps) {
  const pathname = usePathname();

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
              {NAV_ITEMS.map((item) => (
                <TopBarLink
                  key={item.name}
                  href={item.href}
                  active={pathname === item.href}
                >
                  {item.name}
                </TopBarLink>
              ))}
              <TopBarLink href="/dashboard/settings" active={pathname.startsWith('/dashboard/settings')} aria-label="Settings">
                <Settings size={14} />
              </TopBarLink>
            </>
          }
        >
          <div className="flex items-center gap-4">
            <UserMenu name={user.fullName.split(' ')[0]}>
              <DropdownHeader>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--theme-text-muted)] mb-1">Signed in as</p>
                <p className="text-sm font-bold truncate">{user.fullName}</p>
              </DropdownHeader>
              <div className="px-4 pt-3 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--theme-text-muted)]">Apps</p>
              </div>
              <DropdownItem href="https://accounting.relentify.com">Accounting</DropdownItem>
              <DropdownItem href="https://inventory.relentify.com">Property Inventories</DropdownItem>
              <DropdownItem href="https://crm.relentify.com">CRM</DropdownItem>
              <DropdownItem href="https://reminders.relentify.com">Reminders</DropdownItem>
              <DropdownSeparator />
              <DropdownItem href="/dashboard/settings">Settings</DropdownItem>
              <DropdownSeparator />
              <DropdownItem href="https://auth.relentify.com/api/auth/logout" variant="danger">Sign Out</DropdownItem>
            </UserMenu>
          </div>
        </TopBar>
      }
    >
      {children}
    </NavShell>
  );
}
