'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ARRow {
  id: string;
  invoiceNumber: string;
  clientName: string;
  dueDate: string;
  amount: number;
  currency: string;
  daysOverdue: number;
}

interface APRow {
  id: string;
  supplierName: string;
  dueDate: string;
  amount: number;
  currency: string;
  daysOverdue: number;
}

interface Buckets<T> {
  current: T[];
  days30: T[];
  days60: T[];
  days90: T[];
  over90: T[];
}

interface ARData { rows: ARRow[]; summary: Buckets<ARRow>; asOf: string; }
interface APData { rows: APRow[]; summary: Buckets<APRow>; asOf: string; }

type Tab = 'receivables' | 'payables';

const BUCKET_LABELS = [
  { key: 'current', label: 'Current', cls: 'text-[var(--theme-accent)]' },
  { key: 'days30',  label: '1–30 days', cls: 'text-[var(--theme-warning)]' },
  { key: 'days60',  label: '31–60 days', cls: 'text-[var(--theme-warning)]' },
  { key: 'days90',  label: '61–90 days', cls: 'text-[var(--theme-destructive)]' },
  { key: 'over90',  label: '90+ days', cls: 'text-[var(--theme-destructive)] font-black' },
] as const;

function fmt(n: number, currency = 'GBP') {
  const sym: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$' };
  return `${sym[currency] || '£'}${Math.abs(n).toFixed(2)}`;
}

function bucketTotal(rows: { amount: number }[]) {
  return rows.reduce((s, r) => s + r.amount, 0);
}

function overdueClass(days: number) {
  if (days === 0) return 'text-[var(--theme-accent)]';
  if (days <= 30) return 'text-[var(--theme-warning)]';
  if (days <= 60) return 'text-[var(--theme-warning)]';
  return 'text-[var(--theme-destructive)] font-bold';
}

function exportARCSV(data: ARData) {
  const lines = [
    `Aged Receivables,As at ${data.asOf}`,
    '',
    'Invoice #,Client,Due Date,Days Overdue,Amount (£)',
    ...data.rows.map(r => `${r.invoiceNumber},"${r.clientName}",${r.dueDate},${r.daysOverdue},${r.amount.toFixed(2)}`),
    '',
    'Bucket,Total',
    ...BUCKET_LABELS.map(b => `${b.label},${bucketTotal(data.summary[b.key]).toFixed(2)}`),
    `Grand Total,${data.rows.reduce((s, r) => s + r.amount, 0).toFixed(2)}`,
  ];
  download(lines, `aged-receivables-${data.asOf}.csv`);
}

function exportAPCSV(data: APData) {
  const lines = [
    `Aged Payables,As at ${data.asOf}`,
    '',
    'Supplier,Due Date,Days Overdue,Amount (£)',
    ...data.rows.map(r => `"${r.supplierName}",${r.dueDate},${r.daysOverdue},${r.amount.toFixed(2)}`),
    '',
    'Bucket,Total',
    ...BUCKET_LABELS.map(b => `${b.label},${bucketTotal(data.summary[b.key]).toFixed(2)}`),
    `Grand Total,${data.rows.reduce((s, r) => s + r.amount, 0).toFixed(2)}`,
  ];
  download(lines, `aged-payables-${data.asOf}.csv`);
}

function download(lines: string[], filename: string) {
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AgedPage() {
  const [tab, setTab] = useState<Tab>('receivables');
  const [ar, setAr] = useState<ARData | null>(null);
  const [ap, setAp] = useState<APData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch('/api/reports/aged-receivables').then(r => r.json()),
      fetch('/api/reports/aged-payables').then(r => r.json()),
    ]).then(([arData, apData]) => {
      if (arData.error || apData.error) { setError(arData.error || apData.error); return; }
      setAr(arData);
      setAp(apData);
    }).catch(() => setError('Failed to load aged reports'))
      .finally(() => setLoading(false));
  }, []);

  const arTotal = ar ? ar.rows.reduce((s, r) => s + r.amount, 0) : 0;
  const apTotal = ap ? ap.rows.reduce((s, r) => s + r.amount, 0) : 0;

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Aged Reports</h2>
          {!loading && (tab === 'receivables' ? ar : ap) && (
            <button
              onClick={() => tab === 'receivables' ? exportARCSV(ar!) : exportAPCSV(ap!)}
              className="px-4 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] font-black rounded-cinematic text-[10px] uppercase tracking-widest hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] transition-all"
            >
              Export CSV
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {([
            { key: 'receivables', label: 'Aged Receivables', total: arTotal, color: 'text-[var(--theme-accent)]' },
            { key: 'payables',    label: 'Aged Payables',    total: apTotal, color: 'text-[var(--theme-destructive)]' },
          ] as { key: Tab; label: string; total: number; color: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 sm:flex-none px-6 py-3 rounded-cinematic font-black text-sm transition-all border ${
                tab === t.key
                  ? 'bg-[var(--theme-card)] border-[var(--theme-accent)] text-[var(--theme-text)] shadow-sm'
                  : 'bg-transparent border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-[var(--theme-border)]'
              }`}>
              {t.label}
              {!loading && <span className={`ml-2 text-xs ${t.color}`}>£{t.total.toFixed(2)}</span>}
            </button>
          ))}
        </div>

        {error && <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic text-sm font-bold mb-6">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : (
          <>
            {tab === 'receivables' && ar && (
              <ARReport data={ar} />
            )}
            {tab === 'payables' && ap && (
              <APReport data={ap} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ARReport({ data }: { data: ARData }) {
  if (!data.rows.length) {
    return (
      <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-[2rem] p-12 text-center">
        <p className="text-[var(--theme-text)] font-black text-lg mb-2">All clear!</p>
        <p className="text-[var(--theme-text-muted)] text-sm">No outstanding invoices as at {data.asOf}.</p>
      </div>
    );
  }
  return (
    <>
      {/* Bucket summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {BUCKET_LABELS.map(b => {
          const total = bucketTotal(data.summary[b.key]);
          return (
            <div key={b.key} className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic p-4">
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">{b.label}</p>
              <p className={`text-base font-black ${b.cls}`}>£{total.toFixed(2)}</p>
              <p className="text-[10px] text-[var(--theme-text-muted)] mt-0.5">{data.summary[b.key].length} invoice{data.summary[b.key].length !== 1 ? 's' : ''}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] overflow-hidden">
        <div className="px-6 py-3 border-b border-[var(--theme-border)] flex items-center justify-between">
          <span className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Outstanding Invoices</span>
          <span className="text-[var(--theme-accent)] font-black text-sm">£{data.rows.reduce((s, r) => s + r.amount, 0).toFixed(2)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--theme-border)]">
                <th className="px-4 py-2 text-left text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Invoice</th>
                <th className="px-4 py-2 text-left text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Client</th>
                <th className="px-4 py-2 text-left text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Due</th>
                <th className="px-4 py-2 text-right text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Overdue</th>
                <th className="px-4 py-2 text-right text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--theme-border)]">
              {data.rows.map(row => (
                <tr key={row.id} className="hover:bg-[var(--theme-border)]/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/invoices/${row.id}`} className="text-[var(--theme-accent)] font-bold text-sm no-underline hover:underline">
                      {row.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--theme-text-muted)] text-sm">{row.clientName}</td>
                  <td className="px-4 py-3 text-[var(--theme-text-muted)] text-sm">{new Date(row.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm ${overdueClass(row.daysOverdue)}`}>
                      {row.daysOverdue === 0 ? 'Due today' : `${row.daysOverdue}d overdue`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--theme-text)] font-bold text-sm">{fmt(row.amount, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function APReport({ data }: { data: APData }) {
  if (!data.rows.length) {
    return (
      <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-[2rem] p-12 text-center">
        <p className="text-[var(--theme-text)] font-black text-lg mb-2">All clear!</p>
        <p className="text-[var(--theme-text-muted)] text-sm">No outstanding bills as at {data.asOf}.</p>
      </div>
    );
  }
  return (
    <>
      {/* Bucket summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {BUCKET_LABELS.map(b => {
          const total = bucketTotal(data.summary[b.key]);
          return (
            <div key={b.key} className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic p-4">
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">{b.label}</p>
              <p className={`text-base font-black ${b.cls}`}>£{total.toFixed(2)}</p>
              <p className="text-[10px] text-[var(--theme-text-muted)] mt-0.5">{data.summary[b.key].length} bill{data.summary[b.key].length !== 1 ? 's' : ''}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] overflow-hidden">
        <div className="px-6 py-3 border-b border-[var(--theme-border)] flex items-center justify-between">
          <span className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Outstanding Bills</span>
          <span className="text-[var(--theme-destructive)] font-black text-sm">£{data.rows.reduce((s, r) => s + r.amount, 0).toFixed(2)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--theme-border)]">
                <th className="px-4 py-2 text-left text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Supplier</th>
                <th className="px-4 py-2 text-left text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Due</th>
                <th className="px-4 py-2 text-right text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Overdue</th>
                <th className="px-4 py-2 text-right text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--theme-border)]">
              {data.rows.map(row => (
                <tr key={row.id} className="hover:bg-[var(--theme-border)]/20 transition-colors">
                  <td className="px-4 py-3 text-[var(--theme-text)] font-bold text-sm">{row.supplierName}</td>
                  <td className="px-4 py-3 text-[var(--theme-text-muted)] text-sm">{new Date(row.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm ${overdueClass(row.daysOverdue)}`}>
                      {row.daysOverdue === 0 ? 'Due today' : `${row.daysOverdue}d overdue`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--theme-text)] font-bold text-sm">{fmt(row.amount, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
