'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

// Legacy pill-style tab nav (for 22accounting settings and similar)
interface TabNavOption {
  label: string | React.ReactNode;
  value: string;
}
interface TabsNavProps {
  options: TabNavOption[];
  selectedValue: string;
  onValueChange?: (value: string) => void;
  variant?: 'default' | 'cinematic';
  className?: string;
}
export function TabsNav({ options, selectedValue, onValueChange, variant = 'cinematic', className }: TabsNavProps) {
  return (
    <div className={cn(
      'relative flex items-center p-1 rounded-full',
      variant === 'cinematic'
        ? 'bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5'
        : 'bg-transparent border border-transparent',
      className
    )}>
      {options.map((option) => {
        const isActive = selectedValue === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onValueChange?.(option.value)}
            className={cn(
              'relative px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300',
              isActive ? 'text-white dark:text-black z-10' : 'text-[var(--theme-text-dim)] hover:text-[var(--theme-text)] z-10'
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeTabNav"
                className="absolute inset-0 bg-[var(--theme-primary)] dark:bg-white rounded-full -z-10"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-md bg-[var(--theme-border)] p-1 text-[var(--theme-text-muted)]',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-[var(--theme-background)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[var(--theme-card)] data-[state=active]:text-[var(--theme-text)] data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-[var(--theme-background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
