import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Settings, Bot, Workflow, FileText, BarChart3 } from 'lucide-react';
import {
  NavShell, TopBar, TopBarLink, Logo, UserMenu,
  DropdownHeader, DropdownItem, DropdownSeparator,
} from '@relentify/ui';
import { getAuthUser } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect('https://auth.relentify.com/login?redirect=https://connect.relentify.com/inbox');

  const firstName = user.fullName?.split(' ')[0] || user.email.split('@')[0];

  return (
    <NavShell
      topbar={
        <TopBar
          logo={
            <Link href="/inbox" className="no-underline flex items-center">
              <Logo className="text-lg" iconClassName="w-5 h-5" />
            </Link>
          }
          navLinks={
            <>
              <TopBarLink href="/inbox">Inbox</TopBarLink>
              <TopBarLink href="/contacts">Contacts</TopBarLink>
              <TopBarLink href="/bots">Bots</TopBarLink>
              <TopBarLink href="/workflows">Workflows</TopBarLink>
              <TopBarLink href="/templates">Templates</TopBarLink>
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
            </DropdownHeader>
            <div className="px-4 pt-3 pb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--theme-text-muted)]">Apps</p>
            </div>
            <DropdownItem href="https://accounting.relentify.com">Accounting</DropdownItem>
            <DropdownItem href="https://crm.relentify.com">CRM</DropdownItem>
            <DropdownItem href="https://chat.relentify.com">Chat</DropdownItem>
            <DropdownItem href="https://connect.relentify.com">Connect</DropdownItem>
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
