import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Settings } from 'lucide-react';
import {
  NavShell, TopBar, TopBarLink, TopBarDropdown, Logo, UserMenu,
  DropdownHeader, DropdownItem, DropdownSeparator,
} from '@relentify/ui';
import type { TopBarDropdownItem } from '@relentify/ui';
import { getAuthUser } from '@/lib/auth';
import { getProduct, PRODUCT_NAMES } from '@/lib/product-context';
import { canAccess } from '@/lib/feature-flags';

export default async function ConnectLayout({ children }: { children: React.ReactNode }) {
  const [user, product] = await Promise.all([getAuthUser(), getProduct()]);
  if (!user) redirect(`https://auth.relentify.com/login?redirect=https://${product === 'crm' ? 'crm' : product === 'connect' ? 'connect' : 'chat'}.relentify.com/inbox`);

  // Connect routes require channels access (connect + crm only)
  if (!canAccess(product, 'channels')) {
    redirect('/inbox');
  }

  const firstName = user.fullName?.split(' ')[0] || user.email.split('@')[0];

  // Build nav links based on product (same as shared layout)
  const coreLinks = (
    <>
      <TopBarLink href="/inbox">Inbox</TopBarLink>
      <TopBarLink href="/tickets">Tickets</TopBarLink>
      <TopBarLink href="/knowledge">Knowledge Base</TopBarLink>
    </>
  );

  const connectItems: TopBarDropdownItem[] = [];
  if (canAccess(product, 'channels')) connectItems.push({ label: 'Channels', href: '/channels' });
  if (canAccess(product, 'bots')) connectItems.push({ label: 'Bots', href: '/bots' });
  if (canAccess(product, 'workflows')) connectItems.push({ label: 'Workflows', href: '/workflows' });
  if (canAccess(product, 'templates')) connectItems.push({ label: 'Templates', href: '/templates' });

  const crmItems: TopBarDropdownItem[] = [];
  if (canAccess(product, 'contacts')) crmItems.push({ label: 'Contacts', href: '/contacts' });
  if (canAccess(product, 'properties')) crmItems.push({ label: 'Properties', href: '/properties' });
  if (canAccess(product, 'tenancies')) crmItems.push({ label: 'Tenancies', href: '/tenancies' });
  if (canAccess(product, 'maintenance')) crmItems.push({ label: 'Maintenance', href: '/maintenance' });

  const crmOpsItems: TopBarDropdownItem[] = [];
  if (canAccess(product, 'tasks')) crmOpsItems.push({ label: 'Tasks', href: '/tasks' });
  if (canAccess(product, 'documents')) crmOpsItems.push({ label: 'Documents', href: '/documents' });
  if (canAccess(product, 'transactions')) crmOpsItems.push({ label: 'Transactions', href: '/transactions' });
  if (canAccess(product, 'reports')) crmOpsItems.push({ label: 'Reports', href: '/reports' });

  return (
    <NavShell
      topbar={
        <TopBar
          logo={
            <Link href={product === 'crm' ? '/dashboard' : '/inbox'} className="no-underline flex items-center">
              <Logo className="text-lg" iconClassName="w-5 h-5" />
            </Link>
          }
          navLinks={
            <>
              {product === 'crm' && <TopBarLink href="/dashboard">Dashboard</TopBarLink>}
              {coreLinks}
              {connectItems.length > 0 && <TopBarDropdown label="Channels" items={connectItems} />}
              {crmItems.length > 0 && <TopBarDropdown label="Management" items={crmItems} />}
              {crmOpsItems.length > 0 && <TopBarDropdown label="Operations" items={crmOpsItems} />}
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
  );
}
