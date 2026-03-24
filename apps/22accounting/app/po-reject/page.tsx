'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, Label, Textarea, Button, ThemeProvider } from '@relentify/ui';

function PORejectForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <Card variant="default" padding="lg" className="max-w-md w-full text-center space-y-4 rounded-cinematic shadow-cinematic">
        <div className="w-14 h-14 rounded-full bg-[var(--theme-text-dim)]/10 flex items-center justify-center mx-auto text-2xl text-[var(--theme-text-dim)]">○</div>
        <h1 className="text-xl font-black text-[var(--theme-text)]">Invalid Link</h1>
        <p className="text-[var(--theme-text-muted)] text-sm leading-relaxed">This rejection link is invalid or missing.</p>
        <div className="pt-4 text-[10px] font-bold text-[var(--theme-text-dim)] uppercase tracking-widest">Relentify</div>
      </Card>
    );
  }

  if (done) {
    return (
      <Card variant="default" padding="lg" className="max-w-md w-full text-center space-y-4 rounded-cinematic shadow-cinematic">
        <div className="w-14 h-14 rounded-full bg-[var(--theme-destructive)]/10 flex items-center justify-center mx-auto text-2xl text-[var(--theme-destructive)]">✗</div>
        <h1 className="text-xl font-black text-[var(--theme-text)]">PO Rejected</h1>
        <p className="text-[var(--theme-text-muted)] text-sm leading-relaxed">The purchase order has been rejected and the requester has been notified.</p>
        <div className="pt-4 text-[10px] font-bold text-[var(--theme-text-dim)] uppercase tracking-widest">Relentify</div>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError('Please provide a reason for rejection.'); return; }
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/po/approve-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reject. The link may have expired or already been used.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card variant="default" padding="lg" className="max-w-md w-full text-center space-y-6 rounded-cinematic shadow-cinematic">
      <div>
        <h1 className="text-xl font-black text-[var(--theme-text)] mb-2">Reject Purchase Order</h1>
        <p className="text-[var(--theme-text-muted)] text-sm leading-relaxed">Please provide a reason for rejecting this purchase order. The requester will be notified.</p>
      </div>
      <form onSubmit={handleSubmit} className="text-left space-y-4">
        <div className="space-y-2">
          <Label>Reason *</Label>
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            required
            rows={4}
            placeholder="e.g. Budget not approved for this period, please resubmit next quarter."
          />
        </div>
        {error && <p className="text-[var(--theme-destructive)] text-xs font-bold">{error}</p>}
        <Button
          type="submit"
          disabled={loading}
          variant="primary"
          className="w-full bg-[var(--theme-destructive)] hover:bg-[var(--theme-destructive)]/90 border-none rounded-cinematic py-4 font-black uppercase tracking-widest text-sm"
        >
          {loading ? 'Submitting...' : 'Confirm Rejection'}
        </Button>
      </form>
      <div className="pt-4 text-[10px] font-bold text-[var(--theme-text-dim)] uppercase tracking-widest">Relentify</div>
    </Card>
  );
}

export default function PORejectPage() {
  return (
    <ThemeProvider initialPreset="B">
      <div className="min-h-screen bg-[var(--theme-background)] flex items-center justify-center p-6 font-sans">
        <Suspense fallback={<Card variant="default" padding="lg" className="max-w-md w-full text-center rounded-cinematic shadow-cinematic"><p className="text-sm font-bold animate-pulse">Loading...</p></Card>}>
          <PORejectForm />
        </Suspense>
      </div>
    </ThemeProvider>
  );
}
