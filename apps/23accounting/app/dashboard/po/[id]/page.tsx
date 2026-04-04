'use client';
import { useState, useEffect , use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toaster, toast } from '@relentify/ui';

interface POItem {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
  vat_rate: string;
  line_order: number;
}

interface PO {
  id: string;
  po_number: string;
  supplier_name: string;
  description: string | null;
  currency: string;
  subtotal: string;
  vat_amount: string;
  total: string;
  status: string;
  requested_by_name: string;
  approved_by_name: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  expected_date: string | null;
  notes: string | null;
  created_at: string;
  items: POItem[];
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

export default function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [po, setPO] = useState<PO | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetch(`/api/po/${id}`)
      .then(r => r.json())
      .then(d => { if (d.po) setPO(d.po); else toast('PO not found', 'error'); })
      .catch(() => toast('Failed to load purchase order', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleApprove() {
    setActionLoading(true);
    try {
      const r = await fetch(`/api/po/${id}/approve`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPO(prev => prev ? { ...prev, status: 'approved', approved_at: new Date().toISOString() } : prev);
      toast('Purchase order approved', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to approve', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) { toast('Please provide a rejection reason', 'error'); return; }
    setActionLoading(true);
    try {
      const r = await fetch(`/api/po/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPO(prev => prev ? { ...prev, status: 'rejected', rejection_reason: rejectReason } : prev);
      setShowRejectForm(false);
      toast('Purchase order rejected', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to reject', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel this purchase order?')) return;
    setActionLoading(true);
    try {
      const r = await fetch(`/api/po/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPO(prev => prev ? { ...prev, status: 'cancelled' } : prev);
      toast('Purchase order cancelled', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to cancel', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  const inputCls = "w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:ring-2 focus:ring-[var(--theme-accent)] outline-none transition-all text-sm";

  if (loading) return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent flex items-center justify-center">
      <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
    </div>
  );
  if (!po) return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-[var(--theme-destructive)] font-bold mb-4">Purchase order not found</p>
        <Link href="/dashboard/po" className="text-[var(--theme-accent)] text-sm font-bold no-underline">← Back to POs</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <span className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">{po.po_number}</span>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_STYLES[po.status] || ''}`}>
                {STATUS_LABELS[po.status] || po.status}
              </span>
            </div>
            <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">{po.supplier_name}</h1>
            {po.description && <p className="text-[var(--theme-text-muted)] mt-1">{po.description}</p>}
          </div>
          <Link href="/dashboard/po" className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest hover:text-[var(--theme-text)] no-underline shrink-0">← Back</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Line items */}
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8">
              <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Line Items</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--theme-border)]">
                      <th className="text-left text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest pb-2">Description</th>
                      <th className="text-right text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest pb-2">Qty</th>
                      <th className="text-right text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest pb-2">Unit Price</th>
                      <th className="text-right text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest pb-2">VAT</th>
                      <th className="text-right text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest pb-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-border)]">
                    {po.items.map(item => (
                      <tr key={item.id}>
                        <td className="py-3 text-[var(--theme-text)]">{item.description}</td>
                        <td className="py-3 text-right text-[var(--theme-text-muted)]">{item.quantity}</td>
                        <td className="py-3 text-right text-[var(--theme-text-muted)]">{fmt(item.unit_price, po.currency)}</td>
                        <td className="py-3 text-right text-[var(--theme-text-muted)]">{item.vat_rate}%</td>
                        <td className="py-3 text-right text-[var(--theme-text)] font-medium">{fmt(item.amount, po.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-[var(--theme-border)] mt-4 pt-4 space-y-1.5">
                <div className="flex justify-between text-sm text-[var(--theme-text-muted)]"><span>Subtotal</span><span>{fmt(po.subtotal, po.currency)}</span></div>
                <div className="flex justify-between text-sm text-[var(--theme-text-muted)]"><span>VAT</span><span>{fmt(po.vat_amount, po.currency)}</span></div>
                <div className="flex justify-between text-base font-black text-[var(--theme-text)]"><span>Total</span><span>{fmt(po.total, po.currency)}</span></div>
              </div>
            </div>

            {/* Rejection reason */}
            {po.status === 'rejected' && po.rejection_reason && (
              <div className="bg-[var(--theme-destructive)]/5 border border-[var(--theme-destructive)]/20 rounded-cinematic p-5">
                <p className="text-[10px] font-black text-[var(--theme-destructive)] uppercase tracking-widest mb-1">Rejection Reason</p>
                <p className="text-sm text-[var(--theme-text-muted)]">{po.rejection_reason}</p>
              </div>
            )}

            {/* Notes */}
            {po.notes && (
              <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8">
                <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Notes</p>
                <p className="text-sm text-[var(--theme-text)]">{po.notes}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Details card */}
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5">
              <h3 className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-4">Details</h3>
              <div className="space-y-3 text-sm">
                <div><p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Requested By</p><p className="text-[var(--theme-text)] mt-0.5">{po.requested_by_name}</p></div>
                {po.approved_by_name && <div><p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Approved By</p><p className="text-[var(--theme-text)] mt-0.5">{po.approved_by_name}</p></div>}
                <div><p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Created</p><p className="text-[var(--theme-text)] mt-0.5">{new Date(po.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
                {po.expected_date && <div><p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Expected Date</p><p className="text-[var(--theme-text)] mt-0.5">{new Date(po.expected_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>}
                {po.approved_at && <div><p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Approved At</p><p className="text-[var(--theme-text)] mt-0.5">{new Date(po.approved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>}
                {po.rejected_at && <div><p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Rejected At</p><p className="text-[var(--theme-text)] mt-0.5">{new Date(po.rejected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>}
              </div>
            </div>

            {/* Actions */}
            {po.status === 'pending_approval' && (
              <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 space-y-3">
                <h3 className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Actions</h3>
                {!showRejectForm ? (
                  <>
                    <button onClick={handleApprove} disabled={actionLoading} className="w-full py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all">
                      {actionLoading ? '...' : 'Approve'}
                    </button>
                    <button onClick={() => setShowRejectForm(true)} disabled={actionLoading} className="w-full py-3 bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)] font-black rounded-cinematic text-sm uppercase tracking-widest hover:bg-[var(--theme-destructive)]/20 disabled:opacity-50 transition-all border border-[var(--theme-destructive)]/20">
                      Reject
                    </button>
                    <button onClick={handleCancel} disabled={actionLoading} className="w-full py-3 bg-[var(--theme-card)] text-[var(--theme-text-muted)] font-black rounded-cinematic text-sm uppercase tracking-widest hover:bg-[var(--theme-border)]/30 disabled:opacity-50 transition-all">
                      Cancel PO
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-[var(--theme-text)]">Reason for rejection *</p>
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      rows={3}
                      className={inputCls}
                      placeholder="Explain why this PO is being rejected..."
                    />
                    <button onClick={handleReject} disabled={actionLoading} className="w-full py-3 bg-[var(--theme-destructive)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all">
                      {actionLoading ? '...' : 'Confirm Rejection'}
                    </button>
                    <button onClick={() => setShowRejectForm(false)} className="w-full py-2 text-[var(--theme-text-muted)] text-sm font-bold hover:text-[var(--theme-text)] transition-colors">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {po.status === 'approved' && (
              <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 space-y-3">
                <h3 className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Actions</h3>
                <p className="text-xs text-[var(--theme-text-muted)]">When you receive and pay the bill for this PO, create the bill from the Bills section and link it to this PO.</p>
                <Link href="/dashboard/bills/new" className="block text-center py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 transition-all no-underline">
                  Create Linked Bill
                </Link>
                <button onClick={handleCancel} disabled={actionLoading} className="w-full py-3 bg-[var(--theme-card)] text-[var(--theme-text-muted)] font-black rounded-cinematic text-sm uppercase tracking-widest hover:bg-[var(--theme-border)]/30 disabled:opacity-50 transition-all">
                  Cancel PO
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
