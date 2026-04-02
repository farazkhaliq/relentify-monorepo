'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, ChevronDown, Menu, X } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

interface TopBarProps {
  logo?: React.ReactNode;
  navLinks?: React.ReactNode;
  primaryAction?: React.ReactNode;
  children?: React.ReactNode;
  centerSlot?: React.ReactNode;
  className?: string;
}

export function TopBar({ logo, navLinks, primaryAction, children, centerSlot, className }: TopBarProps) {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [mobileMenuOpen]);

  return (
    <header className={cn(
      "fixed top-6 left-0 right-0 z-50 flex justify-center px-4",
      className
    )}>
      <div ref={mobileMenuRef} className="w-full max-w-6xl relative">
        <motion.div
          initial={false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "flex items-center w-full px-6 py-3 rounded-full border transition-all duration-500",
            "shadow-cinematic backdrop-blur-3xl",
            isDarkMode
              ? "bg-black/40 border-white/5"
              : "bg-white/70 border-black/5",
            isScrolled ? "scale-[0.98]" : "scale-100"
          )}
        >
          {/* Logo - fixed left */}
          <div className="flex-shrink-0 mr-6">
            {logo}
          </div>

          {/* Hamburger button - mobile only */}
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            className="sm:hidden p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-black/60 dark:text-white/60 transition-all mr-auto"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>

          {/* Nav links - hidden on mobile, visible on sm+ */}
          <div className="flex-1 hidden sm:flex items-center gap-4 min-w-0">
            <nav className="flex items-center gap-4 flex-wrap">
              {navLinks}
            </nav>
            {primaryAction}
          </div>

          {/* Center slot (optional) */}
          {centerSlot && (
            <div className="hidden sm:flex justify-center mx-4 flex-shrink-0">
              {centerSlot}
            </div>
          )}

          {/* Right: dark mode toggle + user menu */}
          <div className="flex-shrink-0 flex items-center gap-4 ml-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-all flex items-center justify-center"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <div className="flex items-center">
              {children}
            </div>
          </div>
        </motion.div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div
            className={cn(
              "sm:hidden absolute top-full left-0 right-0 mt-2 mx-2 rounded-2xl border py-4 px-4 shadow-lg z-50 space-y-3",
              isDarkMode
                ? "bg-black/90 border-white/10 backdrop-blur-xl"
                : "bg-white/95 border-black/5 backdrop-blur-xl"
            )}
            onClick={() => setMobileMenuOpen(false)}
          >
            <nav className="flex flex-col gap-3">
              {navLinks}
            </nav>
            {primaryAction && (
              <div className="pt-2 border-t border-[var(--theme-border)]">
                {primaryAction}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export function TopBarButton({ 
  children, 
  onClick,
  className 
}: { 
  children: React.ReactNode; 
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "hover:bg-black/20 text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all active:scale-95 flex items-center justify-center",
        className
      )}
      style={{ backgroundColor: 'var(--theme-accent)' }}
    >
      {children}
    </button>
  );
}

export function TopBarLink({
  href,
  children,
  active,
  className
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "text-xs font-bold uppercase tracking-widest transition-all hover:opacity-100 no-underline whitespace-nowrap",
        active
          ? "text-[var(--theme-accent)] opacity-100"
          : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white",
        className
      )}
    >
      {children}
    </a>
  );
}

export interface TopBarDropdownItem {
  label: string;
  href: string;
}

export function TopBarDropdown({
  label,
  items,
  active,
  className,
}: {
  label: string;
  items: TopBarDropdownItem[];
  active?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      if (closeTimeout.current) clearTimeout(closeTimeout.current);
    };
  }, []);

  const handleEnter = () => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setOpen(true);
  };

  const handleLeave = () => {
    closeTimeout.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-1 text-xs font-bold uppercase tracking-widest transition-all hover:opacity-100 whitespace-nowrap bg-transparent border-0 p-0 cursor-pointer",
          active
            ? "text-[var(--theme-accent)] opacity-100"
            : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
        )}
      >
        {label}
        <ChevronDown
          size={10}
          className={cn("transition-transform duration-200", open ? "rotate-180" : "")}
        />
      </button>
      {open && (
        <div
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className={cn(
            "absolute top-full left-0 mt-3 min-w-[160px] rounded-2xl border py-2 shadow-lg z-50",
            isDarkMode
              ? "bg-black/80 border-white/10 backdrop-blur-xl"
              : "bg-white/90 border-black/5 backdrop-blur-xl"
          )}
        >
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "block px-4 py-2 text-xs font-bold uppercase tracking-widest no-underline transition-all",
                isDarkMode
                  ? "text-white/60 hover:text-white hover:bg-white/5"
                  : "text-black/60 hover:text-black hover:bg-black/5"
              )}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
