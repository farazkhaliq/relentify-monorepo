'use client';
import { useEffect, useState } from 'react';
import { DatePicker } from '@relentify/ui';

interface JournalLine {
  id: string;
  accountId: string;
  accountCode: number;
  accountName: string;
  accountType: string;
  description: string | null;
  debit: string;
  credit: string;
}

interface JournalEntry {
  id: string;
  entry_date: string;
  reference: string | null;
  description: string | null;
  source_type: string | null;
  source_id: string | null;
  is_locked: boolean;
  lines: JournalLine[];
}

const SOURCE_LABELS: Record<string, string> = {
  invoice: 'Invoice', bill: 'Bill', expense: 'Expense',
  mileage: 'Mileage', payment: 'Payment', manual: 'Manual',
};

function fmt(n: string | number) {
  const v = parseFloat(String(n));
  if (!v || v === 0) return '—';
  return `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getRange(months: number) {
  const today = new Date();
  const from = new Date(today);
  from.setMonth(from.getMonth() - months);
  return {
    from: from.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0],
  };
}

export default function GeneralLedgerPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(() => getRange(1).from);
  const [to, setTo] = useState(() => getRange(1).to);
  const [sourceType, setSourceType] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function load() {
    setLoading(true); setError('');
    const params = new URLSearchParams({ from, to });
    if (sourceType) params.set('sourceType', sourceType);
    fetch(`/api/ledger?${params}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setEntries(d.entries || []); })
      .catch(() => setError('Failed to load ledger'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleEntry(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const rows = [['Date', 'Reference', 'Description', 'Source', 'Account Code', 'Account', 'Debit', 'Credit']];
    entries.forEach(e => {
      e.lines.forEach(l => {
        rows.push([
          e.entry_date, e.reference || '', e.description || '',
          e.source_type || '', String(l.accountCode), l.accountName,
          parseFloat(l.debit) ? String(l.debit) : '',
          parseFloat(l.credit) ? String(l.credit) : '',
        ]);
      });
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = `general-ledger-${from}-to-${to}.csv`;
    a.click();
  }

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--theme-text)]">General Ledger</h1>
            <p className="text-sm text-[var(--theme-text-muted)] mt-1">All journal entries with their double-entry lines.</p>
          </div>
          <button
            onClick={exportCsv}
            disabled={entries.length === 0}
            className="text-sm border border-[var(--theme-border)] rounded-lg px-3 py-1.5 hover:bg-[var(--theme-border)]/20 text-[var(--theme-text-muted)] disabled:opacity-40 self-start sm:self-auto"
          >
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bg-[var(--theme-card)] rounded-cinematic border border-[var(--theme-border)] p-4 mb-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-[var(--theme-text-muted)] mb-1">From</label>
            <DatePicker value={from} onChange={setFrom} className="w-44" />
          </div>
          <div>
            <label className="block text-xs text-[var(--theme-text-muted)] mb-1">To</label>
            <DatePicker value={to} onChange={setTo} className="w-44" />
          </div>
          <div>
            <label className="block text-xs text-[var(--theme-text-muted)] mb-1">Source</label>
            <select value={sourceType} onChange={e => setSourceType(e.target.value)}
              className="border border-[var(--theme-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--theme-card)] text-[var(--theme-text)]">
              <option value="">All</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <button onClick={load}
            className="bg-[var(--theme-accent)] text-white rounded-lg px-4 py-1.5 text-sm hover:bg-[var(--theme-accent)]">
            Apply
          </button>
        </div>

        {loading && <p className="text-[var(--theme-text-muted)]">Loading…</p>}
        {error && <p className="text-[var(--theme-destructive)]">{error}</p>}

        {!loading && entries.length === 0 && (
          <div className="bg-[var(--theme-card)] rounded-cinematic border border-[var(--theme-border)] p-8 text-center text-[var(--theme-text-muted)]">
            No journal entries found for this period.
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="space-y-2">
            {entries.map(entry => {
              const isOpen = expanded.has(entry.id);
              const totalDebit = entry.lines.reduce((s, l) => s + parseFloat(l.debit || '0'), 0);
              return (
                <div key={entry.id} className="bg-[var(--theme-card)] rounded-cinematic border border-[var(--theme-border)] overflow-hidden">
                  <button
                    onClick={() => toggleEntry(entry.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-[var(--theme-border)]/20 text-sm"
                  >
                    <span className="text-[var(--theme-text-muted)] text-xs w-4">{isOpen ? '▾' : '▸'}</span>
                    <span className="text-[var(--theme-text-muted)] w-24 shrink-0 text-xs">{entry.entry_date}</span>
                    <span className="font-mono text-[var(--theme-text-muted)] w-28 shrink-0 text-xs">{entry.reference || '—'}</span>
                    <span className="text-[var(--theme-text)] flex-1 truncate">{entry.description || '—'}</span>
                    {entry.source_type && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--theme-card)] text-[var(--theme-text-muted)] shrink-0">
                        {SOURCE_LABELS[entry.source_type] || entry.source_type}
                      </span>
                    )}
                    <span className="text-right font-mono text-[var(--theme-text-muted)] text-xs w-28 shrink-0">
                      {fmt(totalDebit)}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-[var(--theme-border)] bg-[var(--theme-border)]/[0.05]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[var(--theme-text-muted)]">
                            <th className="text-left px-8 py-1.5 font-normal">Account</th>
                            <th className="text-left px-4 py-1.5 font-normal hidden md:table-cell">Description</th>
                            <th className="text-right px-4 py-1.5 font-normal w-28">Debit</th>
                            <th className="text-right px-4 py-1.5 font-normal w-28">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.lines.map(line => (
                            <tr key={line.id} className="border-t border-[var(--theme-border)]">
                              <td className="px-8 py-1.5 text-[var(--theme-text-muted)]">
                                <span className="font-mono text-[var(--theme-text-muted)] mr-2">{line.accountCode}</span>
                                {line.accountName}
                              </td>
                              <td className="px-4 py-1.5 text-[var(--theme-text-muted)] hidden md:table-cell">{line.description || '—'}</td>
                              <td className="px-4 py-1.5 text-right font-mono text-[var(--theme-text-muted)]">{fmt(line.debit)}</td>
                              <td className="px-4 py-1.5 text-right font-mono text-[var(--theme-text-muted)]">{fmt(line.credit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
