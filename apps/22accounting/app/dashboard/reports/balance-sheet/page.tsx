'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DatePicker } from '@relentify/ui';

interface BSRow { code: number; name: string; net: number; }

interface BSData {
  assets: BSRow[];
  liabilities: BSRow[];
  equity: BSRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

function fmt2(n: number, sym = '£') { return `${sym}${Math.abs(n).toFixed(2)}`; }

function SectionTable({ rows, total, label, color }: { rows: BSRow[]; total: number; label: string; color: string }) {
  const nonZero = rows.filter(r => r.net !== 0);
  if (!nonZero.length) return null;
  return (
    <div className="mb-4">
      <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] overflow-hidden">
        <div className="px-6 py-3 border-b border-[var(--theme-border)] flex items-center justify-between">
          <span className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{label}</span>
          <span className={`font-black text-sm ${color}`}>{fmt2(total)}</span>
        </div>
        <table className="w-full">
          <tbody className="divide-y divide-[var(--theme-border)]">
            {nonZero.map(row => (
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

function exportCSV(data: BSData, asOf: string) {
  const lines: string[] = [
    `Balance Sheet,As at ${asOf}`,
    '',
    'Section,Account Code,Account Name,Amount (£)',
    ...data.assets.map(r => `Assets,${r.code},"${r.name}",${r.net.toFixed(2)}`),
    `Total Assets,,,${data.totalAssets.toFixed(2)}`,
    '',
    ...data.liabilities.map(r => `Liabilities,${r.code},"${r.name}",${r.net.toFixed(2)}`),
    `Total Liabilities,,,${data.totalLiabilities.toFixed(2)}`,
    '',
    ...data.equity.map(r => `Equity,${r.code},"${r.name}",${r.net.toFixed(2)}`),
    `Total Equity,,,${data.totalEquity.toFixed(2)}`,
    '',
    `Net Assets (Assets - Liabilities),,,${(data.totalAssets - data.totalLiabilities).toFixed(2)}`,
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `balance-sheet-${asOf}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BalanceSheetPage() {
  const today = new Date().toISOString().split('T')[0];
  const [asOf, setAsOf] = useState(today);
  const [data, setData] = useState<BSData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function loadReport(date: string) {
    setLoading(true);
    setError('');
    fetch(`/api/reports/balance-sheet?asOf=${date}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError('Failed to load balance sheet'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadReport(today); }, []);

  const hasData = data && (data.assets.length > 0 || data.liabilities.length > 0 || data.equity.length > 0);
  const netAssets = data ? data.totalAssets - data.totalLiabilities : 0;
  const balanced = data ? Math.abs(netAssets - data.totalEquity) < 0.01 : true;

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Balance Sheet</h2>
            <p className="text-[var(--theme-text-muted)] text-sm mt-0.5">As at a specific date</p>
          </div>
          {hasData && (
            <button onClick={() => exportCSV(data!, asOf)}
              className="px-4 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] font-black rounded-cinematic text-[10px] uppercase tracking-widest hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] transition-all">
              Export CSV
            </button>
          )}
        </div>

        {/* Date picker */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">As at</label>
            <DatePicker value={asOf} onChange={setAsOf} className="w-44" />
          </div>
          <button
            onClick={() => loadReport(asOf)}
            disabled={!asOf}
            className="px-6 py-2 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-[10px] uppercase tracking-widest disabled:opacity-50 hover:brightness-110 transition-all border-none cursor-pointer"
          >
            Apply
          </button>
          {/* Quick shortcuts */}
          {[
            { label: 'Today', value: today },
            { label: 'Month end', value: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0] },
            { label: 'Year end', value: `${new Date().getFullYear()}-03-31` },
          ].map(s => (
            <button key={s.label}
              onClick={() => { setAsOf(s.value); loadReport(s.value); }}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                asOf === s.value
                  ? 'bg-[var(--theme-accent)] text-[var(--theme-text)] border-[var(--theme-accent)]'
                  : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:text-[var(--theme-text)]'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {error && <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic text-sm font-bold mb-6">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : data && (
          <>
            {!hasData ? (
              <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-[2rem] p-12 text-center">
                <p className="text-[var(--theme-text)] font-black text-lg mb-2">No data for this date</p>
                <p className="text-[var(--theme-text-muted)] text-sm">No journal entries found up to {asOf}. <Link href="/dashboard/reports/pl" className="text-[var(--theme-accent)] no-underline">Check the P&L</Link> first.</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {[
                    { label: 'Total Assets', value: data.totalAssets, cls: 'text-[var(--theme-accent)]' },
                    { label: 'Total Liabilities', value: data.totalLiabilities, cls: 'text-[var(--theme-destructive)]' },
                    { label: 'Net Assets', value: netAssets, cls: netAssets >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]' },
                  ].map(c => (
                    <div key={c.label} className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic p-5">
                      <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">{c.label}</p>
                      <p className={`text-xl font-black ${c.cls}`}>
                        {c.value < 0 ? '-' : ''}{fmt2(c.value)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Assets */}
                <SectionTable rows={data.assets} total={data.totalAssets} label="Assets" color="text-[var(--theme-accent)]" />

                {/* Liabilities */}
                <SectionTable rows={data.liabilities} total={data.totalLiabilities} label="Liabilities" color="text-[var(--theme-destructive)]" />

                {/* Net Assets line */}
                <div className={`flex items-center justify-between px-6 py-4 rounded-cinematic border-2 mb-4 ${
                  netAssets >= 0 ? 'bg-[var(--theme-accent)]/5 border-[var(--theme-accent)]/20' : 'bg-[var(--theme-destructive)]/5 border-[var(--theme-destructive)]/20'
                }`}>
                  <span className="text-sm font-black text-[var(--theme-text)] uppercase tracking-widest">Net Assets</span>
                  <span className={`text-2xl font-black ${netAssets >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'}`}>
                    {netAssets < 0 ? '-' : ''}{fmt2(netAssets)}
                  </span>
                </div>

                {/* Equity */}
                <SectionTable rows={data.equity} total={data.totalEquity} label="Equity & Reserves" color="text-[var(--theme-accent)]" />

                {/* Balance check */}
                {!balanced && (
                  <div className="bg-[var(--theme-warning)]/10 border border-[var(--theme-warning)]/20 text-[var(--theme-warning)] px-4 py-3 rounded-cinematic text-sm font-bold mb-4">
                    Balance sheet is out of balance by £{Math.abs(netAssets - data.totalEquity).toFixed(2)}. This usually means missing opening balances or unposted journals.
                  </div>
                )}

                <p className="text-[10px] text-[var(--theme-text-dim)] mt-4">
                  Figures are based on double-entry journal entries up to {asOf}. Only transactions posted via the general ledger are included. Transactions predating the GL setup are not shown.
                </p>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
