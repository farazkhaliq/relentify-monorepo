'use client';
import { useEffect, useState , use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toaster, toast } from '@relentify/ui';

interface Quote {
  id: string; quote_number: string; client_name: string; client_email: string | null;
  client_address: string | null; issue_date: string; valid_until: string;
  subtotal: string; tax_rate: string; tax_amount: string; total: string;
  currency: string; status: string; notes: string | null;
  converted_invoice_id: string | null;
  items: { id: string; description: string; quantity: string; unit_price: string; amount: string }[];
}

const STATUS_STYLES: Record<string, { pill: string; dot: string }> = {
  draft:    { pill: 'bg-[var(--theme-primary)]/3 text-[var(--theme-text-muted)] border-[var(--theme-border)]',             dot: 'bg-[var(--theme-primary)]/3' },
  sent:     { pill: 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border-[var(--theme-accent)]/20',          dot: 'bg-[var(--theme-accent)]' },
  accepted: { pill: 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border-[var(--theme-accent)]/30', dot: 'bg-[var(--theme-accent)]' },
  declined: { pill: 'bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)] border-[var(--theme-destructive)]/30',             dot: 'bg-[var(--theme-destructive)]' },
  expired:  { pill: 'bg-[var(--theme-primary)]/3 text-[var(--theme-text-muted)] border-[var(--theme-border)]',             dot: 'bg-[var(--theme-primary)]/3' },
};

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function QuoteDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [qt, setQt] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    fetch(`/api/quotes/${id}`).then(r => r.json()).then(d => {
      if (d.quote) setQt(d.quote);
    }).finally(() => setLoading(false));
  }, [id]);

  async function sendToClient() {
    if (!qt) return;
    setActionLoading('send');
    try {
      const r = await fetch(`/api/quotes/${id}/send`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setQt(p => p ? { ...p, status: 'sent' } : p);
      toast('Quote sent to client', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to send', 'error');
    } finally { setActionLoading(''); }
  }

  async function setStatus(status: string) {
    if (!qt) return;
    setActionLoading(status);
    try {
      const r = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setQt(p => p ? { ...p, status } : p);
      toast(status === 'sent' ? 'Marked as sent' : status === 'declined' ? 'Marked as declined' : 'Updated', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally { setActionLoading(''); }
  }

  async function convertToInvoice() {
    if (!qt) return;
    if (!confirm('Convert this quote to an invoice? The quote will be marked as accepted.')) return;
    setActionLoading('convert');
    try {
      const r = await fetch(`/api/quotes/${id}/convert`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast('Invoice created from quote', 'success');
      router.push(`/dashboard/invoices/${d.invoice.id}`);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to convert', 'error');
      setActionLoading('');
    }
  }

  async function del() {
    if (!confirm('Delete this quote?')) return;
    setActionLoading('delete');
    const r = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
    if (r.ok) router.push('/dashboard/quotes');
    else { toast('Failed to delete', 'error'); setActionLoading(''); }
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
    </div>
  );

  if (!qt) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-[var(--theme-destructive)] font-bold mb-4">Quote not found</p>
        <Link href="/dashboard/quotes" className="text-[var(--theme-accent)] text-sm font-bold no-underline">← Back to quotes</Link>
      </div>
    </div>
  );

  const sym: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$' };
  const cs = sym[qt.currency] || '£';
  const status = STATUS_STYLES[qt.status] || STATUS_STYLES.draft;
  const isVat = Number(qt.tax_rate) > 0;
  const isActive = ['draft', 'sent'].includes(qt.status);

  return (
    <div className="min-h-screen bg-background">
      <Toaster />

      <div className="bg-[var(--theme-background)] border-b border-[var(--theme-border)] sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard/quotes" className="flex items-center gap-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] no-underline transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            <span className="text-sm font-bold">Quotes</span>
          </Link>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${status.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {qt.status}
          </span>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-36 space-y-4">

        {/* Hero */}
        <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6">
          <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Quote</p>
          <h1 className="text-2xl font-black text-[var(--theme-text)] mb-4">{qt.quote_number}</h1>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Prepared For</p>
              <p className="text-[var(--theme-text)] font-black text-lg leading-tight">{qt.client_name}</p>
              {qt.client_email && <p className="text-[var(--theme-text-muted)] text-sm mt-0.5">{qt.client_email}</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">{qt.currency}</p>
              <p className="text-3xl font-black text-[var(--theme-text)]">{cs}{Number(qt.total).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic p-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Issued</p>
            <p className="text-[var(--theme-text)] font-bold text-sm">{fmt(qt.issue_date)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Valid Until</p>
            <p className={`font-bold text-sm ${qt.status === 'expired' ? 'text-[var(--theme-destructive)]' : 'text-[var(--theme-text)]'}`}>{fmt(qt.valid_until)}</p>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--theme-border)] bg-[var(--theme-card)]">
            <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Items</p>
          </div>
          <div className="divide-y divide-[var(--theme-border)]">
            {qt.items.map(item => (
              <div key={item.id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--theme-text)] font-bold text-sm leading-snug">{item.description}</p>
                  <p className="text-[var(--theme-text-muted)] text-xs mt-1">{Number(item.quantity)} × {cs}{Number(item.unit_price).toFixed(2)}</p>
                </div>
                <p className="text-[var(--theme-text)] font-black text-sm shrink-0">{cs}{Number(item.amount).toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--theme-border)] px-5 py-4 space-y-2 bg-[var(--theme-card)]">
            <div className="flex items-center justify-between">
              <span className="text-[var(--theme-text-muted)] text-sm">Subtotal</span>
              <span className="text-[var(--theme-text)] font-bold text-sm">{cs}{Number(qt.subtotal).toFixed(2)}</span>
            </div>
            {isVat && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--theme-text-muted)] text-sm">VAT ({Number(qt.tax_rate)}%)</span>
                <span className="text-[var(--theme-text)] text-sm">{cs}{Number(qt.tax_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--theme-border)]">
              <span className="text-[var(--theme-text)] font-black">Total</span>
              <span className="text-xl font-black text-[var(--theme-accent)]">{cs}{Number(qt.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {qt.notes && (
          <div className="bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic p-5">
            <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Notes</p>
            <p className="text-[var(--theme-text)] text-sm leading-relaxed">{qt.notes}</p>
          </div>
        )}

        {qt.converted_invoice_id && (
          <div className="bg-[var(--theme-accent)]/5 border border-[var(--theme-accent)]/20 rounded-cinematic p-5">
            <p className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-2">Converted to Invoice</p>
            <Link href={`/dashboard/invoices/${qt.converted_invoice_id}`} className="text-[var(--theme-accent)] hover:text-[var(--theme-accent)] text-sm font-bold no-underline">
              View Invoice →
            </Link>
          </div>
        )}

      </main>

      {/* Sticky action bar */}
      {(isActive || qt.status === 'sent') && (
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--theme-background)]/95 backdrop-blur-md border-t border-[var(--theme-border)] p-4">
          <div className="max-w-2xl mx-auto space-y-3">
            {qt.status === 'draft' && qt.client_email && (
              <button onClick={sendToClient} disabled={!!actionLoading}
                className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 border-none cursor-pointer">
                {actionLoading === 'send' ? 'Sending…' : 'Send to Client →'}
              </button>
            )}
            {qt.status === 'draft' && !qt.client_email && (
              <button onClick={() => setStatus('sent')} disabled={!!actionLoading}
                className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 border-none cursor-pointer">
                {actionLoading === 'sent' ? 'Updating…' : 'Mark as Sent →'}
              </button>
            )}
            {qt.status === 'sent' && (
              <button onClick={convertToInvoice} disabled={actionLoading === 'convert'}
                className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 border-none cursor-pointer">
                {actionLoading === 'convert' ? 'Converting…' : 'Accept & Convert to Invoice →'}
              </button>
            )}
            <div className="flex gap-3">
              {qt.status === 'sent' && (
                <button onClick={() => setStatus('declined')} disabled={actionLoading === 'declined'}
                  className="flex-1 py-3 text-[var(--theme-destructive)] font-black rounded-cinematic text-[10px] uppercase tracking-widest border border-[var(--theme-destructive)]/20 hover:bg-[var(--theme-destructive)]/10 bg-transparent cursor-pointer disabled:opacity-50 transition-all">
                  {actionLoading === 'declined' ? 'Updating…' : 'Mark Declined'}
                </button>
              )}
              {qt.status === 'draft' && (
                <button onClick={del} disabled={actionLoading === 'delete'}
                  className="flex-1 py-3 text-[var(--theme-destructive)] font-black rounded-cinematic text-[10px] uppercase tracking-widest border border-[var(--theme-destructive)]/20 hover:bg-[var(--theme-destructive)]/10 bg-transparent cursor-pointer disabled:opacity-50 transition-all">
                  {actionLoading === 'delete' ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
