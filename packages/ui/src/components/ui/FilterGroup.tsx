'use client';

import React from 'react';
import { cn } from '../../lib/utils';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterGroupProps {
  options: FilterOption[];
  selectedValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function FilterGroup({ 
  options, 
  selectedValue, 
  onValueChange, 
  className 
}: FilterGroupProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {options.map((option) => {
        const isActive = selectedValue === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onValueChange?.(option.value)}
            className={cn(
              "px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all",
              isActive 
                ? "bg-black/5 dark:bg-white/5 text-[var(--theme-text)]" 
                : "text-[var(--theme-text-dim)] hover:text-[var(--theme-text)]"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
