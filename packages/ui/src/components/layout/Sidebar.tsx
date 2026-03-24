'use client';

import React from 'react';
import { cn } from '../../lib/utils';

interface SidebarProps {
  children: React.ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Sidebar({ 
  children, 
  isOpen = false, 
  onClose, 
  className,
  header,
  footer
}: SidebarProps) {
  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 w-64 bg-[var(--theme-background)]/80 backdrop-blur-xl flex flex-col flex-shrink-0",
      "border-r border-[var(--theme-border)]",
      "transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:z-auto",
      isOpen ? "translate-x-0" : "-translate-x-full",
      className
    )}>
      {header && (
        <div className="px-8 py-8 border-b border-[var(--theme-border)] flex items-center justify-between">
          {header}
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto px-4 py-8 text-[var(--theme-text)]">
        {children}
      </div>

      {footer && (
        <div className="px-8 py-6 border-t border-[var(--theme-border)]">
          {footer}
        </div>
      )}
    </aside>
  );
}

export function SidebarItem({ 
  children, 
  active = false, 
  icon: Icon,
  onClick,
  className
}: { 
  children: React.ReactNode; 
  active?: boolean;
  icon?: any;
  onClick?: () => void; 
  className?: string;
}) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer magnetic-btn",
        active 
          ? "bg-[var(--theme-accent)] text-white shadow-lg shadow-[var(--theme-accent)]/20" 
          : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5",
        className
      )}
    >
      {Icon && <Icon size={16} />}
      {children}
    </div>
  );
}
