

import React from 'react';
import { Card, CardContent } from './Card';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  className?: string;
}

export function StatsCard({ label, value, icon: Icon, className }: StatsCardProps) {
  return (
    <Card className={cn("border-[var(--theme-border)]", className)}>
      <CardContent className="p-8 space-y-1">
        <div className="text-[10px] font-mono font-bold text-[var(--theme-text-dim)] uppercase tracking-[0.2em] flex items-center gap-2">
          {Icon && <Icon size={12} className="text-[var(--theme-accent)]" />}
          {label}
        </div>
        <div className="text-lg font-bold text-[var(--theme-text)] truncate">{value}</div>
      </CardContent>
    </Card>
  );
}
