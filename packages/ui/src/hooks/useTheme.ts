'use client';

import { useContext, useEffect, useState } from 'react';
import { ThemeContext, ThemeContextType } from '../components/layout/ThemeProvider';

// Cookie-based so theme is shared across all *.relentify.com subdomains
function readThemeCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(^|;)\s*relentify_theme=([^;]+)/);
  return m ? m[2] : null;
}

function writeThemeCookie(val: 'dark' | 'light') {
  document.cookie = `relentify_theme=${val};domain=.relentify.com;path=/;max-age=31536000;SameSite=Lax`;
  localStorage.setItem('relentify_theme', val);
}

// Inline script for <head> — reads cookie first, falls back to localStorage, then system pref
export const THEME_SCRIPT = `(function(){var c=document.cookie.match(/(^|;)\\s*relentify_theme=([^;]+)/),s=c?c[2]:localStorage.getItem('relentify_theme'),sys=window.matchMedia('(prefers-color-scheme:dark)').matches;if(s==='dark'||(!s&&sys))document.documentElement.classList.add('dark');})();`;

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  
  const { isDarkMode, toggleDarkMode } = context;

  useEffect(() => {
    const saved = readThemeCookie() ?? localStorage.getItem('relentify_theme');
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved === 'dark' || (!saved && sys);
    
    if (dark !== isDarkMode) {
      // This is a bit tricky since ThemeProvider also manages this state.
      // But for accounts/inventory, we need the persistence.
    }
  }, [isDarkMode]);

  return context;
};
