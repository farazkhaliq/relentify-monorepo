'use client';
import { useState } from 'react';
import { DatePicker } from '@relentify/ui';

// ── Types ────────────────────────────────────────────────────────────────────

type GroupBy = 'account' | 'source_type' | 'month';

interface Line {
  date: string;
  reference: string;
  description: string;
  accountCode: number;
  accountName: string;
  accountType: string;
  sourceType: string;
  debit: number;
  credit: number;
}

interface Group {
  key: string;
  label: string;
  totalDebit: number;
  totalCredit: number;
  net: number;
  lines: Line[];
}

interface ReportData {
  groups: Group[];
  totals: { totalDebit: number; totalCredit: number; net: number };
  from: string;
  to: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  { value: 'INCOME', label: 'Income' },
  { value: 'COGS', label: 'Cost of Sales' },
  { value: 'EXPENSE', label: 'Expenses' },
  { value: 'ASSET', label: 'Assets' },
  { value: 'LIABILITY', label: 'Liabilities' },
  { value: 'EQUITY', label: 'Equity' },
];

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'account', label: 'Account' },
  { value: 'source_type', label: 'Source Type' },
  { value: 'month', label: 'Month' },
];

const ALL_COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'reference', label: 'Reference' },
  { key: 'description', label: 'Description' },
  { key: 'accountCode', label: 'Code' },
  { key: 'accountName', label: 'Account' },
  { key: 'sourceType', label: 'Source' },
  { key: 'debit', label: 'Debit' },
  { key: 'credit', label: 'Credit' },
] as const;

type ColumnKey = typeof ALL_COLUMNS[number]['key'];

type QuickRange = 'this_month' | 'last_month' | 'last_3' | 'this_year' | 'last_year' | 'custom';

function getRange(r: QuickRange): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  if (r === 'this_month') {
    return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) };
  }
  if (r === 'last_month') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: fmt(first), to: fmt(last) };
  }
  if (r === 'last_3') {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 3);
    return { from: fmt(d), to: fmt(today) };
  }
  if (r === 'this_year') {
    return { from: fmt(new Date(today.getFullYear(), 0, 1)), to: fmt(today) };
  }
  if (r === 'last_year') {
    const y = today.getFullYear() - 1;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) };
}

const QUICK_RANGE_LABELS: Record<QuickRange, string> = {
  this_month: 'This Month',
  last_month: 'Last Month',
  last_3: 'Last 3 Months',
  this_year: 'This Year',
  last_year: 'Last Year',
  custom: 'Custom',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSourceType(s: string) {
  const map: Record<string, string> = {
    invoice: 'Invoice', bill: 'Bill', expense: 'Expense',
    mileage: 'Mileage', payment: 'Payment', manual: 'Manual', credit_note: 'Credit Note',
  };
  return map[s] ?? s;
}

function exportCSV(data: ReportData, groupBy: GroupBy, visibleCols: Set<ColumnKey>) {
  const colDefs = ALL_COLUMNS.filter(c => visibleCols.has(c.key));

  const rows: string[] = [
    `Custom Report,${data.from} to ${data.to}`,
    `Grouped by,${groupBy}`,
    '',
  ];

  for (const group of data.groups) {
    rows.push(`"${group.label}",,,,,,${group.totalDebit.toFixed(2)},${group.totalCredit.toFixed(2)}`);
    rows.push(colDefs.map(c => `"${c.label}"`).join(','));

    for (const line of group.lines) {
      const cells = colDefs.map(c => {
        if (c.key === 'debit') return line.debit.toFixed(2);
        if (c.key === 'credit') return line.credit.toFixed(2);
        if (c.key === 'sourceType') return `"${formatSourceType(line.sourceType)}"`;
        const v = line[c.key as keyof Line];
        return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v);
      });
      rows.push(cells.join(','));
    }
    rows.push('');
  }

  rows.push(`Totals,,,,,,${data.totals.totalDebit.toFixed(2)},${data.totals.totalCredit.toFixed(2)}`);

  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `custom-report-${data.from}-${data.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CustomReportPage() {
  // Builder state
  const [quickRange, setQuickRange] = useState<QuickRange>('this_year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(ACCOUNT_TYPES.map(t => t.value)));
  const [groupBy, setGroupBy] = useState<GroupBy>('account');
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(
    new Set(ALL_COLUMNS.map(c => c.key))
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Result state
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleType(value: string) {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  }

  function toggleCol(key: ColumnKey) {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function runReport() {
    const dates = quickRange === 'custom'
      ? { from: customFrom, to: customTo }
      : getRange(quickRange);

    if (!dates.from || !dates.to) {
      setError('Please select a valid date range.');
      return;
    }

    const params = new URLSearchParams({
      from: dates.from,
      to: dates.to,
      accountTypes: Array.from(selectedTypes).join(','),
      groupBy,
    });

    setLoading(true);
    setError('');
    setData(null);
    setExpandedGroups(new Set());

    fetch(`/api/reports/custom?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Failed to load report'))
      .finally(() => setLoading(false));
  }

  const visibleColDefs = ALL_COLUMNS.filter(c => visibleCols.has(c.key));

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Custom Report</h2>
          <div className="flex items-center gap-2">
            {data && (
              <button
                onClick={() => exportCSV(data, groupBy, visibleCols)}
                className="px-4 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] font-black rounded-cinematic text-[10px] uppercase tracking-widest hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] transition-all"
              >
                Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Builder panel */}
        <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-6 mb-8 space-y-6">

          {/* Date range */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-3">Date Range</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {(Object.keys(QUICK_RANGE_LABELS) as QuickRange[]).map(r => (
                <button
                  key={r}
                  onClick={() => setQuickRange(r)}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                    quickRange === r
                      ? 'bg-[var(--theme-accent)] text-[var(--theme-text)] border-[var(--theme-accent)]'
                      : 'bg-transparent text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:text-[var(--theme-text)]'
                  }`}
                >
                  {QUICK_RANGE_LABELS[r]}
                </button>
              ))}
            </div>
            {quickRange === 'custom' && (
              <div className="flex items-center gap-3 flex-wrap">
                <DatePicker value={customFrom} onChange={setCustomFrom} className="w-44" />
                <span className="text-[var(--theme-text-muted)] text-sm">to</span>
                <DatePicker value={customTo} onChange={setCustomTo} className="w-44" />
              </div>
            )}
          </div>

          {/* Account types */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-3">Account Types</p>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => toggleType(t.value)}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                    selectedTypes.has(t.value)
                      ? 'bg-[var(--theme-accent)] text-[var(--theme-text)] border-[var(--theme-accent)]'
                      : 'bg-transparent text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:text-[var(--theme-text)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <button
                onClick={() =>
                  setSelectedTypes(
                    selectedTypes.size === ACCOUNT_TYPES.length
                      ? new Set()
                      : new Set(ACCOUNT_TYPES.map(t => t.value))
                  )
                }
                className="px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-[var(--theme-border)] text-[var(--theme-text-dim)] hover:text-[var(--theme-text-muted)] transition-all"
              >
                {selectedTypes.size === ACCOUNT_TYPES.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          {/* Group by + Run */}
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-3">Group By</p>
              <div className="flex gap-2">
                {GROUP_BY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setGroupBy(opt.value)}
                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                      groupBy === opt.value
                        ? 'bg-[var(--theme-accent)] text-[var(--theme-text)] border-[var(--theme-accent)]'
                        : 'bg-transparent text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:text-[var(--theme-text)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={runReport}
              disabled={loading || selectedTypes.size === 0}
              className="px-8 py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-[10px] uppercase tracking-widest disabled:opacity-50 hover:brightness-110 transition-all border-none cursor-pointer"
            >
              {loading ? 'Running…' : 'Run Report'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic text-sm font-bold mb-6">
            {error}
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Results */}
        {data && !loading && (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Total Debit', value: data.totals.totalDebit, cls: '' },
                { label: 'Total Credit', value: data.totals.totalCredit, cls: '' },
                { label: 'Net', value: data.totals.net, cls: data.totals.net >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]' },
              ].map(c => (
                <div key={c.label} className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic p-5">
                  <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">{c.label}</p>
                  <p className={`text-xl font-black text-[var(--theme-text)] ${c.cls}`}>
                    {c.value < 0 ? '-' : ''}{fmt(c.value)}
                  </p>
                </div>
              ))}
            </div>

            {data.groups.length === 0 ? (
              <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-[2rem] p-12 text-center">
                <p className="text-[var(--theme-text)] font-black text-lg mb-2">No transactions found</p>
                <p className="text-[var(--theme-text-muted)] text-sm">Try adjusting the date range or account type filters.</p>
              </div>
            ) : (
              <>
                {/* Column picker toggle */}
                <div className="flex justify-end mb-3">
                  <div className="relative">
                    <button
                      onClick={() => setShowColumnPicker(v => !v)}
                      className="px-4 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] font-black rounded-cinematic text-[10px] uppercase tracking-widest hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] transition-all"
                    >
                      Columns ({visibleCols.size}/{ALL_COLUMNS.length})
                    </button>
                    {showColumnPicker && (
                      <div className="absolute right-0 top-full mt-2 z-50 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic shadow-cinematic p-4 min-w-48">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-3">Show Columns</p>
                        <div className="space-y-2">
                          {ALL_COLUMNS.map(c => (
                            <label key={c.key} className="flex items-center gap-2 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={visibleCols.has(c.key)}
                                onChange={() => toggleCol(c.key)}
                                className="accent-[var(--theme-accent)] w-3.5 h-3.5"
                              />
                              <span className="text-xs font-bold text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)] transition-colors">
                                {c.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Groups */}
                <div className="space-y-3">
                  {data.groups.map(group => {
                    const isExpanded = expandedGroups.has(group.key);
                    return (
                      <div
                        key={group.key}
                        className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic sm:rounded-[1.5rem] overflow-hidden"
                      >
                        {/* Group header — click to expand */}
                        <button
                          onClick={() => toggleGroup(group.key)}
                          className="w-full flex items-center justify-between px-6 py-4 hover:bg-[var(--theme-border)]/20 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <svg
                              className={`w-4 h-4 text-[var(--theme-text-muted)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="font-black text-sm text-[var(--theme-text)]">{group.label}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-dim)]">
                              {group.lines.length} {group.lines.length === 1 ? 'line' : 'lines'}
                            </span>
                          </div>
                          <div className="flex items-center gap-6 text-right">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-dim)]">Debit</p>
                              <p className="text-sm font-black text-[var(--theme-text)]">{fmt(group.totalDebit)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-dim)]">Credit</p>
                              <p className="text-sm font-black text-[var(--theme-text)]">{fmt(group.totalCredit)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-dim)]">Net</p>
                              <p className={`text-sm font-black ${group.net >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'}`}>
                                {group.net < 0 ? '-' : ''}{fmt(group.net)}
                              </p>
                            </div>
                          </div>
                        </button>

                        {/* Drill-down table */}
                        {isExpanded && (
                          <div className="border-t border-[var(--theme-border)] overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-[var(--theme-border)]">
                                  {visibleColDefs.map(c => (
                                    <th
                                      key={c.key}
                                      className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-dim)] whitespace-nowrap ${
                                        c.key === 'debit' || c.key === 'credit' ? 'text-right' : 'text-left'
                                      }`}
                                    >
                                      {c.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--theme-border)]">
                                {group.lines.map((line, i) => (
                                  <tr key={i} className="hover:bg-[var(--theme-border)]/20 transition-colors">
                                    {visibleColDefs.map(c => {
                                      if (c.key === 'debit') return (
                                        <td key={c.key} className="px-4 py-2 text-right font-bold text-[var(--theme-text)] whitespace-nowrap">
                                          {line.debit > 0 ? fmt(line.debit) : ''}
                                        </td>
                                      );
                                      if (c.key === 'credit') return (
                                        <td key={c.key} className="px-4 py-2 text-right font-bold text-[var(--theme-text)] whitespace-nowrap">
                                          {line.credit > 0 ? fmt(line.credit) : ''}
                                        </td>
                                      );
                                      if (c.key === 'sourceType') return (
                                        <td key={c.key} className="px-4 py-2 text-[var(--theme-text-muted)] whitespace-nowrap">
                                          <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--theme-primary)]/10 text-[var(--theme-text-muted)] text-[9px] font-black uppercase tracking-widest">
                                            {formatSourceType(line.sourceType)}
                                          </span>
                                        </td>
                                      );
                                      const val = line[c.key as keyof Line];
                                      return (
                                        <td key={c.key} className="px-4 py-2 text-[var(--theme-text-muted)] max-w-48 truncate">
                                          {String(val ?? '')}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-[var(--theme-border)] bg-[var(--theme-background)]/50">
                                  {visibleColDefs.map(c => {
                                    if (c.key === 'debit') return (
                                      <td key={c.key} className="px-4 py-2 text-right text-xs font-black text-[var(--theme-text)]">
                                        {fmt(group.totalDebit)}
                                      </td>
                                    );
                                    if (c.key === 'credit') return (
                                      <td key={c.key} className="px-4 py-2 text-right text-xs font-black text-[var(--theme-text)]">
                                        {fmt(group.totalCredit)}
                                      </td>
                                    );
                                    const isFirst = visibleColDefs[0].key === c.key;
                                    return (
                                      <td key={c.key} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-dim)]">
                                        {isFirst ? 'Total' : ''}
                                      </td>
                                    );
                                  })}
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Grand total row */}
                <div className="mt-4 flex items-center justify-between px-6 py-4 bg-[var(--theme-card)] shadow-cinematic border-2 border-[var(--theme-border)] rounded-cinematic">
                  <span className="text-sm font-black text-[var(--theme-text)] uppercase tracking-widest">Grand Total</span>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-dim)]">Debit</p>
                      <p className="text-sm font-black text-[var(--theme-text)]">{fmt(data.totals.totalDebit)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-dim)]">Credit</p>
                      <p className="text-sm font-black text-[var(--theme-text)]">{fmt(data.totals.totalCredit)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-dim)]">Net</p>
                      <p className={`text-sm font-black ${data.totals.net >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'}`}>
                        {data.totals.net < 0 ? '-' : ''}{fmt(data.totals.net)}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-[var(--theme-text-dim)] mt-4">
                  Figures are based on double-entry journal entries only. Transactions predating the general ledger setup are not included.
                </p>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
