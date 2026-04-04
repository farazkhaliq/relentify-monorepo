'use client';
import { useEffect, useState } from 'react';
import { DatePicker } from '@relentify/ui';

interface TBRow {
  id: string;
  code: number;
  name: string;
  account_type: string;
  total_debit: string;
  total_credit: string;
  net: string;
}

interface TBData {
  rows: TBRow[];
  grandDebit: number;
  grandCredit: number;
  balanced: boolean;
}

function fmt(n: number | string) {
  const v = parseFloat(String(n));
  if (!v || v === 0) return '—';
  return `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'COGS', 'EXPENSE', 'SUSPENSE'];
const TYPE_LABELS: Record<string, string> = {
  ASSET: 'Assets', LIABILITY: 'Liabilities', EQUITY: 'Equity',
  INCOME: 'Income', COGS: 'Cost of Sales', EXPENSE: 'Overheads', SUSPENSE: 'Suspense',
};

export default function TrialBalancePage() {
  const [asOf, setAsOf] = useState('');
  const [data, setData] = useState<TBData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function load(dateStr?: string) {
    setLoading(true); setError('');
    const url = dateStr ? `/api/reports/trial-balance?asOf=${dateStr}` : '/api/reports/trial-balance';
    fetch(url)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError('Failed to load trial balance'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function exportCsv() {
    if (!data) return;
    const rows = [['Code', 'Name', 'Type', 'Debit', 'Credit', 'Net']];
    data.rows.forEach(r => {
      rows.push([
        String(r.code), r.name, r.account_type,
        String(parseFloat(r.total_debit) || ''),
        String(parseFloat(r.total_credit) || ''),
        String(parseFloat(r.net) || ''),
      ]);
    });
    rows.push(['', 'TOTAL', '', String(data.grandDebit), String(data.grandCredit), '']);
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = `trial-balance-${asOf || 'latest'}.csv`;
    a.click();
  }

  const grouped = data
    ? TYPE_ORDER.reduce<Record<string, TBRow[]>>((acc, t) => {
        acc[t] = data.rows.filter(r => r.account_type === t && (parseFloat(r.total_debit) !== 0 || parseFloat(r.total_credit) !== 0));
        return acc;
      }, {})
    : {};

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--theme-text)]">Trial Balance</h1>
            <p className="text-sm text-[var(--theme-text-muted)] mt-1">All accounts with their debit and credit balances.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-[var(--theme-text-muted)]">As at</label>
            <DatePicker value={asOf} onChange={v => { setAsOf(v); load(v || undefined); }} className="w-44" />
            <button
              onClick={exportCsv}
              disabled={!data}
              className="text-sm border border-[var(--theme-border)] rounded-lg px-3 py-1.5 hover:bg-[var(--theme-border)]/20 text-[var(--theme-text-muted)] disabled:opacity-40"
            >
              Export CSV
            </button>
          </div>
        </div>

        {loading && <p className="text-[var(--theme-text-muted)]">Loading…</p>}
        {error && <p className="text-[var(--theme-destructive)]">{error}</p>}

        {data && !loading && (
          <>
            {!data.balanced && (
              <div className="mb-4 p-3 bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 rounded-lg text-sm text-[var(--theme-destructive)]">
                ⚠️ Trial balance does not balance — debits and credits differ. Please contact support.
              </div>
            )}

            <div className="bg-[var(--theme-card)] rounded-cinematic border border-[var(--theme-border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--theme-border)] bg-[var(--theme-border)]/[0.05]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--theme-text-muted)] w-20">Code</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--theme-text-muted)]">Account</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[var(--theme-text-muted)] w-32">Debit</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[var(--theme-text-muted)] w-32">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {TYPE_ORDER.map(type => {
                    const rows = grouped[type] || [];
                    if (rows.length === 0) return null;
                    return (
                      <>
                        <tr key={`hdr-${type}`} className="bg-[var(--theme-border)]/[0.05]">
                          <td colSpan={4} className="px-4 py-1.5 text-[11px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider">
                            {TYPE_LABELS[type]}
                          </td>
                        </tr>
                        {rows.map(row => (
                          <tr key={row.id} className="border-b border-[var(--theme-border)] hover:bg-[var(--theme-border)]/20">
                            <td className="px-4 py-2.5 font-mono text-[var(--theme-text-muted)] text-xs">{row.code}</td>
                            <td className="px-4 py-2.5 text-[var(--theme-text)]">{row.name}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-[var(--theme-text-muted)] text-xs">{fmt(row.total_debit)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-[var(--theme-text-muted)] text-xs">{fmt(row.total_credit)}</td>
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className={`border-t-2 font-semibold ${data.balanced ? 'border-[var(--theme-border)]' : 'border-[var(--theme-destructive)]/20'}`}>
                    <td className="px-4 py-3" colSpan={2}>
                      <span className="text-[var(--theme-text-muted)]">Total</span>
                      {data.balanced && <span className="ml-2 text-[10px] text-[var(--theme-success)]">✓ Balanced</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--theme-text)]">
                      £{data.grandDebit.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--theme-text)]">
                      £{data.grandCredit.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
