'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { THEMES, Preset, ThemeConfig } from '../../styles/themes';

export interface ThemeContextType {
  preset: Preset;
  setPreset: (p: Preset) => void;
  theme: ThemeConfig;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readThemeCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(^|;)\s*relentify_theme=([^;]+)/);
  return m ? m[2] : null;
}

function writeThemeCookie(val: 'dark' | 'light') {
  document.cookie = `relentify_theme=${val};domain=.relentify.com;path=/;max-age=31536000;SameSite=Lax`;
  localStorage.setItem('relentify_theme', val);
}

export function ThemeProvider({ children, initialPreset = 'B' }: { children: ReactNode, initialPreset?: Preset }) {
  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const theme = THEMES[preset];

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    writeThemeCookie(next ? 'dark' : 'light');
  };

  useEffect(() => {
    const saved = readThemeCookie() ?? localStorage.getItem('relentify_theme');
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved === 'dark' || (!saved && sys);
    setIsDarkMode(dark);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const root = document.documentElement;
    
    // Theme Colors
    root.style.setProperty('--theme-primary', theme.palette.primary);
    root.style.setProperty('--theme-accent', theme.palette.accent);
    
    // For Cinematic Apps, the background depends on the mode
    // Unless it's Theme D (Premium) which is always dark
    const darkActive = (preset === 'D' || isDarkMode);
    const bg = darkActive ? theme.palette.dark : theme.palette.background;
    const text = darkActive ? '#F8FAFC' : theme.palette.text;
    
    root.style.setProperty('--theme-background', bg);
    root.style.setProperty('--theme-text', text);
    root.style.setProperty('--theme-dark', theme.palette.dark);

    // Card and Border variables
    if (darkActive) {
      root.style.setProperty('--theme-card', 'rgba(26, 26, 26, 0.9)');
      root.style.setProperty('--theme-border', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--theme-text-muted', 'rgba(255, 255, 255, 0.6)');
      root.style.setProperty('--theme-text-dim', 'rgba(255, 255, 255, 0.3)');
    } else {
      root.style.setProperty('--theme-card', '#ffffff');
      root.style.setProperty('--theme-border', 'rgba(0, 0, 0, 0.08)');
      root.style.setProperty('--theme-text-muted', 'rgba(0, 0, 0, 0.6)');
      root.style.setProperty('--theme-text-dim', 'rgba(0, 0, 0, 0.3)');
    }

    // Status colors (can be tweaked per theme if needed)
    root.style.setProperty('--theme-success', '#10B981');
    root.style.setProperty('--theme-warning', '#F59E0B');
    root.style.setProperty('--theme-destructive', '#EF4444');

    // Cinematic Typography classes are handled via Tailwind but variables can go here
    root.style.setProperty('--font-headings', theme.typography.headings);
  }, [theme, isDarkMode, preset]);

  return (
    <ThemeContext.Provider value={{ preset, setPreset, theme, isDarkMode, toggleDarkMode }}>
      <div 
        className={`min-h-screen transition-colors duration-700 ${isDarkMode ? 'dark' : ''}`} 
        style={{ 
          backgroundColor: 'var(--theme-background)', 
          color: 'var(--theme-text)' 
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
