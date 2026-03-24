'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TopBarSearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

export function TopBarSearch({ containerClassName, className, ...props }: TopBarSearchProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-0.5 border-b border-black/5 dark:border-white/5 w-full max-w-[240px] transition-all focus-within:border-[var(--theme-accent)] group",
      containerClassName
    )}>
      <Search 
        size={10} 
        className="text-black/20 dark:text-white/20 group-focus-within:text-[var(--theme-accent)] transition-colors" 
      />
      <input 
        {...props}
        className={cn(
          "bg-transparent border-none outline-none text-[10px] font-mono tracking-wider text-[var(--theme-text)] placeholder:text-black/20 dark:placeholder:text-white/20 w-full",
          className
        )}
      />
    </div>
  );
}
