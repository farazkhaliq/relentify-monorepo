'use client';

import React from 'react';
import { cn } from '../../lib/utils';

interface NavShellProps {
  sidebar?: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
  sidebarOpen?: boolean;
  setSidebarOpen?: (o: boolean) => void;
  className?: string;
  containerClassName?: string;
  compact?: boolean;
}

export function NavShell({ 
  sidebar, 
  topbar, 
  children, 
  sidebarOpen = false, 
  setSidebarOpen,
  className,
  containerClassName,
  compact = false
}: NavShellProps) {
  return (
    <div className={cn(
      "flex h-screen w-full overflow-hidden bg-[var(--theme-background)] transition-colors duration-700",
      className
    )}>
      {/* Mobile overlay - only rendered if sidebar is present */}
      {sidebar && sidebarOpen && setSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden animate-in fade-in duration-500"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Optional Sidebar */}
      {sidebar}
      
      <div className="flex-1 flex flex-col min-w-0 relative h-screen overflow-hidden">
        {/* The Floating TopBar (Fixed positioning is handled inside the TopBar component) */}
        {topbar}
        
        {/* 
          Main Content Area 
          Single scroll point, stable gutter to prevent layout shift 
        */}
        <main className={cn(
          "flex-1 overflow-y-auto scrollbar-gutter-stable custom-scrollbar pb-20",
          compact ? "pt-24" : "pt-40"
        )}>
          <div className={cn(
            "px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full", 
            containerClassName
          )}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
