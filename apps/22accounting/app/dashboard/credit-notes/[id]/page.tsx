'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toaster, toast } from '@relentify/ui';

const SC: Record<string, string> = {
  draft:   'bg-[var(--theme-primary)]/3 text-[var(--theme-text-muted)]',
  issued:  'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]',
  applied: 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]',
  voided:  'bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)]',
};

const currencySymbol = (c: string) => ({ GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$' }[c] || c + ' ');

type CreditNote = {
  id: string;
  credit_note_number: string;
  client_name: string;
  client_email?: string;
  issue_date: string;
  subtotal: string;
  tax_amount: string;
  total: string;
  currency: string;
  status: string;
  reason?: string;
  notes?: string;
  linked_invoice_number?: string;
  invoice_id?: string;
  created_at: string;
  items: Array<{ id: string; description: string; quantity: string; unit_price: string; amount: string; tax_rate: string; }>;
};

export default function CreditNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cn, setCn] = useState<CreditNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);

  useEffect(() => {
    fetch(`/api/credit-notes/${id}`)
      .then(r => r.json())
      .then(d => { if (d.credit_note) setCn(d.credit_note); })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusChange(newStatus: string) {
    if (!cn) return;
    setActionLoading(true);
    try {
      const r = await fetch(`/api/credit-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setCn(prev => prev ? { ...prev, status: newStatus } : prev);
      toast(`Status updated to ${newStatus}`, 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to update', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleVoid() {
    setActionLoading(true);
    try {
      const r = await fetch(`/api/credit-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setCn(prev => prev ? { ...prev, status: 'voided' } : prev);
      setConfirmVoid(false);
      toast('Credit note voided', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to void', 'error');
      setConfirmVoid(false);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <div className="flex items-center justify-center py-20">
        <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      </div>
    </div>
  );

  if (!cn) return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <main className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-[var(--theme-text-muted)] mb-4">Credit note not found</p>
        <Link href="/dashboard/credit-notes" className="text-[var(--theme-accent)] hover:text-[var(--theme-accent)] no-underline text-sm font-black">← Back to Credit Notes</Link>
      </main>
    </div>
  );

  const sym = currencySymbol(cn.currency);
  const isVoided = cn.status === 'voided';

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />

      {confirmVoid && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--theme-primary)]/60 backdrop-blur-sm" onClick={() => setConfirmVoid(false)} />
          <div className="relative bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-[2rem] p-6 sm:p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-black text-[var(--theme-text)] mb-2">Void {cn.credit_note_number}?</h3>
            <p className="text-[var(--theme-text-muted)] text-sm mb-6">This will reverse the GL entries and cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmVoid(false)} className="flex-1 px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-text)] font-black rounded-cinematic text-sm uppercase tracking-widest hover:bg-[var(--theme-border)]/40 transition-all">Cancel</button>
              <button onClick={handleVoid} disabled={actionLoading} className="flex-1 px-4 py-3 bg-[var(--theme-destructive)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all">
                {actionLoading ? 'Voiding...' : 'Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/dashboard/credit-notes" className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] text-sm font-bold mb-2 inline-block no-underline">← Credit Notes</Link>
            <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">{cn.credit_note_number}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${SC[cn.status] || 'bg-[var(--theme-primary)]/3 text-[var(--theme-text-muted)]'}`}>{cn.status}</span>
              {cn.linked_invoice_number && cn.invoice_id && (
                <Link href={`/dashboard/invoices/${cn.invoice_id}`} className="text-[var(--theme-accent)] text-xs hover:text-[var(--theme-accent)] no-underline font-bold">
                  re: {cn.linked_invoice_number}
                </Link>
              )}
            </div>
          </div>

          {!isVoided && (
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              {cn.status === 'draft' && (
                <button onClick={() => handleStatusChange('issued')} disabled={actionLoading}
                  className="px-4 py-2 bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/20 text-[var(--theme-accent)] font-black rounded-cinematic text-xs uppercase tracking-widest hover:bg-[var(--theme-accent)]/20 transition-all disabled:opacity-50">
                  Mark Issued
                </button>
              )}
              {cn.status === 'issued' && (
                <button onClick={() => handleStatusChange('applied')} disabled={actionLoading}
                  className="px-4 py-2 bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/20 text-[var(--theme-accent)] font-black rounded-cinematic text-xs uppercase tracking-widest hover:bg-[var(--theme-accent)]/20 transition-all disabled:opacity-50">
                  Mark Applied
                </button>
              )}
              <button onClick={() => setConfirmVoid(true)} disabled={actionLoading}
                className="px-4 py-2 bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] font-black rounded-cinematic text-xs uppercase tracking-widest hover:bg-[var(--theme-destructive)]/20 transition-all disabled:opacity-50">
                Void
              </button>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8 space-y-4">
          <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Credit Note Details</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Client</p>
              <p className="text-[var(--theme-text)] text-sm font-bold">{cn.client_name}</p>
              {cn.client_email && <p className="text-[var(--theme-text-muted)] text-xs">{cn.client_email}</p>}
            </div>
            <div>
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Issue Date</p>
              <p className="text-[var(--theme-text)] text-sm">{new Date(cn.issue_date).toLocaleDateString('en-GB')}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Currency</p>
              <p className="text-[var(--theme-text)] text-sm">{cn.currency}</p>
            </div>
            {cn.reason && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Reason</p>
                <p className="text-[var(--theme-text)] text-sm">{cn.reason}</p>
              </div>
            )}
            {cn.notes && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Notes</p>
                <p className="text-[var(--theme-text-muted)] text-sm whitespace-pre-wrap">{cn.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic overflow-hidden">
          <div className="p-5 sm:p-8 pb-0">
            <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Line Items</h2>
          </div>
          <table className="w-full">
            <thead className="border-y border-[var(--theme-border)]">
              <tr>
                <th className="text-left px-5 sm:px-8 py-3 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Description</th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest hidden sm:table-cell">Qty</th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest hidden sm:table-cell">Price</th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest hidden sm:table-cell">VAT</th>
                <th className="text-right px-5 sm:px-8 py-3 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--theme-border)]">
              {cn.items.map(item => (
                <tr key={item.id}>
                  <td className="px-5 sm:px-8 py-4 text-[var(--theme-text)] text-sm">{item.description}</td>
                  <td className="px-4 py-4 text-right text-[var(--theme-text-muted)] text-sm hidden sm:table-cell">{parseFloat(item.quantity)}</td>
                  <td className="px-4 py-4 text-right text-[var(--theme-text-muted)] text-sm hidden sm:table-cell">{sym}{parseFloat(item.unit_price).toFixed(2)}</td>
                  <td className="px-4 py-4 text-right text-[var(--theme-text-muted)] text-sm hidden sm:table-cell">{item.tax_rate}%</td>
                  <td className="px-5 sm:px-8 py-4 text-right text-[var(--theme-text)] font-bold text-sm">{sym}{(parseFloat(item.amount) + parseFloat(item.amount) * parseFloat(item.tax_rate) / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 sm:px-8 py-5 border-t border-[var(--theme-border)] space-y-1.5">
            <div className="flex justify-between text-sm text-[var(--theme-text-muted)]">
              <span>Subtotal</span><span>{sym}{parseFloat(cn.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-[var(--theme-text-muted)]">
              <span>VAT</span><span>{sym}{parseFloat(cn.tax_amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-[var(--theme-text)]">
              <span>Total Credit</span><span>{sym}{parseFloat(cn.total).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
