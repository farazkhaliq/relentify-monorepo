'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Home } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';
import { cn } from '@/lib/utils';
import { Button } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';

export function AppSidebarHeader() {
  const { organization, isLoading } = useOrganization();

  if (isLoading) {
    return (
        <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-6 w-24" />
        </div>
    )
  }

  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2.5 font-semibold text-lg text-sidebar-foreground hover:text-[var(--theme-text)] transition-colors duration-200"
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-9 bg-primary text-primary-foreground rounded-lg flex-shrink-0"
      >
        {organization?.logoUrl ? (
            <Image
                src={organization.logoUrl}
                alt={`${organization.name || 'Organization'} logo`}
                width={24}
                height={24}
                className="rounded-sm object-contain"
            />
        ) : (
            <Home className="size-5" />
        )}
      </Button>
      <span
        className={cn(
          'duration-200 transition-[opacity,transform] ease-in-out truncate',
          'group-data-[collapsible=icon]/sidebar:opacity-0 group-data-[collapsible=icon]/sidebar:-translate-x-4'
        )}
      >
        {organization?.name || 'Relentify'}
      </span>
    </Link>
  );
}
