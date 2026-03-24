'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from './Popover';
import { Calendar } from './Calendar';
import { cn } from '../../lib/utils';

export interface DatePickerProps {
  value: string; // ISO YYYY-MM-DD, empty string = unset
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: string; // ISO YYYY-MM-DD — disables days before this
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  min,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected = value ? new Date(value + 'T00:00:00') : undefined;

  const displayValue = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  function handleSelect(day: Date | undefined) {
    if (!day) return;
    const iso = [
      day.getFullYear(),
      String(day.getMonth() + 1).padStart(2, '0'),
      String(day.getDate()).padStart(2, '0'),
    ].join('-');
    onChange(iso);
    setOpen(false);
  }

  const isDisabledDay: ((day: Date) => boolean) | undefined = min
    ? (day: Date) => day < new Date(min + 'T00:00:00')
    : undefined;

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'w-full px-4 py-3 bg-[var(--theme-background)] border border-[var(--theme-border)]',
            'rounded-cinematic text-sm outline-none transition-all',
            'flex items-center justify-between gap-2',
            'focus:ring-2 focus:ring-[var(--theme-accent)] focus:border-[var(--theme-accent)]',
            displayValue
              ? 'text-[var(--theme-text)]'
              : 'text-[var(--theme-text-dim)]',
            disabled && 'opacity-60 cursor-not-allowed',
            className
          )}
        >
          <span>{displayValue ?? placeholder}</span>
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-40" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border border-[var(--theme-border)] shadow-[var(--shadow-cinematic)] backdrop-blur-xl bg-[var(--theme-card)] rounded-2xl overflow-hidden" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          disabled={isDisabledDay}
          defaultMonth={selected}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
