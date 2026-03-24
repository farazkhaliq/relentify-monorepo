'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserNav } from '@/components/user-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@relentify/ui';
import { LayoutDashboard, Wrench, Landmark, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortalUserProfile } from '@/hooks/use-portal-user-profile';
import { doc } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';

const PortalNavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const pathname = usePathname();
    const isActive = pathname.startsWith(href);
    return (
        <Button asChild variant={isActive ? "secondary" : "ghost"} className="justify-start">
            <Link href={href}>
                {children}
            </Link>
        </Button>
    )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    const { portalUserProfile } = usePortalUserProfile();
    const firestore = useFirestore();

    const contactRef = useMemoFirebase(() => {
        if (!firestore || !portalUserProfile) return null;
        return doc(firestore, `organizations/${portalUserProfile.organizationId}/contacts`, portalUserProfile.contactId);
    }, [firestore, portalUserProfile]);
    const { data: contact } = useDoc<any>(contactRef);
    const isTenant = contact?.contactType === 'Tenant';
    const isLandlord = contact?.contactType === 'Landlord';

  return (
    <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
            <h1 className="text-xl font-bold">Relentify Portal</h1>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <UserNav />
            </div>
        </header>
        <div className="flex flex-1">
            <aside className="hidden md:flex w-64 flex-col border-r bg-background p-4">
                <nav className="flex flex-col gap-2">
                    <PortalNavLink href="/portal/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</PortalNavLink>
                    {isTenant && <PortalNavLink href="/portal/maintenance"><Wrench className="mr-2 h-4 w-4" />Maintenance</PortalNavLink>}
                    {isLandlord && <PortalNavLink href="/portal/financials"><Landmark className="mr-2 h-4 w-4" />Financials</PortalNavLink>}
                    {isLandlord && <PortalNavLink href="/portal/documents"><File className="mr-2 h-4 w-4" />Documents</PortalNavLink>}
                </nav>
            </aside>
            <main className="flex flex-1 items-start justify-center bg-muted/40 p-4 sm:p-6">
                {children}
            </main>
        </div>
    </div>
  );
}
