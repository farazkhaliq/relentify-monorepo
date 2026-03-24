'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Toaster, toast, DatePicker } from '@relentify/ui';
import { usePeriodLock } from '@/src/hooks/usePeriodLock';

interface COAAccount { id: string; code: number; name: string; account_type: string; is_active: boolean; }
interface JournalLine { accountId: string; description: string; debit: string; credit: string; }

const inputCls = 'w-full px-3 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:ring-2 focus:ring-[var(--theme-accent)] focus:border-[var(--theme-accent)] outline-none text-sm';
const labelCls = 'block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1.5';

const COMMON_JOURNALS = [
  {
    label: 'Accrual', description: 'Accrued expense / income not yet invoiced',
    lines: [
      { accountId: '', description: 'Accrued expense', debit: '', credit: '' },
      { accountId: '', description: 'Accruals control', debit: '', credit: '' },
    ],
  },
  {
    label: 'Prepayment', description: 'Expense paid in advance',
    lines: [
      { accountId: '', description: 'Prepayment asset', debit: '', credit: '' },
      { accountId: '', description: 'Expense account', debit: '', credit: '' },
    ],
  },
  {
    label: 'Depreciation', description: 'Fixed asset depreciation charge',
    lines: [
      { accountId: '', description: 'Depreciation charge', debit: '', credit: '' },
      { accountId: '', description: 'Accumulated depreciation', debit: '', credit: '' },
    ],
  },
  {
    label: 'Correction', description: 'Reclassify between accounts',
    lines: [
      { accountId: '', description: 'Reclassification Dr', debit: '', credit: '' },
      { accountId: '', description: 'Reclassification Cr', debit: '', credit: '' },
    ],
  },
];

function AccountSelect({ value, onChange, accounts }: {
  value: string;
  onChange: (id: string) => void;
  accounts: COAAccount[];
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const selected = accounts.find(a => a.id === value);
  const filtered = accounts.filter(a =>
    a.is_active && (
      search === '' ||
      String(a.code).includes(search) ||
      a.name.toLowerCase().includes(search.toLowerCase())
    )
  ).slice(0, 30);

  const grouped = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'COGS', 'EXPENSE'].reduce((acc, type) => {
    const rows = filtered.filter(a => a.account_type === type);
    if (rows.length) acc[type] = rows;
    return acc;
  }, {} as Record<string, COAAccount[]>);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${inputCls} text-left flex items-center justify-between`}
      >
        <span className={selected ? 'text-[var(--theme-text)]' : 'text-[var(--theme-text-muted)]'}>
          {selected ? `${selected.code} — ${selected.name}` : 'Select account…'}
        </span>
        <svg className="w-4 h-4 text-[var(--theme-text-muted)] shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic shadow-xl max-h-64 overflow-y-auto">
          <div className="p-2 border-b border-[var(--theme-border)] sticky top-0 bg-[var(--theme-card)]">
            <input
              autoFocus
              type="text"
              placeholder="Search account or code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--theme-text)] outline-none"
            />
          </div>
          {Object.entries(grouped).map(([type, rows]) => (
            <div key={type}>
              <div className="px-3 py-1 text-[9px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest bg-[var(--theme-card)]">{type}</div>
              {rows.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { onChange(a.id); setOpen(false); setSearch(''); }}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--theme-accent)]/10 transition-colors flex items-center gap-3"
                >
                  <span className="text-xs text-[var(--theme-text-muted)] w-10 shrink-0">{a.code}</span>
                  <span className="text-sm text-[var(--theme-text)]">{a.name}</span>
                </button>
              ))}
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="px-4 py-3 text-sm text-[var(--theme-text-muted)] text-center">No accounts match</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function NewJournalPage() {
  const router = useRouter();
  const { earliestOpenDate, isDateLocked, lockedMessage } = usePeriodLock();
  const [accounts, setAccounts] = useState<COAAccount[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: '', description: '', debit: '', credit: '' },
    { accountId: '', description: '', debit: '', credit: '' },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then(d => { if (d.accounts) setAccounts(d.accounts); })
      .catch(() => {});
  }, []);

  function updateLine(i: number, field: keyof JournalLine, value: string) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  function addLine() {
    setLines(prev => [...prev, { accountId: '', description: '', debit: '', credit: '' }]);
  }

  function removeLine(i: number) {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }

  function applyTemplate(tpl: typeof COMMON_JOURNALS[0]) {
    setDescription(tpl.description);
    setLines(tpl.lines.map(l => ({ ...l })));
  }

  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const balanced = diff < 0.005;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!balanced) { toast(`Journal doesn't balance — debits £${totalDebit.toFixed(2)} vs credits £${totalCredit.toFixed(2)}`, 'error'); return; }
    if (lines.some(l => !l.accountId)) { toast('All lines must have an account selected', 'error'); return; }
    if (lines.every(l => !parseFloat(l.debit) && !parseFloat(l.credit))) { toast('At least one line must have an amount', 'error'); return; }

    setLoading(true);
    try {
      const r = await fetch('/api/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          reference: reference.trim() || undefined,
          description: description.trim() || undefined,
          lines: lines.map(l => ({
            accountId: l.accountId,
            description: l.description.trim() || undefined,
            debit:  parseFloat(l.debit)  || 0,
            credit: parseFloat(l.credit) || 0,
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast('Journal entry posted', 'success');
      setTimeout(() => router.push('/dashboard/journals'), 600);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to post journal', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">New Journal Entry</h1>
          <Link href="/dashboard/journals" className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest hover:text-[var(--theme-text)] no-underline">← Back</Link>
        </div>

        {/* Templates */}
        <div className="mb-6">
          <p className={labelCls}>Quick Templates</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_JOURNALS.map(tpl => (
              <button key={tpl.label} type="button" onClick={() => applyTemplate(tpl)}
                className="px-4 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] rounded-cinematic text-[10px] font-black uppercase tracking-widest hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] transition-all">
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Header */}
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8 space-y-4">
            <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Journal Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Date *</label>
                <DatePicker value={date} min={earliestOpenDate || undefined} onChange={v => setDate(isDateLocked(v) ? (earliestOpenDate || v) : v)} />
                {lockedMessage(date) && <p className="mt-1 text-xs text-[var(--theme-warning)]">{lockedMessage(date)}</p>}
              </div>
              <div>
                <label className={labelCls}>Reference</label>
                <input type="text" value={reference} onChange={e => setReference(e.target.value)} className={inputCls} placeholder="e.g. ACC-2024-001" />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} className={inputCls} placeholder="e.g. Monthly accruals" />
              </div>
            </div>
          </div>

          {/* Lines */}
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8">
            <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Journal Lines</h2>

            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-12 gap-2 mb-2">
              <div className="col-span-4"><p className={labelCls}>Account</p></div>
              <div className="col-span-3"><p className={labelCls}>Narrative</p></div>
              <div className="col-span-2"><p className={labelCls}>Debit (£)</p></div>
              <div className="col-span-2"><p className={labelCls}>Credit (£)</p></div>
              <div className="col-span-1"></div>
            </div>

            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 sm:col-span-4">
                    <AccountSelect
                      value={line.accountId}
                      onChange={id => updateLine(i, 'accountId', id)}
                      accounts={accounts}
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-3">
                    <input
                      type="text"
                      value={line.description}
                      onChange={e => updateLine(i, 'description', e.target.value)}
                      placeholder="Narrative"
                      className={inputCls}
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.debit}
                      onChange={e => { updateLine(i, 'debit', e.target.value); if (e.target.value) updateLine(i, 'credit', ''); }}
                      onFocus={e => e.target.select()}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.credit}
                      onChange={e => { updateLine(i, 'credit', e.target.value); if (e.target.value) updateLine(i, 'debit', ''); }}
                      onFocus={e => e.target.select()}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-center">
                    {lines.length > 2 && (
                      <button type="button" onClick={() => removeLine(i)} className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)] transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={addLine}
              className="mt-3 text-[10px] font-black uppercase tracking-widest text-[var(--theme-accent)] hover:text-[var(--theme-accent)] transition-colors bg-transparent border-none cursor-pointer">
              + Add Line
            </button>

            {/* Totals */}
            <div className="mt-5 border-t border-[var(--theme-border)] pt-4">
              <div className="flex justify-end">
                <div className="grid grid-cols-3 gap-8 text-right">
                  <div>
                    <p className={labelCls}>Total Debits</p>
                    <p className="font-black text-[var(--theme-text)]">£{totalDebit.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className={labelCls}>Total Credits</p>
                    <p className="font-black text-[var(--theme-text)]">£{totalCredit.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className={labelCls}>Difference</p>
                    <p className={`font-black text-lg ${balanced ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'}`}>
                      {balanced ? '✓ Balanced' : `£${diff.toFixed(2)}`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !balanced}
            className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98]"
          >
            {loading ? 'Posting…' : 'Post Journal Entry'}
          </button>

          {!balanced && totalDebit > 0 && (
            <p className="text-center text-sm text-[var(--theme-destructive)] font-bold">Journal must balance before posting</p>
          )}
        </form>
      </main>
    </div>
  );
}
