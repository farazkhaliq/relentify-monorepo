

import React from 'react';
import { cn } from '../../lib/utils';

export function LogoIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        d="M25 20V80" 
        stroke="currentColor" 
        strokeWidth="12" 
        strokeLinecap="square" 
      />
      <path 
        d="M45 20V80" 
        stroke="currentColor" 
        strokeWidth="4" 
        strokeLinecap="square" 
        className="opacity-40"
      />
      <path 
        d="M25 20H65C76.0457 20 85 28.9543 85 40C85 51.0457 76.0457 60 65 60H25" 
        stroke="currentColor" 
        strokeWidth="12" 
        strokeLinecap="square" 
      />
      <path 
        d="M55 60L85 90" 
        stroke="var(--theme-accent)" 
        strokeWidth="12" 
        strokeLinecap="square" 
      />
    </svg>
  );
}

export function Logo({ className, iconClassName, showText = true }: { className?: string; iconClassName?: string; showText?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-3 text-xl font-bold tracking-tighter transition-colors group text-[var(--theme-text)]",
      className
    )}>
      <LogoIcon className={cn("w-6 h-6 group-hover:rotate-12 transition-transform duration-500", iconClassName)} />
      {showText && <span className="font-sans">RELENTIFY</span>}
    </div>
  );
}
