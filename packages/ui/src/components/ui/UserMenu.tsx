'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Dropdown } from './Dropdown';

interface UserMenuProps {
  name: string;
  children: React.ReactNode;
}

export function UserMenu({ name, children }: UserMenuProps) {
  return (
    <Dropdown
      trigger={
        <button className="flex items-center gap-2 py-2 px-1 text-xs font-bold uppercase tracking-widest text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-all group">
          <span className="hidden sm:inline">{name}</span>
          <ChevronDown size={12} className="transition-colors text-black/40 dark:text-white/40 group-hover:text-black dark:group-hover:text-white" />
        </button>
      }
    >
      {children}
    </Dropdown>
  );
}
