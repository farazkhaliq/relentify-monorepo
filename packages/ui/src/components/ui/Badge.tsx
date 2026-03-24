
import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'destructive' | 'outline' | 'zinc';
}

export const Badge = ({ className, variant = 'default', ...props }: BadgeProps) => {
  const variants = {
    default: "bg-black/5 dark:bg-white/5 text-[var(--theme-text-muted)] border-transparent",
    zinc: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent",
    accent: "bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border-transparent",
    success: "bg-[var(--theme-success)]/10 text-[var(--theme-success)] border-transparent",
    warning: "bg-[var(--theme-warning)]/10 text-[var(--theme-warning)] border-transparent",
    destructive: "bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)] border-transparent",
    outline: "bg-transparent border-black/10 dark:border-white/10 text-[var(--theme-text-muted)]"
  };

  return (
    <div 
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
        variants[variant],
        className
      )} 
      {...props} 
    />
  );
};
