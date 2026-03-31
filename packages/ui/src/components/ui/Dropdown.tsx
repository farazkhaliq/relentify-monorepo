'use client';

import React, { useState, useRef } from 'react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { spring } from '../../animations';

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  contentClassName?: string;
  hoverable?: boolean;
}

export function Dropdown({ 
  trigger, 
  children, 
  align = 'right', 
  className,
  contentClassName,
  hoverable = true
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (!hoverable) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    if (!hoverable) return;
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 150);
  };

  return (
    <div 
      className={cn("relative inline-block", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        onClick={() => !hoverable && setOpen(!open)} 
        className="cursor-pointer"
      >
        {trigger}
      </div>
      
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{ opacity: 0,   y: -4,  scale: 0.98 }}
            transition={{ ...spring.snappy }}
            className={cn(
              "absolute top-full mt-2 w-64 rounded-[2rem] p-4 shadow-2xl z-50 backdrop-blur-3xl border",
              "bg-white/70 border-black/10 dark:bg-zinc-900/70 dark:border-white/10",
              align === 'right' ? "right-0" : "left-0",
              contentClassName
            )}
          >
            <div className="grid grid-cols-1 gap-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DropdownItem({ 
  children, 
  onClick, 
  href,
  className,
  variant = 'default'
}: { 
  children: React.ReactNode; 
  onClick?: (e: React.MouseEvent) => void; 
  href?: string;
  className?: string;
  variant?: 'default' | 'danger';
}) {
  const baseClasses = "px-4 py-3 rounded-2xl text-xs font-bold transition-colors no-underline cursor-pointer flex items-center gap-3";
  const variants = {
    default: "text-black/60 hover:text-black hover:bg-black/5 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5",
    danger: "text-red-400 hover:text-red-300 hover:bg-red-400/5"
  };

  const classes = cn(baseClasses, variants[variant], className);

  if (href) {
    return (
      <a href={href} className={classes} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  );
}

export function DropdownHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-4 py-3 border-b border-black/5 dark:border-white/5 mb-1", className)}>
      {children}
    </div>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 border-t border-black/5 dark:border-white/5 mx-2 opacity-50" />;
}
