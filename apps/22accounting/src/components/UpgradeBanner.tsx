'use client';

import { useState } from 'react';
import { Badge, Button } from '@relentify/ui';

export default function UpgradeBanner({ tierLabel }: { tierLabel: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-cinematic bg-[var(--theme-success)]/10 border border-[var(--theme-success)]/30 px-5 py-4">
      <div className="flex items-center gap-3">
        <Badge variant="success">✓</Badge>
        <p className="text-sm font-bold text-[var(--theme-success)]">
          You&apos;re now on <span className="font-black">{tierLabel}</span>. Your new features are ready.
        </p>
      </div>
      <Button
        onClick={() => setDismissed(true)}
        variant="ghost"
        size="sm"
        className="text-[var(--theme-success)] hover:bg-[var(--theme-success)]/10 px-2 py-1 rounded-lg"
        aria-label="Dismiss"
      >
        ×
      </Button>
    </div>
  );
}
