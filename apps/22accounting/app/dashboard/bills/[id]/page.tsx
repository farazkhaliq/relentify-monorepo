'use client';
import { useEffect, useState , use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toaster, toast, DatePicker } from '@relentify/ui';
import PeriodLockedModal from '@/src/components/layout/PeriodLockedModal';
import { parsePeriodLockedResponse, PeriodLockedError } from '@/src/lib/period-lock-helpers';
import Attachments from '@/src/components/Attachments';
import Comments from '@/src/components/Comments';

const SC: Record<string, string> = {
  unpaid:  'border-[var(--theme-accent)]/20 text-[var(--theme-accent)] bg-[var(--theme-accent)]/10',
  paid:    'border-[var(--theme-accent)]/30 text-[var(--theme-accent)] bg-[var(--theme-accent)]/10',
  overdue: 'border-[var(--theme-destructive)]/30 text-[var(--theme-destructive)] bg-[var(--theme-destructive)]/10',
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General', office: 'Office', travel: 'Travel',
  marketing: 'Marketing', utilities: 'Utilities', professional_services: 'Professional Services',
};

const currencySymbol: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$' };

interface BankAccount { id: string; code: number; name: string; }

export default function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [periodLockedError, setPeriodLockedError] = useState<PeriodLockedError | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  // Payment modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [paymentDate, setPaymentDate] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [payReference, setPayReference] = useState('');
  const [isPrepayment, setIsPrepayment] = useState(false);
  const [prepaymentMonths, setPrepaymentMonths] = useState('');
  const [prepaymentExpAcctId, setPrepaymentExpAcctId] = useState('');
  const [expenseAccounts, setExpenseAccounts] = useState<BankAccount[]>([]);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch(`/api/bills/${id}`).then(r => r.json()).then(d => {
      if (d.bill) setBill(d.bill); else router.push('/dashboard/bills');
    }).finally(() => setLoading(false));
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) {
        setCurrentUserId(d.user.id);
        setTargetUserId(d.actorId && d.actorId !== d.user.id ? d.actorId : null);
      }
    }).catch(() => {});
  }, [id, router]);

  function openPayModal() {
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPayReference('');
    setIsPrepayment(false);
    setPrepaymentMonths('');
    setPrepaymentExpAcctId('');
    setShowPayModal(true);
    if (bankAccounts.length === 0) {
      fetch('/api/bills/bank-accounts').then(r => r.json()).then(d => {
        if (d.accounts) {
          setBankAccounts(d.accounts);
          const defaultAcc = d.accounts.find((a: BankAccount) => a.code === 1200);
          if (defaultAcc) setBankAccountId(defaultAcc.id);
          else if (d.accounts.length > 0) setBankAccountId(d.accounts[0].id);
        }
      }).catch(() => {});
    }
    if (expenseAccounts.length === 0) {
      fetch('/api/accounts').then(r => r.json()).then(d => {
        if (d.accounts) {
          const expense = d.accounts.filter((a: BankAccount & { account_type: string }) =>
            a.account_type === 'EXPENSE' || a.account_type === 'COGS'
          );
          setExpenseAccounts(expense);
        }
      }).catch(() => {});
    }
  }

  async function recordPayment() {
    setPaying(true);
    try {
      const r = await fetch(`/api/bills/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentDate: paymentDate || undefined,
          bankAccountId: bankAccountId || undefined,
          reference: payReference.trim() || undefined,
          isPrepayment: isPrepayment || undefined,
          prepaymentMonths: isPrepayment && prepaymentMonths ? parseInt(prepaymentMonths) : undefined,
          prepaymentExpAcctId: isPrepayment && prepaymentExpAcctId ? prepaymentExpAcctId : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setBill(d.bill);
      setShowPayModal(false);
      toast('Bill marked as paid', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      setPaying(false);
    }
  }

  async function deleteBill() {
    if (!confirm('Delete this bill?')) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
      const locked = await parsePeriodLockedResponse(r);
      if (locked) { setPeriodLockedError(locked); setDeleting(false); return; }
      if (!r.ok) throw new Error('Failed to delete');
      toast('Bill deleted', 'success');
      setTimeout(() => router.push('/dashboard/bills'), 800);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
      setDeleting(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
    </div>
  );

  if (!bill) return null;

  const sym = currencySymbol[bill.currency] || '£';
  const inputCls = "w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:ring-2 focus:ring-[var(--theme-accent)] outline-none text-sm";
  const labelCls = "block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2";

  return (
    <div className="min-h-screen bg-background pb-32">
      <Toaster />

      {periodLockedError && (
        <PeriodLockedModal
          lockedThrough={periodLockedError.lockedThrough}
          reason={periodLockedError.reason}
          earliestUnlockedDate={periodLockedError.earliestUnlockedDate}
          correctingEntry={null}
          onClose={() => setPeriodLockedError(null)}
        />
      )}

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--theme-primary)]/60 backdrop-blur-sm" onClick={() => setShowPayModal(false)} />
          <div className="relative bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-[2rem] p-6 sm:p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-black text-[var(--theme-text)]">Record Payment</h3>
                <p className="text-[var(--theme-text-muted)] text-sm mt-0.5">{bill.supplier_name} — {sym}{Number(bill.amount).toFixed(2)}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] text-xl leading-none">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>Payment Date</label>
                <DatePicker value={paymentDate} onChange={setPaymentDate} />
              </div>

              {bankAccounts.length > 0 && (
                <div>
                  <label className={labelCls}>Paid From</label>
                  <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} className={inputCls + ' appearance-none'}>
                    {bankAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={labelCls}>Reference (optional)</label>
                <input type="text" value={payReference} onChange={e => setPayReference(e.target.value)} className={inputCls} placeholder="e.g. BACS ref, cheque number" />
              </div>

              {/* Prepayment toggle */}
              <div className="pt-2 border-t border-[var(--theme-border)]">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrepayment}
                    onChange={e => { setIsPrepayment(e.target.checked); if (!e.target.checked) { setPrepaymentMonths(''); setPrepaymentExpAcctId(''); } }}
                    className="w-4 h-4 accent-[var(--theme-accent)]"
                  />
                  <span className="text-sm font-bold text-[var(--theme-text)]">This is a prepayment (defers expense)</span>
                </label>
                {isPrepayment && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Spread over (months)</label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={prepaymentMonths}
                        onChange={e => setPrepaymentMonths(e.target.value)}
                        className={inputCls}
                        placeholder="e.g. 12"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Expense account</label>
                      <select value={prepaymentExpAcctId} onChange={e => setPrepaymentExpAcctId(e.target.value)} className={inputCls + ' appearance-none'}>
                        <option value="">Auto-detect</option>
                        {expenseAccounts.map((a: any) => (
                          <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPayModal(false)} className="flex-1 px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-text)] font-black rounded-cinematic text-sm uppercase tracking-widest hover:bg-[var(--theme-border)]/40 transition-all">
                Cancel
              </button>
              <button onClick={recordPayment} disabled={paying} className="flex-1 px-4 py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all">
                {paying ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-[var(--theme-background)]/95 backdrop-blur-sm border-b border-[var(--theme-border)] px-4 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 no-underline shrink-0">
            <span className="w-8 h-8 bg-[var(--theme-accent)] rounded-lg flex items-center justify-center shadow-lg"><span className="text-base font-black italic text-[var(--theme-text)]">R</span></span>
            <span className="text-lg font-black text-[var(--theme-text)] tracking-tighter">Relentify</span>
          </Link>
          <Link href="/dashboard/bills" className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest hover:text-[var(--theme-text)] no-underline shrink-0">← Bills</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">{bill.supplier_name}</h2>
            <p className="text-[var(--theme-text-muted)] text-sm mt-1">{CATEGORY_LABELS[bill.category] || bill.category}</p>
          </div>
          <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${SC[bill.status] || SC.unpaid}`}>{bill.status}</span>
        </div>

        <div className="bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-[2rem] p-8 space-y-5 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Amount</span>
            <span className="text-2xl font-black text-[var(--theme-text)]">{sym}{Number(bill.amount).toFixed(2)}</span>
          </div>
          <div className="border-t border-[var(--theme-border)]" />
          {bill.invoice_date && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Invoice Date</span>
                <span className="text-[var(--theme-text)] font-bold">{new Date(bill.invoice_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="border-t border-[var(--theme-border)]" />
            </>
          )}
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Due Date</span>
            <span className="text-[var(--theme-text)] font-bold">{new Date(bill.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          {bill.reference && (
            <>
              <div className="border-t border-[var(--theme-border)]" />
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Reference</span>
                <span className="text-[var(--theme-text)] font-bold">{bill.reference}</span>
              </div>
            </>
          )}
          {bill.paid_at && (
            <>
              <div className="border-t border-[var(--theme-border)]" />
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Paid</span>
                <span className="text-[var(--theme-accent)] font-bold">{new Date(bill.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </>
          )}
          {bill.notes && (
            <>
              <div className="border-t border-[var(--theme-border)]" />
              <div>
                <span className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest block mb-2">Notes</span>
                <p className="text-[var(--theme-text-muted)] text-sm">{bill.notes}</p>
              </div>
            </>
          )}
        </div>

        <Attachments recordType="bill" recordId={id} />
        {currentUserId && (
          <Comments recordType="bill" recordId={id} currentUserId={currentUserId} targetUserId={targetUserId} />
        )}
        <button
          onClick={deleteBill}
          disabled={deleting}
          className="text-[10px] font-black text-[var(--theme-destructive)] hover:text-[var(--theme-destructive)] uppercase tracking-widest bg-transparent border-none cursor-pointer disabled:opacity-50 transition-colors"
        >
          {deleting ? 'Deleting...' : 'Delete Bill'}
        </button>
      </main>

      {/* Sticky bottom action bar */}
      {bill.status !== 'paid' && (
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--theme-background)]/95 backdrop-blur-sm border-t border-[var(--theme-border)] p-4 z-40">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={openPayModal}
              className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-lg active:scale-[0.98]"
            >
              Record Payment ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
