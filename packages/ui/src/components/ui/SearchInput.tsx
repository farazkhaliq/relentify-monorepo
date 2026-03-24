'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'command';
  containerClassName?: string;
}

export function SearchInput({ 
  variant = 'default', 
  containerClassName, 
  className, 
  ...props 
}: SearchInputProps) {
  const isCommand = variant === 'command';

  return (
    <div className={cn(
      "relative flex items-center group transition-all duration-300",
      isCommand 
        ? "bg-black/[0.03] dark:bg-white/[0.03] border-b border-black/5 dark:border-white/5 focus-within:border-[var(--theme-accent)]" 
        : "bg-black/5 dark:bg-white/5 rounded-full px-4",
      containerClassName
    )}>
      <Search 
        size={14} 
        className={cn(
          "transition-colors",
          isCommand ? "ml-3 opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--theme-accent)]" : "opacity-40"
        )} 
      />
      
      <input
        {...props}
        className={cn(
          "flex-1 bg-transparent border-none outline-none py-2 px-3 text-[11px] font-mono tracking-wider text-[var(--theme-text)] placeholder:text-black/20 dark:placeholder:text-white/20",
          className
        )}
      />

      {isCommand && (
        <div className="mr-4 flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded border border-black/10 dark:border-white/10 text-[9px] font-bold opacity-40 uppercase tracking-tighter">
            ⌘K
          </kbd>
        </div>
      )}
    </div>
  );
}
