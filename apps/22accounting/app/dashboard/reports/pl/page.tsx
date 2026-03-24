'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DatePicker } from '@relentify/ui';

type Range = 'this_month' | 'last_3' | 'this_year' | 'custom';

function getRange(r: Range): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  if (r === 'this_month') return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) };
  if (r === 'last_3') { const d = new Date(today); d.setMonth(d.getMonth() - 3); return { from: fmt(d), to: fmt(today) }; }
  if (r === 'this_year') return { from: fmt(new Date(today.getFullYear(), 0, 1)), to: fmt(today) };
  return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) };
}

const RANGE_LABELS: Record<Range, string> = {
  this_month: 'This Month', last_3: 'Last 3 Months', this_year: 'This Year', custom: 'Custom',
};

interface GLRow { code: number; name: string; net: number; }

interface PLData {
  gl_income: GLRow[];
  gl_cogs: GLRow[];
  gl_expense: GLRow[];
  gl_totalIncome: number;
  gl_totalCOGS: number;
  gl_grossProfit: number;
  gl_totalExpense: number;
  gl_netProfit: number;
}

function fmt2(n: number) { return `£${Math.abs(n).toFixed(2)}`; }

function SectionTable({ rows, total, label, color }: { rows: GLRow[]; total: number; label: string; color: string; }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] overflow-hidden">
        <div className={`px-6 py-3 border-b border-[var(--theme-border)] flex items-center justify-between`}>
          <span className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{label}</span>
          <span className={`font-black text-sm ${color}`}>{fmt2(total)}</span>
        </div>
        <table className="w-full">
          <tbody className="divide-y divide-[var(--theme-border)]">
            {rows.filter(r => r.net !== 0).map(row => (
              <tr key={row.code} className="hover:bg-[var(--theme-border)]/20 transition-colors">
                <td className="px-6 py-3 text-[var(--theme-text-muted)] text-xs w-16">{row.code}</td>
                <td className="px-6 py-3 text-[var(--theme-text-muted)] text-sm">{row.name}</td>
                <td className="px-6 py-3 text-right text-[var(--theme-text)] font-bold text-sm">{fmt2(row.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function exportCSV(data: PLData, from: string, to: string) {
  const lines: string[] = [
    `Profit & Loss Report,${from} to ${to}`,
    '',
    'Section,Account Code,Account Name,Amount (£)',
    ...data.gl_income.map(r => `Income,${r.code},"${r.name}",${r.net.toFixed(2)}`),
    `Income Total,,,${data.gl_totalIncome.toFixed(2)}`,
    '',
    ...(data.gl_cogs.length ? [
      ...data.gl_cogs.map(r => `Cost of Sales,${r.code},"${r.name}",${r.net.toFixed(2)}`),
      `COGS Total,,,${data.gl_totalCOGS.toFixed(2)}`,
      '',
    ] : []),
    `Gross Profit,,,${data.gl_grossProfit.toFixed(2)}`,
    '',
    ...data.gl_expense.map(r => `Expenses,${r.code},"${r.name}",${r.net.toFixed(2)}`),
    `Expenses Total,,,${data.gl_totalExpense.toFixed(2)}`,
    '',
    `Net Profit,,,${data.gl_netProfit.toFixed(2)}`,
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pl-report-${from}-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PnLPage() {
  const [range, setRange] = useState<Range>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<PLData | null>(null);
  const [activeDates, setActiveDates] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function loadReport(r: Range, from?: string, to?: string) {
    const dates = r === 'custom' && from && to ? { from, to } : getRange(r);
    setLoading(true); setError('');
    setActiveDates(dates);
    fetch(`/api/reports/pl?from=${dates.from}&to=${dates.to}`)
      .then(res => res.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError('Failed to load report'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadReport('this_month'); }, []);

  const hasGLData = data && (data.gl_income?.length > 0 || data.gl_expense?.length > 0);

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Profit & Loss</h2>
          {hasGLData && activeDates && (
            <button onClick={() => exportCSV(data!, activeDates.from, activeDates.to)}
              className="px-4 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] font-black rounded-cinematic text-[10px] uppercase tracking-widest hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] transition-all">
              Export CSV
            </button>
          )}
        </div>

        {/* Range selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(Object.keys(RANGE_LABELS) as Range[]).map(r => (
            <button key={r} onClick={() => { setRange(r); if (r !== 'custom') loadReport(r); }}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                range === r ? 'bg-[var(--theme-accent)] text-[var(--theme-text)] border-[var(--theme-accent)]'
                  : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:text-[var(--theme-text)]'
              }`}>
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <DatePicker value={customFrom} onChange={setCustomFrom} className="w-44" />
            <span className="text-[var(--theme-text-muted)]">to</span>
            <DatePicker value={customTo} onChange={setCustomTo} className="w-44" />
            <button onClick={() => loadReport('custom', customFrom, customTo)} disabled={!customFrom || !customTo}
              className="px-6 py-2 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-[10px] uppercase tracking-widest disabled:opacity-50 hover:brightness-110 transition-all border-none cursor-pointer">
              Apply
            </button>
          </div>
        )}

        {error && <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic text-sm font-bold mb-6">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : data && (
          <>
            {!hasGLData ? (
              <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-[2rem] p-12 text-center">
                <p className="text-[var(--theme-text)] font-black text-lg mb-2">No transactions in this period</p>
                <p className="text-[var(--theme-text-muted)] text-sm">Try a wider date range, or <Link href="/dashboard/invoices" className="text-[var(--theme-accent)] no-underline">create some invoices</Link>.</p>
                <p className="text-[var(--theme-text-muted)] text-xs mt-4">Note: only transactions posted via the double-entry ledger appear here. Transactions created before the GL was set up are not included.</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                  {[
                    { label: 'Total Income', value: data.gl_totalIncome, cls: 'text-[var(--theme-accent)]' },
                    { label: 'Gross Profit', value: data.gl_grossProfit, cls: data.gl_grossProfit >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]' },
                    { label: 'Total Expenses', value: data.gl_totalExpense, cls: 'text-[var(--theme-destructive)]' },
                    { label: 'Net Profit', value: data.gl_netProfit, cls: data.gl_netProfit >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]' },
                  ].map(c => (
                    <div key={c.label} className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic p-5">
                      <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">{c.label}</p>
                      <p className={`text-xl font-black ${c.cls}`}>
                        {c.value < 0 ? '-' : ''}{fmt2(c.value)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Income section */}
                <SectionTable rows={data.gl_income} total={data.gl_totalIncome} label="Income" color="text-[var(--theme-accent)]" />

                {/* COGS section */}
                {data.gl_cogs?.length > 0 && (
                  <SectionTable rows={data.gl_cogs} total={data.gl_totalCOGS} label="Cost of Sales" color="text-[var(--theme-warning)]" />
                )}

                {/* Gross Profit line */}
                {(data.gl_cogs?.length > 0) && (
                  <div className="flex items-center justify-between px-6 py-3 mb-6 bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic">
                    <span className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Gross Profit</span>
                    <span className={`font-black ${data.gl_grossProfit >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'}`}>
                      {data.gl_grossProfit < 0 ? '-' : ''}{fmt2(data.gl_grossProfit)}
                    </span>
                  </div>
                )}

                {/* Expenses section */}
                <SectionTable rows={data.gl_expense} total={data.gl_totalExpense} label="Overheads & Expenses" color="text-[var(--theme-destructive)]" />

                {/* Net Profit line */}
                <div className={`flex items-center justify-between px-6 py-4 rounded-cinematic border-2 ${
                  data.gl_netProfit >= 0
                    ? 'bg-[var(--theme-accent)]/5 border-[var(--theme-accent)]/20'
                    : 'bg-[var(--theme-destructive)]/5 border-[var(--theme-destructive)]/20'
                }`}>
                  <span className="text-sm font-black text-[var(--theme-text)] uppercase tracking-widest">Net Profit</span>
                  <span className={`text-2xl font-black ${data.gl_netProfit >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'}`}>
                    {data.gl_netProfit < 0 ? '-' : ''}{fmt2(data.gl_netProfit)}
                  </span>
                </div>

                <p className="text-[10px] text-[var(--theme-text-dim)] mt-4">Figures are based on double-entry journal entries. Only transactions posted via the general ledger are included. Transactions predating the GL setup are not shown.</p>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
