'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { cn } from '../../lib/utils';

export function ThemeToggleButton({ className }: { className?: string }) {
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <button
      onClick={toggleDarkMode}
      className={cn(
        "relative p-2 rounded-full border transition-all duration-500 overflow-hidden group",
        "bg-white/5 border-black/5 hover:bg-black/[0.02] dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/[0.08]",
        className
      )}
      aria-label="Toggle theme"
    >
      <div className="relative h-5 w-5">
        <Sun 
          className={cn(
            "absolute inset-0 h-5 w-5 transition-all duration-700 ease-cinematic",
            isDarkMode ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100 text-amber-500"
          )} 
        />
        <Moon 
          className={cn(
            "absolute inset-0 h-5 w-5 transition-all duration-700 ease-cinematic",
            isDarkMode ? "rotate-0 scale-100 opacity-100 text-blue-400" : "-rotate-90 scale-0 opacity-0"
          )} 
        />
      </div>
      
      {/* Cinematic Inner Glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-transparent to-white/10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
