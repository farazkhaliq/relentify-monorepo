'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Toaster, toast } from '@relentify/ui';

interface PO {
  id: string;
  po_number: string;
  supplier_name: string;
  description: string | null;
  currency: string;
  total: string;
  status: string;
  requested_by_name: string;
  expected_date: string | null;
  created_at: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$' };
function fmt(amount: string | number, currency: string) {
  return (CURRENCY_SYMBOLS[currency] || currency + ' ') + Number(amount).toFixed(2);
}

const STATUS_STYLES: Record<string, string> = {
  pending_approval: 'bg-[var(--theme-warning)]/10 text-[var(--theme-warning)] border border-[var(--theme-warning)]/20',
  approved:         'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20',
  rejected:         'bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)] border border-[var(--theme-destructive)]/20',
  cancelled:        'bg-[var(--theme-primary)]/3 text-[var(--theme-text-muted)] border border-[var(--theme-border)]',
  fulfilled:        'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20',
  fulfilled_with_variance: 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20',
};
const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending Approval',
  approved:         'Approved',
  rejected:         'Rejected',
  cancelled:        'Cancelled',
  fulfilled:        'Fulfilled',
  fulfilled_with_variance: 'Fulfilled (Variance)',
};

export default function POListPage() {
  const [pos, setPOs] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const url = filter ? `/api/po?status=${filter}` : '/api/po';
    fetch(url)
      .then(r => r.json())
      .then(d => { if (d.pos) setPOs(d.pos); })
      .catch(() => toast('Failed to load purchase orders', 'error'))
      .finally(() => setLoading(false));
  }, [filter]);

  const tabCls = (val: string) => `px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
    filter === val
      ? 'bg-[var(--theme-accent)] text-[var(--theme-text)]'
      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border)]/30'
  }`;

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Purchase Orders</h1>
          <Link href="/dashboard/po/new" className="px-5 py-2.5 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 transition-all no-underline">
            + New PO
          </Link>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setFilter('')} className={tabCls('')}>All</button>
          <button onClick={() => setFilter('pending_approval')} className={tabCls('pending_approval')}>Pending Approval</button>
          <button onClick={() => setFilter('approved')} className={tabCls('approved')}>Approved</button>
          <button onClick={() => setFilter('fulfilled')} className={tabCls('fulfilled')}>Fulfilled</button>
          <button onClick={() => setFilter('rejected')} className={tabCls('rejected')}>Rejected</button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[var(--theme-text-muted)]">Loading...</div>
        ) : pos.length === 0 ? (
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-12 text-center">
            <p className="text-[var(--theme-text-muted)] text-sm">No purchase orders found.</p>
            <Link href="/dashboard/po/new" className="mt-4 inline-block px-5 py-2.5 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 transition-all no-underline">
              Raise a PO
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {pos.map(po => (
              <Link key={po.id} href={`/dashboard/po/${po.id}`} className="block bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 hover:border-[var(--theme-accent)]/30 transition-all no-underline group">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">{po.po_number}</span>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLES[po.status] || ''}`}>
                        {STATUS_LABELS[po.status] || po.status}
                      </span>
                    </div>
                    <p className="text-base font-black text-[var(--theme-text)] mt-1 group-hover:text-[var(--theme-accent)] transition-colors">
                      {po.supplier_name}
                    </p>
                    {po.description && (
                      <p className="text-sm text-[var(--theme-text-muted)] mt-0.5 truncate max-w-lg">{po.description}</p>
                    )}
                    <p className="text-xs text-[var(--theme-text-dim)] mt-1.5">
                      Raised by {po.requested_by_name}
                      {po.expected_date ? ` · Expected ${new Date(po.expected_date).toLocaleDateString('en-GB')}` : ''}
                      {' · '}{new Date(po.created_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-[var(--theme-text)]">{fmt(po.total, po.currency)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
