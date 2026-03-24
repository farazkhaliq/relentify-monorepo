'use client';
import { useEffect, useState, useCallback } from 'react';
import { Toaster, toast, DatePicker } from '@relentify/ui';
import { usePeriodLock } from '@/src/hooks/usePeriodLock';
import Attachments from '@/src/components/Attachments';
import Comments from '@/src/components/Comments';

type Expense = {
  id: string;
  date: string;
  description: string;
  category: string;
  gross_amount: string;
  vat_amount: string;
  status: 'pending' | 'reimbursed' | 'pending_approval' | 'approved' | 'rejected';
  notes: string | null;
  rejection_reason?: string | null;
  approved_by_id?: string | null;
};

type MileageClaim = {
  id: string;
  date: string;
  description: string;
  from_location: string | null;
  to_location: string | null;
  miles: string;
  rate: string;
  amount: string;
  status?: 'pending' | 'pending_approval' | 'approved' | 'rejected';
  rejection_reason?: string | null;
};

const EXPENSE_CATEGORIES: Record<string, string> = {
  general: 'General',
  meals: 'Meals & Entertainment',
  accommodation: 'Accommodation',
  travel: 'Travel',
  equipment: 'Equipment',
  subscriptions: 'Subscriptions',
  professional_services: 'Professional Services',
  other: 'Other',
};

const VAT_RATES = [
  { label: '0%', value: '0' },
  { label: '5%', value: '5' },
  { label: '20%', value: '20' },
  { label: 'Custom', value: 'custom' },
];

const HMRC_RATE = 0.45;

const inputCls = 'w-full px-3 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:ring-2 focus:ring-[var(--theme-accent)] focus:border-[var(--theme-accent)] outline-none transition-all text-sm';
const labelCls = 'block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1.5';

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function ExpensesPage() {
  const { earliestOpenDate, isDateLocked, lockedMessage } = usePeriodLock();
  const [tab, setTab] = useState<'expenses' | 'mileage'>('expenses');

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expLoading, setExpLoading] = useState(true);
  const [showExpForm, setShowExpForm] = useState(false);
  const [expForm, setExpForm] = useState({
    date: today(), description: '', category: 'general',
    grossAmount: '', vatRate: '20', customVat: '', notes: '',
  });
  const [expSaving, setExpSaving] = useState(false);

  // Mileage state
  const [claims, setClaims] = useState<MileageClaim[]>([]);
  const [milLoading, setMilLoading] = useState(true);
  const [showMilForm, setShowMilForm] = useState(false);
  const [milForm, setMilForm] = useState({
    date: today(), description: '', fromLocation: '', toLocation: '',
    miles: '', rate: String(HMRC_RATE),
  });
  const [milSaving, setMilSaving] = useState(false);

  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [expandedMileageId, setExpandedMileageId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  // Pending approvals state
  const [pendingApprovals, setPendingApprovals] = useState<{ expenses: any[]; mileage: any[] } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ type: 'expense' | 'mileage'; id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  const loadExpenses = useCallback(async () => {
    setExpLoading(true);
    try {
      const r = await fetch('/api/expenses');
      const d = await r.json();
      if (d.expenses) setExpenses(d.expenses);
    } catch { toast('Failed to load expenses', 'error'); }
    finally { setExpLoading(false); }
  }, []);

  const loadMileage = useCallback(async () => {
    setMilLoading(true);
    try {
      const r = await fetch('/api/mileage');
      const d = await r.json();
      if (d.claims) setClaims(d.claims);
    } catch { toast('Failed to load mileage', 'error'); }
    finally { setMilLoading(false); }
  }, []);

  const loadPendingApprovals = useCallback(async () => {
    try {
      const r = await fetch('/api/expenses/pending-approvals');
      if (r.ok) {
        const d = await r.json();
        if (d.expenses || d.mileage) setPendingApprovals({ expenses: d.expenses || [], mileage: d.mileage || [] });
      }
    } catch { /* not an approver — ignore */ }
  }, []);

  useEffect(() => {
    loadExpenses(); loadMileage(); loadPendingApprovals();
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) {
        setCurrentUserId(d.user.id);
        setTargetUserId(d.actorId && d.actorId !== d.user.id ? d.actorId : null);
      }
    }).catch(() => {});
  }, [loadExpenses, loadMileage, loadPendingApprovals]);

  // Expense calculations
  const expNet = parseFloat(expForm.grossAmount) || 0;
  const isCustomVat = expForm.vatRate === 'custom';
  const vatRate = isCustomVat ? 0 : parseFloat(expForm.vatRate) || 0;
  const vatAmount = isCustomVat ? (parseFloat(expForm.customVat) || 0) : expNet * (vatRate / 100);
  const expTotal = expNet + vatAmount;

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    if (expNet <= 0) { toast('Enter a valid amount', 'error'); return; }
    setExpSaving(true);
    try {
      const r = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: expForm.date,
          description: expForm.description,
          category: expForm.category,
          grossAmount: expTotal,
          vatAmount,
          notes: expForm.notes || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast('Expense added', 'success');
      setShowExpForm(false);
      setExpForm({ date: today(), description: '', category: 'general', grossAmount: '', vatRate: '20', customVat: '', notes: '' });
      loadExpenses();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally { setExpSaving(false); }
  }

  async function reimburseExpense(id: string) {
    try {
      await fetch(`/api/expenses/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reimburse' }),
      });
      toast('Marked as reimbursed', 'success');
      loadExpenses();
    } catch { toast('Failed', 'error'); }
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return;
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    toast('Deleted', 'info');
    loadExpenses();
  }

  // Mileage calculations
  const milMiles = parseFloat(milForm.miles) || 0;
  const milRate = parseFloat(milForm.rate) || HMRC_RATE;
  const milAmount = Math.round(milMiles * milRate * 100) / 100;

  async function submitMileage(e: React.FormEvent) {
    e.preventDefault();
    if (milMiles <= 0) { toast('Enter valid mileage', 'error'); return; }
    setMilSaving(true);
    try {
      const r = await fetch('/api/mileage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: milForm.date,
          description: milForm.description,
          fromLocation: milForm.fromLocation || undefined,
          toLocation: milForm.toLocation || undefined,
          miles: milMiles,
          rate: milRate,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast('Mileage logged', 'success');
      setShowMilForm(false);
      setMilForm({ date: today(), description: '', fromLocation: '', toLocation: '', miles: '', rate: String(HMRC_RATE) });
      loadMileage();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally { setMilSaving(false); }
  }

  async function deleteMileage(id: string) {
    if (!confirm('Delete this mileage claim?')) return;
    await fetch(`/api/mileage/${id}`, { method: 'DELETE' });
    toast('Deleted', 'info');
    loadMileage();
  }

  async function approveItem(type: 'expense' | 'mileage', id: string) {
    const url = type === 'expense' ? `/api/expenses/${id}/approve` : `/api/mileage/${id}/approve`;
    const r = await fetch(url, { method: 'POST' });
    if (r.ok) {
      toast('Approved', 'success');
      loadPendingApprovals(); loadExpenses(); loadMileage();
    } else {
      const d = await r.json();
      toast(d.error || 'Failed', 'error');
    }
  }

  async function rejectItem() {
    if (!rejectModal || !rejectReason.trim()) return;
    setRejectLoading(true);
    const url = rejectModal.type === 'expense' ? `/api/expenses/${rejectModal.id}/reject` : `/api/mileage/${rejectModal.id}/reject`;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (r.ok) {
        toast('Rejected', 'info');
        setRejectModal(null); setRejectReason('');
        loadPendingApprovals(); loadExpenses(); loadMileage();
      } else {
        const d = await r.json();
        toast(d.error || 'Failed', 'error');
      }
    } finally { setRejectLoading(false); }
  }

  // Totals
  const pendingTotal = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + parseFloat(e.gross_amount), 0);
  const mileageTotal = claims.reduce((s, c) => s + parseFloat(c.amount), 0);
  const totalMiles = claims.reduce((s, c) => s + parseFloat(c.miles), 0);

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Expense Claims</h1>
          <button
            onClick={() => tab === 'expenses' ? setShowExpForm(v => !v) : setShowMilForm(v => !v)}
            className="px-5 py-2.5 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-[10px] uppercase tracking-widest hover:brightness-110 transition-all border-none cursor-pointer">
            + Add {tab === 'expenses' ? 'Expense' : 'Mileage'}
          </button>
        </div>

        {/* Pending Approvals Panel — shown only if this user is an approver */}
        {pendingApprovals && (pendingApprovals.expenses.length > 0 || pendingApprovals.mileage.length > 0) && (
          <div className="bg-[var(--theme-card)] border border-[var(--theme-warning)]/30 rounded-[2rem] p-6 mb-6 space-y-4">
            <h3 className="text-[10px] font-black text-[var(--theme-warning)] uppercase tracking-widest">Pending Your Approval</h3>
            {pendingApprovals.expenses.map((exp: any) => (
              <div key={exp.id} className="flex items-center justify-between gap-4 p-4 bg-[var(--theme-warning)]/5 border border-[var(--theme-warning)]/20 rounded-cinematic">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-[var(--theme-text)] text-sm mb-0.5">{exp.description}</p>
                  <p className="text-xs text-[var(--theme-text-muted)]">{exp.claimer_name || 'Team member'} · {new Date(exp.date).toLocaleDateString('en-GB')} · £{Number(exp.gross_amount).toFixed(2)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => approveItem('expense', exp.id)}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--theme-accent)] bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/20 rounded-lg cursor-pointer">
                    Approve
                  </button>
                  <button onClick={() => { setRejectModal({ type: 'expense', id: exp.id }); setRejectReason(''); }}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--theme-destructive)] bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 rounded-lg cursor-pointer">
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {pendingApprovals.mileage.map((cl: any) => (
              <div key={cl.id} className="flex items-center justify-between gap-4 p-4 bg-[var(--theme-warning)]/5 border border-[var(--theme-warning)]/20 rounded-cinematic">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-[var(--theme-text)] text-sm mb-0.5">{cl.description}</p>
                  <p className="text-xs text-[var(--theme-text-muted)]">{cl.claimer_name || 'Team member'} · {new Date(cl.date).toLocaleDateString('en-GB')} · {Number(cl.miles).toFixed(1)} miles · £{Number(cl.amount).toFixed(2)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => approveItem('mileage', cl.id)}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--theme-accent)] bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/20 rounded-lg cursor-pointer">
                    Approve
                  </button>
                  <button onClick={() => { setRejectModal({ type: 'mileage', id: cl.id }); setRejectReason(''); }}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--theme-destructive)] bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 rounded-lg cursor-pointer">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex rounded-cinematic overflow-hidden border border-[var(--theme-border)] mb-6 w-fit">
          {(['expenses', 'mileage'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-none cursor-pointer transition-colors ${tab === t ? 'bg-[var(--theme-accent)] text-[var(--theme-text)]' : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-border)]/40'}`}>
              {t === 'expenses' ? 'Expense Claims' : 'Mileage'}
            </button>
          ))}
        </div>

        {/* ── EXPENSES TAB ── */}
        {tab === 'expenses' && (
          <>
            {/* Summary */}
            {expenses.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-4">
                  <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Pending</p>
                  <p className="text-xl font-black text-[var(--theme-warning)]">£{pendingTotal.toFixed(2)}</p>
                </div>
                <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-4">
                  <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Total Claims</p>
                  <p className="text-xl font-black text-[var(--theme-text)]">{expenses.length}</p>
                </div>
              </div>
            )}

            {/* Add Expense Form */}
            {showExpForm && (
              <form onSubmit={submitExpense} className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] p-6 mb-6 space-y-4">
                <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">New Expense</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Date *</label>
                    <DatePicker value={expForm.date} min={earliestOpenDate || undefined} onChange={v => setExpForm(p => ({ ...p, date: isDateLocked(v) ? (earliestOpenDate || v) : v }))} />
                    {lockedMessage(expForm.date) && <p className="mt-1 text-xs text-[var(--theme-warning)]">{lockedMessage(expForm.date)}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Category</label>
                    <select value={expForm.category} onChange={e => setExpForm(p => ({ ...p, category: e.target.value }))} className={inputCls + ' appearance-none'}>
                      {Object.entries(EXPENSE_CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Description *</label>
                  <input type="text" required value={expForm.description} onChange={e => setExpForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Client lunch, Train to London" className={inputCls} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Net Amount (ex. VAT) *</label>
                    <input type="number" required min="0.01" step="0.01" value={expForm.grossAmount}
                      onChange={e => setExpForm(p => ({ ...p, grossAmount: e.target.value }))}
                      onFocus={e => e.target.select()} placeholder="0.00" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>VAT</label>
                    <select value={expForm.vatRate} onChange={e => setExpForm(p => ({ ...p, vatRate: e.target.value }))} className={inputCls + ' appearance-none'}>
                      {VAT_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                </div>

                {isCustomVat && (
                  <div>
                    <label className={labelCls}>VAT Amount</label>
                    <input type="number" min="0" step="0.01" value={expForm.customVat}
                      onChange={e => setExpForm(p => ({ ...p, customVat: e.target.value }))}
                      onFocus={e => e.target.select()} placeholder="0.00" className={inputCls} />
                  </div>
                )}

                {expNet > 0 && (
                  <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-4 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--theme-text-muted)]">Net</span>
                      <span className="font-black text-[var(--theme-text)]">£{expNet.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--theme-text-muted)]">VAT</span>
                      <span className="font-black text-[var(--theme-text)]">£{vatAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-[var(--theme-border)] pt-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">Total</span>
                      <span className="font-black text-lg text-[var(--theme-text)]">£{expTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className={labelCls}>Notes</label>
                  <input type="text" value={expForm.notes} onChange={e => setExpForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional" className={inputCls} />
                </div>

                <div className="flex gap-3">
                  <button type="submit" disabled={expSaving}
                    className="px-6 py-2.5 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-[10px] uppercase tracking-widest hover:brightness-110 disabled:opacity-50 border-none cursor-pointer">
                    {expSaving ? 'Saving…' : 'Add Expense'}
                  </button>
                  <button type="button" onClick={() => setShowExpForm(false)}
                    className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] bg-transparent border-none cursor-pointer hover:text-[var(--theme-text)]">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Expenses list */}
            {expLoading ? (
              <div className="flex justify-center py-16">
                <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              </div>
            ) : expenses.length === 0 ? (
              <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] p-16 text-center">
                <p className="text-[var(--theme-text)] font-black text-lg mb-2">No expense claims yet</p>
                <p className="text-[var(--theme-text-muted)] text-sm">Record business expenses for reimbursement and VAT reclaim</p>
              </div>
            ) : (
              <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] overflow-hidden">
                <div className="divide-y divide-[var(--theme-border)]">
                  {expenses.map(exp => (
                    <div key={exp.id} className="p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-black text-[var(--theme-text)] text-sm truncate">{exp.description}</span>
                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-[var(--theme-border)] text-[var(--theme-text-muted)] bg-[var(--theme-card)]">
                              {EXPENSE_CATEGORIES[exp.category] || exp.category}
                            </span>
                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                              exp.status === 'reimbursed' || exp.status === 'approved'
                                ? 'border-[var(--theme-success)]/30 text-[var(--theme-success)] bg-[var(--theme-success)]/10'
                                : exp.status === 'rejected'
                                ? 'border-[var(--theme-destructive)]/30 text-[var(--theme-destructive)] bg-[var(--theme-destructive)]/10'
                                : exp.status === 'pending_approval'
                                ? 'border-[var(--theme-warning)]/30 text-[var(--theme-warning)] bg-[var(--theme-warning)]/10'
                                : 'border-[var(--theme-border)] text-[var(--theme-text-muted)] bg-[var(--theme-primary)]/3'
                            }`}>
                              {exp.status === 'pending_approval' ? 'Awaiting Approval' : exp.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[var(--theme-text-muted)]">
                            <span>{new Date(exp.date).toLocaleDateString('en-GB')}</span>
                            <span className="font-black text-[var(--theme-text-muted)]">£{Number(exp.gross_amount).toFixed(2)}</span>
                            {Number(exp.vat_amount) > 0 && <span>VAT £{Number(exp.vat_amount).toFixed(2)}</span>}
                            {exp.notes && <span className="truncate max-w-[160px]">{exp.notes}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(exp.status === 'pending' || exp.status === 'approved') && (
                            <button onClick={() => reimburseExpense(exp.id)}
                              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--theme-accent)] bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/20 rounded-lg hover:brightness-110 transition-all cursor-pointer">
                              Reimburse
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedExpenseId(expandedExpenseId === exp.id ? null : exp.id)}
                            className="text-[8px] font-black text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)] uppercase tracking-widest bg-transparent border border-[var(--theme-border)] rounded-lg px-2 py-1 transition-colors"
                            title="Attachments"
                          >📎</button>
                          <button onClick={() => deleteExpense(exp.id)}
                            className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)] bg-transparent border-none cursor-pointer transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                      {expandedExpenseId === exp.id && (
                        <div className="mt-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-xl px-4 py-3 space-y-3">
                          <Attachments recordType="expense" recordId={exp.id} />
                          {currentUserId && (
                            <Comments recordType="expense" recordId={exp.id} currentUserId={currentUserId} targetUserId={targetUserId} />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── MILEAGE TAB ── */}
        {tab === 'mileage' && (
          <>
            {/* Summary */}
            {claims.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-4">
                  <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Total Miles</p>
                  <p className="text-xl font-black text-[var(--theme-text)]">{totalMiles.toFixed(1)}</p>
                </div>
                <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-4">
                  <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Total Claim</p>
                  <p className="text-xl font-black text-[var(--theme-accent)]">£{mileageTotal.toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Add Mileage Form */}
            {showMilForm && (
              <form onSubmit={submitMileage} className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] p-6 mb-6 space-y-4">
                <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Log Mileage</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Date *</label>
                    <DatePicker value={milForm.date} min={earliestOpenDate || undefined} onChange={v => setMilForm(p => ({ ...p, date: isDateLocked(v) ? (earliestOpenDate || v) : v }))} />
                    {lockedMessage(milForm.date) && <p className="mt-1 text-xs text-[var(--theme-warning)]">{lockedMessage(milForm.date)}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Purpose *</label>
                    <input type="text" required value={milForm.description} onChange={e => setMilForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Client visit, Site survey" className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>From</label>
                    <input type="text" value={milForm.fromLocation} onChange={e => setMilForm(p => ({ ...p, fromLocation: e.target.value }))} placeholder="e.g. Manchester" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>To</label>
                    <input type="text" value={milForm.toLocation} onChange={e => setMilForm(p => ({ ...p, toLocation: e.target.value }))} placeholder="e.g. Leeds" className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Miles *</label>
                    <input type="number" required min="0.1" step="0.1" value={milForm.miles}
                      onChange={e => setMilForm(p => ({ ...p, miles: e.target.value }))}
                      onFocus={e => e.target.select()} placeholder="0.0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Rate (£/mile)</label>
                    <input type="number" min="0.01" step="0.01" value={milForm.rate}
                      onChange={e => setMilForm(p => ({ ...p, rate: e.target.value }))}
                      onFocus={e => e.target.select()} className={inputCls} />
                  </div>
                </div>

                {milMiles > 0 && (
                  <div className="bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/20 rounded-cinematic p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Claim Amount</p>
                      <p className="text-xs text-[var(--theme-accent)] mt-0.5">{milMiles} miles × £{milRate.toFixed(4)}</p>
                    </div>
                    <p className="text-2xl font-black text-[var(--theme-accent)]">£{milAmount.toFixed(2)}</p>
                  </div>
                )}

                <p className="text-[10px] text-[var(--theme-text-muted)]">HMRC approved rate: 45p/mile (first 10,000 miles), 25p/mile thereafter</p>

                <div className="flex gap-3">
                  <button type="submit" disabled={milSaving}
                    className="px-6 py-2.5 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-[10px] uppercase tracking-widest hover:brightness-110 disabled:opacity-50 border-none cursor-pointer">
                    {milSaving ? 'Saving…' : 'Log Mileage'}
                  </button>
                  <button type="button" onClick={() => setShowMilForm(false)}
                    className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] bg-transparent border-none cursor-pointer hover:text-[var(--theme-text)]">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Mileage list */}
            {milLoading ? (
              <div className="flex justify-center py-16">
                <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              </div>
            ) : claims.length === 0 ? (
              <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] p-16 text-center">
                <p className="text-[var(--theme-text)] font-black text-lg mb-2">No mileage claims yet</p>
                <p className="text-[var(--theme-text-muted)] text-sm">Log business journeys at the HMRC approved rate of 45p/mile</p>
              </div>
            ) : (
              <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] overflow-hidden">
                <div className="divide-y divide-[var(--theme-border)]">
                  {claims.map(cl => (
                    <div key={cl.id} className="p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-black text-[var(--theme-text)] text-sm">{cl.description}</p>
                            {cl.status && cl.status !== 'pending' && (
                              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                cl.status === 'approved'
                                  ? 'border-[var(--theme-success)]/30 text-[var(--theme-success)] bg-[var(--theme-success)]/10'
                                  : cl.status === 'rejected'
                                  ? 'border-[var(--theme-destructive)]/30 text-[var(--theme-destructive)] bg-[var(--theme-destructive)]/10'
                                  : 'border-[var(--theme-warning)]/30 text-[var(--theme-warning)] bg-[var(--theme-warning)]/10'
                              }`}>
                                {cl.status === 'pending_approval' ? 'Awaiting Approval' : cl.status}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[var(--theme-text-muted)] flex-wrap">
                            <span>{new Date(cl.date).toLocaleDateString('en-GB')}</span>
                            {cl.from_location && cl.to_location && (
                              <span>{cl.from_location} → {cl.to_location}</span>
                            )}
                            <span>{Number(cl.miles).toFixed(1)} miles @ £{Number(cl.rate).toFixed(4)}</span>
                            <span className="font-black text-[var(--theme-text-muted)]">£{Number(cl.amount).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setExpandedMileageId(expandedMileageId === cl.id ? null : cl.id)}
                            className="text-[8px] font-black text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)] uppercase tracking-widest bg-transparent border border-[var(--theme-border)] rounded-lg px-2 py-1 transition-colors"
                            title="Attachments"
                          >📎</button>
                          <button onClick={() => deleteMileage(cl.id)}
                            className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)] bg-transparent border-none cursor-pointer transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                      {expandedMileageId === cl.id && (
                        <div className="mt-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-xl px-4 py-3 space-y-3">
                          <Attachments recordType="mileage" recordId={cl.id} />
                          {currentUserId && (
                            <Comments recordType="expense" recordId={cl.id} currentUserId={currentUserId} targetUserId={targetUserId} />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--theme-primary)]/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h4 className="text-lg font-black text-[var(--theme-text)]">Rejection Reason</h4>
            <p className="text-sm text-[var(--theme-text-muted)]">Provide a reason — this will be emailed to the claimant.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Missing receipt, outside policy, duplicate claim…"
              className={inputCls + ' resize-none'}
            />
            <div className="flex gap-3">
              <button
                onClick={rejectItem}
                disabled={rejectLoading || !rejectReason.trim()}
                className="flex-1 px-4 py-2.5 bg-[var(--theme-destructive)] text-white font-black rounded-cinematic text-[10px] uppercase tracking-widest disabled:opacity-50 border-none cursor-pointer">
                {rejectLoading ? 'Rejecting…' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                disabled={rejectLoading}
                className="flex-1 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
