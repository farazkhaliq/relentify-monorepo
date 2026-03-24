'use client';

import { useState } from 'react';
import { Card, Button } from '@relentify/ui';

export type CorrectingEntry = {
  description: string;
  explanation: string;
  onConfirm: () => Promise<void>;
};

interface Props {
  lockedThrough: string;
  reason: string | null;
  earliestUnlockedDate: string;
  correctingEntry: CorrectingEntry | null;
  onClose: () => void;
}

export default function PeriodLockedModal({
  lockedThrough,
  reason,
  earliestUnlockedDate,
  correctingEntry,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formattedLocked = new Date(lockedThrough + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const formattedOpen = new Date(earliestUnlockedDate + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  async function handleConfirm() {
    if (!correctingEntry) return;
    setLoading(true); setError('');
    try {
      await correctingEntry.onConfirm();
      onClose();
    } catch {
      setError('Failed to create correcting entry. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-[var(--theme-primary)]/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card variant="default" padding="lg" className="max-w-lg w-full shadow-2xl border-[var(--theme-border)] space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-[var(--theme-warning)]/10 rounded-cinematic flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-[var(--theme-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-[var(--theme-text)]">This period is locked</h3>
            {reason && <p className="text-sm text-[var(--theme-text-muted)] mt-1">{reason}</p>}
            <p className="text-[10px] font-bold text-[var(--theme-text-dim)] uppercase tracking-widest mt-2">Locked through {formattedLocked}</p>
          </div>
        </div>

        {correctingEntry ? (
          <div className="bg-[var(--theme-border)]/[0.08] rounded-cinematic p-5 border border-[var(--theme-border)]">
            <p className="text-sm text-[var(--theme-text-muted)] mb-3">
              <strong className="text-[var(--theme-text)] font-black uppercase text-[10px] tracking-widest block mb-1">Proposed correction</strong>
              We&apos;ll create <strong>{correctingEntry.description}</strong> dated{' '}
              <strong>{formattedOpen}</strong> — the first day of your open period.
            </p>
            <p className="text-sm text-[var(--theme-text-muted)] leading-relaxed italic">
              {correctingEntry.explanation}
            </p>
          </div>
        ) : (
          <div className="bg-[var(--theme-border)]/[0.08] rounded-cinematic p-5 border border-[var(--theme-border)]">
            <p className="text-sm text-[var(--theme-text-muted)] leading-relaxed">
              Transactions in locked periods cannot be edited directly. Please contact your accountant to post a correcting entry, or ask them to grant you temporary posting access.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-[var(--theme-destructive)] font-bold">{error}</p>}

        <div className="flex gap-3">
          {correctingEntry && (
            <Button
              onClick={handleConfirm}
              disabled={loading}
              variant="primary"
              className="flex-1 rounded-cinematic uppercase tracking-widest text-sm font-black"
            >
              {loading ? 'Creating...' : 'Confirm'}
            </Button>
          )}
          <Button
            onClick={onClose}
            variant="ghost"
            className="flex-1 bg-[var(--theme-border)]/50 border border-[var(--theme-border)] rounded-cinematic uppercase tracking-widest text-sm font-black"
          >
            {correctingEntry ? 'Cancel' : 'Close'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
