'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { cn } from '../../lib/utils';
import { spring } from '../../animations';

export function ThemeToggleButton({ className }: { className?: string }) {
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <button
      onClick={toggleDarkMode}
      className={cn(
        "relative p-2 rounded-full border overflow-hidden group",
        "bg-white/5 border-black/5 hover:bg-black/[0.02] dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/[0.08]",
        className
      )}
      aria-label="Toggle theme"
    >
      <div className="relative h-5 w-5">
        <AnimatePresence mode="wait" initial={false}>
          {isDarkMode ? (
            <motion.span
              key="moon"
              className="absolute inset-0 flex items-center justify-center"
              initial={{ rotate: -90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0,   scale: 1, opacity: 1 }}
              exit={{    rotate:  90, scale: 0, opacity: 0 }}
              transition={spring.snappy}
            >
              <Moon className="h-5 w-5 text-blue-400" />
            </motion.span>
          ) : (
            <motion.span
              key="sun"
              className="absolute inset-0 flex items-center justify-center"
              initial={{ rotate:  90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0,   scale: 1, opacity: 1 }}
              exit={{    rotate: -90, scale: 0, opacity: 0 }}
              transition={spring.snappy}
            >
              <Sun className="h-5 w-5 text-amber-500" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {/* Cinematic glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-transparent to-white/10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
