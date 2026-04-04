'use client';
import { useEffect, useState, useCallback } from 'react';

interface PeriodLockState {
  earliestOpenDate: string | null;   // YYYY-MM-DD, null while loading
  isDateLocked: (date: string) => boolean;
  lockedMessage: (date: string) => string | null;
}

export function usePeriodLock(): PeriodLockState {
  const [earliestOpenDate, setEarliestOpenDate] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/period-locks/earliest-open')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.date) setEarliestOpenDate(d.date); })
      .catch(() => {});
  }, []);

  const isDateLocked = useCallback((date: string): boolean => {
    if (!earliestOpenDate || !date) return false;
    return date < earliestOpenDate;
  }, [earliestOpenDate]);

  const lockedMessage = useCallback((date: string): string | null => {
    if (!earliestOpenDate || !date) return null;
    if (date < earliestOpenDate) {
      const formatted = new Date(earliestOpenDate + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
      return `This period is locked — earliest open date is ${formatted}`;
    }
    return null;
  }, [earliestOpenDate]);

  return { earliestOpenDate, isDateLocked, lockedMessage };
}
