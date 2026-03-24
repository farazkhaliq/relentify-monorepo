'use client';
import { useEffect, useState , use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toaster, toast, DatePicker } from '@relentify/ui';
import PeriodLockedModal from '@/src/components/layout/PeriodLockedModal';
import { parsePeriodLockedResponse, PeriodLockedError } from '@/src/lib/period-lock-helpers';
import Comments from '@/src/components/Comments';

interface Inv {
  id: string; invoice_number: string; client_name: string; client_email: string | null;
  client_address: string | null; issue_date: string; due_date: string; subtotal: string;
  tax_rate: string; tax_amount: string; total: string; currency: string; status: string;
  stripe_payment_link: string | null; notes: string | null; terms: string | null;
  payment_terms: string | null;
  items: { id: string; description: string; quantity: string; unit_price: string; amount: string }[];
}
interface UserProfile { vat_registered: boolean; vat_number: string | null; business_name: string | null; }
interface BankAccount { id: string; code: number; name: string; }

const STATUS_STYLES: Record<string, { pill: string; dot: string }> = {
  draft:     { pill: 'bg-[var(--theme-primary)]/5 text-[var(--theme-text-muted)] border-[var(--theme-border)]',        dot: 'bg-[var(--theme-text-dim)]' },
  sent:      { pill: 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border-[var(--theme-accent)]/20',     dot: 'bg-[var(--theme-accent)]' },
  paid:      { pill: 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border-[var(--theme-accent)]/30', dot: 'bg-[var(--theme-accent)]' },
  overdue:   { pill: 'bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)] border-[var(--theme-destructive)]/30',        dot: 'bg-[var(--theme-destructive)]' },
  cancelled: { pill: 'bg-[var(--theme-primary)]/5 text-[var(--theme-text-muted)] border-[var(--theme-border)]',        dot: 'bg-[var(--theme-text-dim)]' },
};

function formatTerms(terms: string | null): string {
  if (!terms) return '';
  const map: Record<string, string> = { due_on_receipt: 'Due on Receipt', net_7: 'Net 7', net_14: 'Net 14', net_30: 'Net 30', net_60: 'Net 60', custom: 'Custom' };
  return map[terms] || terms;
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [inv, setInv] = useState<Inv | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [periodLockedError, setPeriodLockedError] = useState<PeriodLockedError | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const router = useRouter();

  // Payment modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [paymentDate, setPaymentDate] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [payReference, setPayReference] = useState('');
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [invRes, userRes, meRes] = await Promise.all([
          fetch(`/api/invoices/${id}`),
          fetch('/api/user'),
          fetch('/api/auth/me'),
        ]);
        const invData = await invRes.json();
        const userData = await userRes.json();
        const meData = await meRes.json().catch(() => null);
        if (invData.error) throw new Error();
        setInv(invData.invoice);
        if (userData.user) setUserProfile(userData.user);
        if (meData?.user) {
          setCurrentUserId(meData.user.id);
          setTargetUserId(meData.actorId && meData.actorId !== meData.user.id ? meData.actorId : null);
        }
      } catch { setError('Invoice not found'); }
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  async function send() {
    if (!inv) return;
    setSending(true);
    try {
      const r = await fetch(`/api/invoices/${inv.id}/send`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setInv(p => p ? { ...p, status: 'sent', stripe_payment_link: d.paymentLink } : p);
      toast('Invoice sent — payment link generated', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to send', 'error');
    } finally { setSending(false); }
  }

  async function del() {
    if (!inv) return;
    setDeleting(true);
    const r = await fetch(`/api/invoices/${inv.id}`, { method: 'DELETE' });
    const locked = await parsePeriodLockedResponse(r);
    if (locked) { setPeriodLockedError(locked); setDeleting(false); return; }
    if (r.ok) { router.push('/dashboard/invoices'); router.refresh(); }
    else { toast('Failed to delete', 'error'); setDeleting(false); }
  }

  function openPayModal() {
    if (!inv) return;
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPayAmount(Number(inv.total).toFixed(2));
    setPayReference('');
    setShowPayModal(true);
    if (bankAccounts.length === 0) {
      fetch('/api/bills/bank-accounts').then(r => r.json()).then(d => {
        if (d.accounts) {
          setBankAccounts(d.accounts);
          const def = d.accounts.find((a: BankAccount) => a.code === 1200);
          if (def) setBankAccountId(def.id);
          else if (d.accounts.length > 0) setBankAccountId(d.accounts[0].id);
        }
      }).catch(() => {});
    }
  }

  async function recordPayment() {
    if (!inv) return;
    setRecording(true);
    try {
      const r = await fetch(`/api/invoices/${inv.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentDate: paymentDate || undefined,
          amount: parseFloat(payAmount) || undefined,
          bankAccountId: bankAccountId || undefined,
          reference: payReference.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setInv(p => p ? { ...p, status: 'paid' } : p);
      setShowPayModal(false);
      toast('Payment recorded', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to record payment', 'error');
    } finally { setRecording(false); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  if (!inv) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-[var(--theme-destructive)] font-bold mb-4">{error || 'Not found'}</p>
        <Link href="/dashboard/invoices" className="text-[var(--theme-accent)] text-sm font-bold no-underline">← Back to invoices</Link>
      </div>
    </div>
  );

  const isVat = userProfile?.vat_registered && Number(inv.tax_rate) > 0;
  const sym: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$' };
  const cs = sym[inv.currency] || '£';
  const status = STATUS_STYLES[inv.status] || STATUS_STYLES.draft;

  return (
    <div className="min-h-screen bg-[var(--theme-background)]">
      <Toaster />

      {periodLockedError && inv && (
        <PeriodLockedModal
          lockedThrough={periodLockedError.lockedThrough}
          reason={periodLockedError.reason}
          earliestUnlockedDate={periodLockedError.earliestUnlockedDate}
          correctingEntry={null}
          onClose={() => setPeriodLockedError(null)}
        />
      )}

      {/* Record Payment Modal */}
      {showPayModal && inv && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--theme-primary)]/60 backdrop-blur-sm" onClick={() => setShowPayModal(false)} />
          <div className="relative bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-[2rem] p-6 sm:p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-black text-[var(--theme-text)]">Record Payment</h3>
                <p className="text-[var(--theme-text-muted)] text-sm mt-0.5">{inv.invoice_number} — {inv.client_name}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] text-xl leading-none bg-transparent border-none cursor-pointer">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Payment Date</label>
                <DatePicker value={paymentDate} onChange={setPaymentDate} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Amount Received</label>
                <input type="number" step="0.01" min="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  onFocus={e => e.target.select()}
                  className="w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] focus:ring-2 focus:ring-[var(--theme-accent)] outline-none text-sm" />
              </div>
              {bankAccounts.length > 0 && (
                <div>
                  <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Paid Into</label>
                  <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] focus:ring-2 focus:ring-[var(--theme-accent)] outline-none text-sm appearance-none">
                    {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Reference (optional)</label>
                <input type="text" value={payReference} onChange={e => setPayReference(e.target.value)}
                  placeholder="e.g. BACS ref, bank transfer ID"
                  className="w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-dim)] focus:ring-2 focus:ring-[var(--theme-accent)] outline-none text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPayModal(false)}
                className="flex-1 px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-text)] font-black rounded-cinematic text-sm uppercase tracking-widest hover:border-[var(--theme-accent)] transition-all">
                Cancel
              </button>
              <button onClick={recordPayment} disabled={recording}
                className="flex-1 px-4 py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all">
                {recording ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-[var(--theme-background)] border-b border-[var(--theme-border)] sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard/invoices" className="flex items-center gap-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] no-underline transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            <span className="text-sm font-bold">Invoices</span>
          </Link>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${status.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {inv.status}
          </span>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-36 space-y-4">

        {/* Hero — invoice number + total */}
        <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6 shadow-[var(--shadow-cinematic)]">
          <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Invoice</p>
          <h1 className="text-2xl font-black text-[var(--theme-text)] mb-4">{inv.invoice_number}</h1>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Billed To</p>
              <p className="text-[var(--theme-text)] font-black text-lg leading-tight">{inv.client_name}</p>
              {inv.client_email && <p className="text-[var(--theme-text-muted)] text-sm mt-0.5">{inv.client_email}</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">{inv.currency}</p>
              <p className="text-3xl font-black text-[var(--theme-accent)]">{cs}{Number(inv.total).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Issued</p>
            <p className="text-[var(--theme-text)] font-bold text-sm">{fmt(inv.issue_date)}</p>
          </div>
          {inv.payment_terms && (
            <div>
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Terms</p>
              <p className="text-[var(--theme-text)] font-bold text-sm">{formatTerms(inv.payment_terms)}</p>
            </div>
          )}
          {inv.payment_terms !== 'due_on_receipt' && (
            <div>
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Due</p>
              <p className={`font-bold text-sm ${inv.status === 'overdue' ? 'text-[var(--theme-destructive)]' : 'text-[var(--theme-text)]'}`}>{fmt(inv.due_date)}</p>
            </div>
          )}
          {userProfile?.vat_registered && userProfile.vat_number && (
            <div>
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">VAT No</p>
              <p className="text-[var(--theme-text)] font-bold text-sm">{userProfile.vat_number}</p>
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--theme-border)] bg-[var(--theme-background)]">
            <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Items</p>
          </div>
          <div className="divide-y divide-[var(--theme-border)]">
            {inv.items.map(item => (
              <div key={item.id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--theme-text)] font-bold text-sm leading-snug">{item.description}</p>
                  <p className="text-[var(--theme-text-muted)] text-xs mt-1">{Number(item.quantity)} × {cs}{Number(item.unit_price).toFixed(2)}</p>
                </div>
                <p className="text-[var(--theme-text)] font-black text-sm shrink-0">{cs}{Number(item.amount).toFixed(2)}</p>
              </div>
            ))}
          </div>
          {/* Totals */}
          <div className="border-t border-[var(--theme-border)] px-5 py-4 space-y-2 bg-[var(--theme-background)]">
            <div className="flex items-center justify-between">
              <span className="text-[var(--theme-text-muted)] text-sm">Subtotal</span>
              <span className="text-[var(--theme-text)] font-bold text-sm">{cs}{Number(inv.subtotal).toFixed(2)}</span>
            </div>
            {isVat && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--theme-text-muted)] text-sm">VAT ({Number(inv.tax_rate)}%)</span>
                <span className="text-[var(--theme-text-muted)] text-sm">{cs}{Number(inv.tax_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--theme-border)]">
              <span className="text-[var(--theme-text)] font-black">Total</span>
              <span className="text-xl font-black text-[var(--theme-accent)]">{cs}{Number(inv.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {inv.notes && (
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5">
            <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Notes</p>
            <p className="text-[var(--theme-text)] text-sm leading-relaxed">{inv.notes}</p>
          </div>
        )}

        {/* Payment link */}
        {inv.stripe_payment_link && (
          <div className="bg-[var(--theme-accent)]/5 border border-[var(--theme-accent)]/20 rounded-cinematic p-5">
            <p className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-3">Payment Link</p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(inv.stripe_payment_link)}&color=10b981&bgcolor=0a1628`}
                alt="Payment QR code"
                width={120}
                height={120}
                className="rounded-cinematic border border-[var(--theme-accent)]/20 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[var(--theme-text-muted)] text-xs mb-2">Scan to pay, or share the link:</p>
                <a href={inv.stripe_payment_link} target="_blank" rel="noopener noreferrer" className="text-[var(--theme-accent)] hover:text-[var(--theme-accent)] text-sm break-all no-underline">
                  {inv.stripe_payment_link}
                </a>
              </div>
            </div>
          </div>
        )}

        {currentUserId && (
          <Comments recordType="invoice" recordId={inv.id} currentUserId={currentUserId} targetUserId={targetUserId} />
        )}

      </main>

      {/* Actions — sticky bottom bar */}
      {(inv.status === 'sent' || inv.status === 'overdue') && (
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--theme-background)]/95 backdrop-blur-md border-t border-[var(--theme-border)] p-4">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={openPayModal}
              className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-lg active:scale-[0.98]"
            >
              Record Payment ✓
            </button>
          </div>
        </div>
      )}

      {inv.status === 'draft' && (
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--theme-background)]/95 backdrop-blur-md border-t border-[var(--theme-border)] p-4">
          <div className="max-w-2xl mx-auto flex flex-col gap-3">
            <button
              onClick={send}
              disabled={sending}
              className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {sending ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Generating...</>
              ) : 'Send & Get Payment Link'}
            </button>
            <div className="flex gap-3">
              <Link
                href={`/dashboard/invoices/${inv.id}/edit`}
                className="flex-1 py-3 text-[var(--theme-text)] font-black rounded-cinematic text-[10px] uppercase tracking-widest bg-[var(--theme-card)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)] transition-all flex items-center justify-center no-underline"
              >
                Edit Draft
              </Link>
              <button
                onClick={del}
                disabled={deleting}
                className="flex-1 py-3 text-[var(--theme-destructive)] font-black rounded-cinematic text-[10px] uppercase tracking-widest border border-[var(--theme-destructive)]/20 hover:bg-[var(--theme-destructive)]/10 bg-transparent cursor-pointer disabled:opacity-50 transition-all"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
