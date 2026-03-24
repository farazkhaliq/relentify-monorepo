
import React from 'react';
import { cn } from '../../lib/utils';

export const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="relative w-full overflow-auto">
    <table className={cn("w-full border-collapse text-sm", className)} {...props} />
  </div>
);

export const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn("border-b border-black/5 dark:border-white/5", className)} {...props} />
);

export const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
);

export const TableFooter = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tfoot className={cn("border-t border-black/5 dark:border-white/5 bg-white/5 font-medium [&>tr]:last:border-b-0", className)} {...props} />
);

export const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn(
      "border-b border-black/5 dark:border-white/5 transition-colors hover:bg-black/[0.01] dark:hover:bg-white/[0.01] data-[state=selected]:bg-black/[0.02] dark:data-[state=selected]:bg-white/[0.02]",
      className
    )}
    {...props}
  />
);

export const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      "h-12 px-6 text-left align-middle text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)]",
      className
    )}
    {...props}
  />
);

export const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn(
    "px-6 py-4 align-middle", 
    className
  )} {...props} />
);
