'use client';

import React from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  supertitle?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  supertitle,
  title,
  description,
  actions,
  className
}) => {
  const isDominantHeader = supertitle === 'RELENTIFY PROPERTY INVENTORIES';

  return (
    <div className={cn(
      "mb-12 flex flex-col gap-6",
      isDominantHeader && "pt-8",
      className
    )}>
      {supertitle && (
        <p className={cn(
          "uppercase tracking-[0.3em] font-bold text-[var(--theme-accent)]",
          isDominantHeader ? "text-xs md:text-sm" : "text-[0.7rem]"
        )}>
          {supertitle}
        </p>
      )}
      <div className="flex items-center justify-between gap-4">
        <div>
          {!isDominantHeader && (
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-[var(--theme-text)]">
              {title}
            </h1>
          )}
          {description && <div className="mt-1">{description}</div>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
};
