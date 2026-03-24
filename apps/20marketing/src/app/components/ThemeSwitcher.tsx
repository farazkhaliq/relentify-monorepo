import React from 'react';
import { useTheme } from '../App';
import { motion } from 'motion/react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeSwitcher() {
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <button
        onClick={toggleDarkMode}
        className="p-4 rounded-full bg-[var(--theme-card)] shadow-2xl border border-[var(--theme-border)] text-[var(--theme-text)] hover:scale-110 transition-all flex items-center justify-center"
      >
        {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
      </button>
    </div>
  );
}
