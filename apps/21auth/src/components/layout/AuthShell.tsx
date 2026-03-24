'use client';

import React from 'react';
import { ThemeToggleButton, NoiseOverlay, cn } from '@relentify/ui';

interface AuthShellProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
  showThemeToggle?: boolean;
}

export function AuthShell({ 
  children, 
  className, 
  maxWidth = "max-w-md",
  showThemeToggle = true 
}: AuthShellProps) {
  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center px-4 py-16 relative overflow-hidden transition-colors duration-700 bg-[var(--theme-background)]",
      className
    )}>
      <NoiseOverlay />
      
      {/* Theme Toggle */}
      {showThemeToggle && <ThemeToggleButton className="fixed top-4 right-4 z-50" />}

      {/* Cinematic Background Elements */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ 
          backgroundImage: 'linear-gradient(var(--theme-accent) var(--theme-grid-line), transparent var(--theme-grid-line)), linear-gradient(90deg, var(--theme-accent) var(--theme-grid-line), transparent var(--theme-grid-line))', 
          backgroundSize: 'var(--theme-grid-size) var(--theme-grid-size)' 
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[var(--theme-background-size)] h-[var(--theme-background-size)] bg-[var(--theme-accent)]/10 rounded-full blur-[var(--theme-background-blur)] pointer-events-none" />

      {/* Main Content */}
      <div className={cn("w-full relative z-10", maxWidth)}>
        {children}
      </div>
    </div>
  );
}
