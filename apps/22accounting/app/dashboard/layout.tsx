'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import {
  NavShell,
  TopBar,
  TopBarLink,
  TopBarDropdown,
  UserMenu,
  DropdownHeader,
  DropdownItem,
  DropdownSeparator,
  Logo,
} from '@relentify/ui';
import AccountantBanner from '@/app/components/AccountantBanner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState('Account');
  const [accountantCtx, setAccountantCtx] = useState<{ actorId: string; isAccountantAccess: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user?.email) {
          setUserName(data.user.email.split('@')[0]);
        }
        setAccountantCtx({
          actorId: data.actorId || '',
          isAccountantAccess: !!data.isAccountantAccess,
        });
      })
      .catch(() => {});
  }, []);

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));

  const salesItems = [
    { label: 'Invoices', href: '/dashboard/invoices' },
    { label: 'Quotes', href: '/dashboard/quotes' },
    { label: 'Customers', href: '/dashboard/customers' },
    { label: 'Credit Notes', href: '/dashboard/credit-notes' },
  ];

  const purchasesItems = [
    { label: 'Bills', href: '/dashboard/bills' },
    { label: 'Suppliers', href: '/dashboard/suppliers' },
    { label: 'Purchase Orders', href: '/dashboard/po' },
  ];

  const accountingItems = [
    { label: 'Journals', href: '/dashboard/journals' },
    { label: 'VAT', href: '/dashboard/vat' },
  ];

  const reportsItems = [
    { label: 'P&L', href: '/dashboard/reports/pl' },
    { label: 'Balance Sheet', href: '/dashboard/reports/balance-sheet' },
    { label: 'Aged Receivables', href: '/dashboard/reports/aged' },
    { label: 'Trial Balance', href: '/dashboard/reports/trial-balance' },
    { label: 'General Ledger', href: '/dashboard/reports/general-ledger' },
    { label: 'Custom Report', href: '/dashboard/reports/custom' },
    { label: 'Health Score', href: '/dashboard/reports/health' },
  ];

  const isSalesActive = salesItems.some(i => isActive(i.href));
  const isPurchasesActive = purchasesItems.some(i => isActive(i.href));
  const isAccountingActive = accountingItems.some(i => isActive(i.href));
  const isReportsActive = reportsItems.some(i => isActive(i.href));

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
                <TopBarDropdown
                  label="Sales"
                  items={salesItems}
                  active={isSalesActive}
                />
                <TopBarDropdown
                  label="Purchases"
                  items={purchasesItems}
                  active={isPurchasesActive}
                />
                <TopBarDropdown
                  label="Accounting"
                  items={accountingItems}
                  active={isAccountingActive}
                />
                <TopBarLink href="/dashboard/banking" active={isActive('/dashboard/banking')}>
                  Banking
                </TopBarLink>
                <TopBarLink href="/dashboard/projects" active={isActive('/dashboard/projects')}>
                  Projects
                </TopBarLink>
                <TopBarLink href="/dashboard/conversations" active={isActive('/dashboard/conversations')}>
                  Conversations
                </TopBarLink>
                <TopBarDropdown
                  label="Reports"
                  items={reportsItems}
                  active={isReportsActive}
                />
                <TopBarLink href="/dashboard/settings" active={isActive('/dashboard/settings')} aria-label="Settings">
                  <Settings size={14} />
                </TopBarLink>
              </>
            }
          >
            <UserMenu name={userName}>
              <DropdownHeader>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--theme-text-muted)] mb-1">Signed in as</p>
                <p className="text-sm font-bold truncate">{userName}</p>
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
          </TopBar>
        }
      >
        <>
          <AccountantBanner
            actorId={accountantCtx?.actorId || ''}
            isAccountantAccess={!!accountantCtx?.isAccountantAccess}
          />
          {children}
        </>
      </NavShell>
  );
}
