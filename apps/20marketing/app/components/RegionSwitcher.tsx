'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useRegion, cn } from '@relentify/ui';
import type { Region } from '@relentify/ui';

const REGIONS: { name: Region; code: string }[] = [
  { name: 'UK', code: 'gb' },
  { name: 'USA', code: 'us' },
  { name: 'Canada', code: 'ca' },
  { name: 'Australia', code: 'au' },
  { name: 'New Zealand', code: 'nz' },
  { name: 'EU', code: 'eu' },
];

function getFlagCode(regionName: Region): string {
  const match = REGIONS.find((r) => r.name === regionName);
  return match?.code ?? 'gb';
}

export default function RegionSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { region, setRegion } = useRegion();
  const activeCode = getFlagCode(region);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors',
          'hover:bg-[var(--theme-border)] text-[var(--theme-text-muted)]'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <img
          src={`https://flagcdn.com/w40/${activeCode}.png`}
          alt={region}
          width={20}
          height={15}
          className="rounded-sm object-cover"
        />
        <span>{region}</span>
        <ChevronDown
          className={cn('w-3.5 h-3.5 transition-transform duration-200', isOpen && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute right-0 top-full mt-1 z-50 min-w-[140px]',
              'rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)]',
              'shadow-[var(--shadow-cinematic)] overflow-hidden py-1'
            )}
            role="listbox"
          >
            {REGIONS.map(({ name, code }) => (
              <button
                key={name}
                role="option"
                aria-selected={region === name}
                onClick={() => {
                  setRegion(name);
                  setIsOpen(false);
                }}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors text-left',
                  region === name
                    ? 'bg-[var(--theme-accent)] text-white font-medium'
                    : 'text-[var(--theme-text)] hover:bg-[var(--theme-border)]'
                )}
              >
                <img
                  src={`https://flagcdn.com/w40/${code}.png`}
                  alt={name}
                  width={20}
                  height={15}
                  className="rounded-sm object-cover flex-shrink-0"
                />
                <span>{name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
