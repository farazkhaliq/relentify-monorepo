import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme, useRegion, Region } from '../App';
import { Menu, X, ChevronDown, Sun, Moon } from 'lucide-react';
import Logo from './Logo';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Navbar() {
  const { theme, isDarkMode, toggleDarkMode } = useTheme();
  const { region, setRegion } = useRegion();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    {
      name: 'Apps',
      path: '#',
      dropdown: [
        { name: 'Accounting', path: '/accounting' },
        { name: 'Property Inventories', path: '/inventory' },
        { name: 'CRM', path: '/crm' },
        { name: 'Reminders', path: '/reminders' },
        { name: 'Timesheets', path: '/timesheets' },
        { name: 'E-Sign', path: '/esign' },
        { name: 'Payroll & HR', path: '/payroll' },
      ]
    },
    { name: 'Blog', path: '/blog' },
    { name: 'Contact', path: '#', isContact: true },
  ];

  const regions: { name: Region; code: string }[] = [
    { name: 'UK', code: 'gb' },
    { name: 'USA', code: 'us' },
    { name: 'Canada', code: 'ca' },
    { name: 'Australia', code: 'au' },
    { name: 'New Zealand', code: 'nz' },
    { name: 'EU', code: 'eu' },
  ];

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleNavClick = (link: any) => {
    if (link.isContact) {
      if ((window as any).$chatwoot) {
        (window as any).$chatwoot.toggle();
      }
      setIsMobileMenuOpen(false);
      return;
    }
    if (link.path !== '#') {
      setIsMobileMenuOpen(false);
    }
  };

  const currentRegion = regions.find(r => r.name === region) || regions[0];

  return (
    <nav className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4">
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "flex items-center justify-between w-full max-w-6xl px-6 py-3 rounded-full border transition-all duration-500",
          isScrolled
            ? "bg-[var(--theme-card)] border-[var(--theme-border)] shadow-xl"
            : "bg-transparent border-transparent"
        )}
      >
        <div className="flex items-center gap-6">
          <Link to="/" className={cn("flex items-center gap-3 text-xl font-bold tracking-tighter transition-colors group", "text-[var(--theme-text)]")}>
            <Logo className="w-6 h-6 group-hover:rotate-12 transition-transform duration-500" />
            <span>RELENTIFY</span>
          </Link>

          {/* Region Switcher */}
          <div
            className="relative"
            onMouseEnter={() => setIsRegionDropdownOpen(true)}
            onMouseLeave={() => setIsRegionDropdownOpen(false)}
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-[var(--theme-border)] transition-colors cursor-pointer">
              <img
                src={`https://flagcdn.com/w40/${currentRegion.code}.png`}
                alt={currentRegion.name}
                className="w-5 h-auto rounded-sm shadow-sm"
                referrerPolicy="no-referrer"
              />
              <span className={cn("text-[10px] font-bold uppercase tracking-widest transition-colors", "text-[var(--theme-text)]")}>
                {region}
              </span>
              <ChevronDown size={12} className={cn("transition-colors", "text-[var(--theme-text)]/40")} />
            </div>

            <AnimatePresence>
              {isRegionDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={cn(
                    "absolute top-full left-0 mt-2 w-48 rounded-3xl p-2 shadow-2xl border grid grid-cols-1 gap-1 backdrop-blur-2xl",
                    "bg-[var(--theme-card)] border-[var(--theme-border)]"
                  )}
                >
                  {regions.map((r) => (
                    <button
                      key={r.name}
                      onClick={() => {
                        setRegion(r.name as Region);
                        setIsRegionDropdownOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors",
                        region === r.name
                          ? "bg-[var(--theme-text)] text-[var(--theme-card)]"
                          : "text-[var(--theme-text)] hover:bg-[var(--theme-border)]"
                      )}
                    >
                      <img
                        src={`https://flagcdn.com/w40/${r.code}.png`}
                        alt={r.name}
                        className="w-5 h-auto rounded-sm"
                        referrerPolicy="no-referrer"
                      />
                      <span>{r.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <div key={link.name} className="relative group">
              {link.dropdown ? (
                <div
                  className="flex items-center gap-1 cursor-pointer py-2"
                  onMouseEnter={() => setIsDropdownOpen(true)}
                  onMouseLeave={() => setIsDropdownOpen(false)}
                >
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-widest transition-all",
                    "text-[var(--theme-text)]/60 group-hover:text-[var(--theme-text)]"
                  )}>
                    {link.name}
                  </span>
                  <motion.div
                    animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown size={12} className={cn("transition-colors", "text-[var(--theme-text)]/40")} />
                  </motion.div>

                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className={cn(
                          "absolute top-full left-0 mt-2 w-64 rounded-3xl p-4 shadow-2xl border grid grid-cols-1 gap-1 backdrop-blur-2xl",
                          "bg-[var(--theme-card)] border-[var(--theme-border)]"
                        )}
                      >
                        {link.dropdown.map((sub) => (
                          <Link
                            key={sub.path}
                            to={sub.path}
                            className={cn(
                              "px-4 py-2 rounded-2xl text-xs font-bold transition-colors",
                              "text-[var(--theme-text)] hover:bg-[var(--theme-border)]"
                            )}
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  to={link.path}
                  onClick={(e) => {
                    if (link.isContact) {
                      e.preventDefault();
                      handleNavClick(link);
                    }
                  }}
                  className={cn(
                    "text-xs font-bold uppercase tracking-widest transition-all hover:opacity-100",
                    location.pathname === link.path
                      ? "text-accent opacity-100"
                      : "text-[var(--theme-text)]/60 hover:text-[var(--theme-text)]"
                  )}
                >
                  {link.name}
                </Link>
              )}
            </div>
          ))}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[var(--theme-text)]/40 hover:text-[var(--theme-text)] transition-all flex items-center justify-center"
            aria-label="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <a
            href="https://auth.relentify.com/login?redirect=https://relentify.com/portal"
            className={cn(
              "text-xs font-bold uppercase tracking-widest transition-all hover:opacity-100",
              "text-[var(--theme-text)]/60 hover:text-[var(--theme-text)]"
            )}
          >
            Login
          </a>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </motion.div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute top-20 left-4 right-4 bg-[var(--theme-card)] backdrop-blur-2xl rounded-[2rem] p-8 shadow-2xl border border-[var(--theme-border)] md:hidden"
          >
            <div className="flex flex-col gap-6">
              {navLinks.map((link) => (
                link.dropdown ? (
                  <div key={link.name}>
                    <div className="text-2xl font-bold tracking-tight text-[var(--theme-text)] mb-3">
                      {link.name}
                    </div>
                    <div className="flex flex-col gap-2 pl-4">
                      {link.dropdown.map((sub) => (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="text-base font-bold tracking-tight text-[var(--theme-text)]/70"
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={(e) => {
                      if (link.isContact) {
                        e.preventDefault();
                      }
                      handleNavClick(link);
                    }}
                    className="text-2xl font-bold tracking-tight text-[var(--theme-text)]"
                  >
                    {link.name}
                  </Link>
                )
              ))}
              <a
                href="https://auth.relentify.com/login?redirect=https://relentify.com/portal"
                className="text-2xl font-bold tracking-tight text-[var(--theme-text)]"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Login
              </a>
              <button
                onClick={toggleDarkMode}
                className="flex items-center gap-3 text-2xl font-bold tracking-tight text-[var(--theme-text)]"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
