'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster, toast, DatePicker } from '@relentify/ui';
import { buildAccountMappings } from '@/src/lib/migration/matcher';
import { validateTrialBalance, classifyIssues } from '@/src/lib/migration/validation';
import type {
  MigrationData, MigrationSourceId, AccountMapping, MigrationBatchResult,
} from '@/src/lib/migration/types';

// ── LocalStorage helpers ──
const LS_KEY = 'migration_session_v1';
const LS_TTL_MS = 24 * 60 * 60 * 1000;

function saveSession(data: object) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify({ ...data, _savedAt: Date.now() }));
}
function loadSession(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed._savedAt > LS_TTL_MS) { localStorage.removeItem(LS_KEY); return null; }
    return parsed;
  } catch { return null; }
}

export default function MigratePage() {
  const [step, setStep] = useState(1);
  const [sourceId, setSourceId] = useState<MigrationSourceId | null>(null);
  const [cutoffDate, setCutoffDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [migrationData, setMigrationData] = useState<MigrationData | null>(null);
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [relentifyAccounts, setRelentifyAccounts] = useState<Array<{ code: number; name: string; type: string }>>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [batchResults, setBatchResults] = useState<MigrationBatchResult[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore session on mount
  useEffect(() => {
    const s = loadSession();
    if (!s) return;
    if (s.sourceId) setSourceId(s.sourceId as MigrationSourceId);
    if (s.cutoffDate) setCutoffDate(s.cutoffDate as string);
    if (s.step && Number(s.step) > 1) setStep(Number(s.step));
    if (s.mappings) setMappings(s.mappings as AccountMapping[]);
    if (s.batchResults) setBatchResults(s.batchResults as MigrationBatchResult[]);
    if (s.runId) setRunId(s.runId as string);
    toast('Session restored — you can continue where you left off', 'info' as any);
  }, []);

  // Persist session on state changes
  useEffect(() => {
    saveSession({ step, sourceId, cutoffDate, mappings, batchResults, runId });
  }, [step, sourceId, cutoffDate, mappings, batchResults, runId]);

  // Fetch Relentify COA for mapping step
  useEffect(() => {
    if (step === 4) {
      fetch('/api/chart-of-accounts')
        .then(r => r.json())
        .then(data => setRelentifyAccounts(data.accounts ?? []))
        .catch(() => toast('Failed to load chart of accounts', 'error' as any));
    }
  }, [step]);

  // ── Parse files ──
  const parseFiles = useCallback(async () => {
    if (!files.length || !sourceId || !cutoffDate) return;
    setParsing(true);
    setParseError(null);

    const totalSize = files.reduce((s, f) => s + f.size, 0);

    // Server-side fallback for >20MB
    if (totalSize > 20 * 1024 * 1024) {
      try {
        const fd = new FormData();
        fd.append('sourceId', sourceId);
        fd.append('cutoffDate', cutoffDate);
        for (const f of files) fd.append('file', f);
        const res = await fetch('/api/migration/server-parse', { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setMigrationData(json.data);
        setParseWarnings(json.data.parseWarnings ?? []);
        setStep(4);
      } catch (e: any) {
        setParseError(e.message);
      } finally {
        setParsing(false);
      }
      return;
    }

    // Use Web Worker for >5MB, inline for smaller
    const useWorker = totalSize > 5 * 1024 * 1024 && typeof Worker !== 'undefined';

    if (useWorker) {
      const worker = new Worker(
        new URL('@/src/lib/migration/worker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = (e) => {
        if (e.data.type === 'done') {
          setMigrationData(e.data.data);
          setParseWarnings(e.data.data.parseWarnings ?? []);
          setParsing(false);
          setStep(4);
        } else {
          setParseError(e.data.message);
          setParsing(false);
        }
        worker.terminate();
      };
      worker.onerror = (err) => {
        setParseError(err.message);
        setParsing(false);
        worker.terminate();
      };
      worker.postMessage({ files, sourceId, cutoffDate });
    } else {
      // Inline parse
      try {
        const mod = sourceId === 'xero'
          ? await import('@/src/lib/migration/xero.parser')
          : await import('@/src/lib/migration/quickbooks.parser');
        const ParserClass = sourceId === 'xero' ? (mod as any).XeroParser : (mod as any).QuickBooksParser;
        const parser = new ParserClass();
        const data = await parser.parse(files, cutoffDate);
        setMigrationData(data);
        setParseWarnings(data.parseWarnings ?? []);
        setStep(4);
      } catch (e: any) {
        setParseError(e.message);
      } finally {
        setParsing(false);
      }
    }
  }, [files, sourceId, cutoffDate]);

  // ── Auto-build mappings when COA loaded ──
  useEffect(() => {
    if (step === 4 && migrationData && relentifyAccounts.length > 0) {
      const auto = buildAccountMappings(migrationData.accounts, relentifyAccounts);
      setMappings(auto);
    }
  }, [step, migrationData, relentifyAccounts]);

  // ── Run import ──
  const runImport = async (resumeRunId?: string) => {
    if (!migrationData || !sourceId) return;
    setImporting(true);
    setBatchResults([]);
    try {
      const payload = {
        source: sourceId,
        cutoffDate,
        data: migrationData,
        mappings,
        resumeRunId,
      };
      const res = await fetch('/api/migration/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setBatchResults(json.batches);
      setRunId(json.runId);
      setImportReport(json.importReport);
      setStep(6);
      toast('Migration complete!', 'success' as any);
    } catch (e: any) {
      toast(e.message, 'error' as any);
    } finally {
      setImporting(false);
    }
  };

  // ── Render validation summary (Step 5) ──
  const renderValidation = () => {
    if (!migrationData) return null;
    const tbResult = validateTrialBalance(migrationData.trialBalance);
    const unmapped = mappings.filter(m => m.confidence === 'none').length;
    const newCustomers = migrationData.invoices.filter(
      inv => !migrationData.customers.find(c => c.name.toLowerCase() === inv.clientName.toLowerCase())
    ).length;
    const issues = classifyIssues({ trialBalanceValid: tbResult.valid, unmappedAccounts: unmapped, newCustomersToCreate: newCustomers });
    return { tbResult, issues, unmapped, newCustomers };
  };

  // ── Download import report ──
  const downloadReport = () => {
    if (!importReport) return;
    const blob = new Blob([importReport], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration-report-${runId?.slice(0, 8) ?? 'unknown'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[var(--theme-background)]">
      <Toaster />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Header + step indicator */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Migration Tool</h1>
          <p className="text-sm text-[var(--theme-text-muted)] mt-1">
            Import your data from Xero or QuickBooks in 6 steps.
          </p>
          <div className="flex gap-2 mt-4">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div
                key={n}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  n <= step ? 'bg-[var(--theme-accent)]' : 'bg-[var(--theme-border)]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ── Step 1: Choose Source ── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-[var(--theme-text)]">Step 1 — Choose your accounting platform</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(['xero', 'quickbooks'] as MigrationSourceId[]).map(src => (
                <button
                  key={src}
                  onClick={() => { setSourceId(src); setStep(2); }}
                  className={`p-6 rounded-cinematic border-2 text-left transition-all ${
                    sourceId === src
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10'
                      : 'border-[var(--theme-border)] bg-[var(--theme-card)] hover:border-[var(--theme-accent)]/50'
                  }`}
                >
                  <p className="text-base font-black text-[var(--theme-text)] capitalize mb-1">
                    {src === 'quickbooks' ? 'QuickBooks' : 'Xero'}
                  </p>
                  <p className="text-xs text-[var(--theme-text-muted)]">
                    {src === 'xero'
                      ? 'CSV exports from Xero (Chart of Accounts, Contacts, Invoices, Trial Balance)'
                      : 'IIF or CSV exports from QuickBooks Desktop or Online'}
                  </p>
                  <a
                    href={`/migration-guides/${src}-export.pdf`}
                    onClick={e => e.stopPropagation()}
                    className="inline-block mt-3 text-[10px] font-black uppercase tracking-widest text-[var(--theme-accent)]"
                    download
                  >
                    ↓ Export Instructions
                  </a>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Cutoff Date ── */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-[var(--theme-text)]">Step 2 — Set cutoff date</h2>
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6 space-y-4">
              <p className="text-sm text-[var(--theme-text-muted)]">
                All outstanding invoices and bills <strong>on or before this date</strong> will be imported.
                Opening balances will reflect your accounts at this date.
              </p>
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">
                  Cutoff Date *
                </label>
                <DatePicker value={cutoffDate} onChange={setCutoffDate} />
                <p className="text-xs text-[var(--theme-text-muted)] mt-1">
                  Typically your last year-end or last month-end date.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-xs font-black uppercase tracking-widest border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text-muted)] hover:border-[var(--theme-accent)]/50"
                >
                  Back
                </button>
                <button
                  disabled={!cutoffDate}
                  onClick={() => setStep(3)}
                  className="px-6 py-2 bg-[var(--theme-accent)] text-white text-xs font-black uppercase tracking-widest rounded-cinematic disabled:opacity-40"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Upload Files ── */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-[var(--theme-text)]">Step 3 — Upload export files</h2>
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6 space-y-4">
              <p className="text-sm text-[var(--theme-text-muted)]">
                {sourceId === 'xero'
                  ? 'Upload: Chart of Accounts.csv, Contacts.csv, Invoices.csv, Trial Balance.csv (Bills.csv and Manual Journals.csv optional).'
                  : 'Upload: chart_of_accounts.csv/.iif, customer_list.csv, vendor_list.csv, invoice_list.csv, trial_balance.csv.'}
              </p>

              <label className="block w-full cursor-pointer">
                <div className={`border-2 border-dashed rounded-cinematic p-8 text-center transition-colors ${
                  files.length > 0
                    ? 'border-[var(--theme-accent)]/50 bg-[var(--theme-accent)]/10'
                    : 'border-[var(--theme-border)] hover:border-[var(--theme-accent)]/30'
                }`}>
                  {files.length > 0 ? (
                    <div className="space-y-1">
                      {files.map(f => (
                        <p key={f.name} className="text-xs font-medium text-[var(--theme-text)]">
                          {f.name} <span className="text-[var(--theme-text-muted)]">({(f.size / 1024).toFixed(1)} KB)</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--theme-text-muted)]">Click to select files — multiple files accepted</p>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.iif"
                  multiple
                  onChange={e => setFiles(Array.from(e.target.files ?? []))}
                  className="hidden"
                />
              </label>

              {parseError && (
                <p className="text-sm text-[var(--theme-destructive)]">{parseError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-xs font-black uppercase tracking-widest border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text-muted)]"
                >
                  Back
                </button>
                <button
                  disabled={!files.length || parsing}
                  onClick={parseFiles}
                  className="px-6 py-2 bg-[var(--theme-accent)] text-white text-xs font-black uppercase tracking-widest rounded-cinematic disabled:opacity-40"
                >
                  {parsing ? 'Parsing…' : 'Parse Files'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Map Accounts ── */}
        {step === 4 && migrationData && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-[var(--theme-text)]">Step 4 — Map accounts</h2>
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6 space-y-4">
              {parseWarnings.length > 0 && (
                <div className="rounded-cinematic border border-[var(--theme-warning)]/30 bg-[var(--theme-warning)]/10 p-3">
                  <p className="text-xs font-black text-[var(--theme-warning)] mb-1">Parse Warnings</p>
                  {parseWarnings.map((w, i) => (
                    <p key={i} className="text-xs text-[var(--theme-warning)]">• {w}</p>
                  ))}
                </div>
              )}

              <p className="text-sm text-[var(--theme-text-muted)]">
                Review the suggested account mappings. High confidence matches are pre-selected.
                Amber entries need your attention.
              </p>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {mappings.map((m, idx) => (
                  <div
                    key={m.sourceCode}
                    className={`flex items-center gap-3 p-3 rounded-cinematic border ${
                      m.confidence === 'none'
                        ? 'border-[var(--theme-warning)]/50 bg-[var(--theme-warning)]/5'
                        : m.confidence === 'medium'
                        ? 'border-[var(--theme-warning)]/30 bg-[var(--theme-warning)]/5'
                        : 'border-[var(--theme-border)]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--theme-text)] truncate">{m.sourceName}</p>
                      <p className="text-[10px] text-[var(--theme-text-muted)]">Code: {m.sourceCode}</p>
                    </div>
                    <span className="text-[var(--theme-text-muted)] text-xs">→</span>
                    <select
                      value={m.targetCode ?? ''}
                      onChange={e => {
                        const updated = [...mappings];
                        updated[idx] = {
                          ...m,
                          targetCode: e.target.value ? parseInt(e.target.value, 10) : null,
                          confidence: e.target.value ? 'high' : 'none',
                        };
                        setMappings(updated);
                      }}
                      className="text-xs bg-[var(--theme-card)] border border-[var(--theme-border)] rounded px-2 py-1 text-[var(--theme-text)] max-w-[200px]"
                    >
                      <option value="">— Skip —</option>
                      {relentifyAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                    {m.confidence === 'medium' && (
                      <span className="text-[10px] text-[var(--theme-warning)] shrink-0">Suggested — verify</span>
                    )}
                    {m.confidence === 'none' && (
                      <span className="text-[10px] text-[var(--theme-warning)] shrink-0">Unresolved</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2 text-xs font-black uppercase tracking-widest border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text-muted)]"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(5)}
                  className="px-6 py-2 bg-[var(--theme-accent)] text-white text-xs font-black uppercase tracking-widest rounded-cinematic"
                >
                  Continue to Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Preview & Validate ── */}
        {step === 5 && migrationData && (() => {
          const v = renderValidation()!;
          return (
            <div className="space-y-6">
              <h2 className="text-lg font-black text-[var(--theme-text)]">Step 5 — Preview &amp; validate</h2>
              <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6 space-y-4">

                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Will import</p>
                  {[
                    ['Accounts', migrationData.accounts.length],
                    ['Customers', migrationData.customers.length],
                    ['Suppliers', migrationData.suppliers.length],
                    ['Outstanding Invoices', migrationData.invoices.length],
                    ['Outstanding Bills', migrationData.bills.length],
                    ['Opening Balance Lines', migrationData.openingBalances.length],
                  ].map(([label, count]) => (
                    <div key={label as string} className="flex justify-between text-sm">
                      <span className="text-[var(--theme-text-muted)]">{label}</span>
                      <span className="font-semibold text-[var(--theme-text)]">{count}</span>
                    </div>
                  ))}
                </div>

                <div className={`rounded-cinematic p-3 border text-sm ${
                  v.tbResult.valid
                    ? 'border-[var(--theme-accent)]/30 bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]'
                    : 'border-[var(--theme-destructive)]/30 bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)]'
                }`}>
                  {v.tbResult.valid
                    ? `✓ Trial balance: Debits £${migrationData.trialBalance.totalDebits.toFixed(2)} = Credits £${migrationData.trialBalance.totalCredits.toFixed(2)}`
                    : `✗ Trial balance imbalanced — discrepancy: £${v.tbResult.discrepancy.toFixed(2)}`}
                </div>

                {v.issues.errors.map((e, i) => (
                  <div key={i} className="rounded-cinematic p-3 border border-[var(--theme-destructive)]/30 bg-[var(--theme-destructive)]/10 text-sm text-[var(--theme-destructive)]">
                    ✗ {e}
                  </div>
                ))}

                {v.issues.warnings.map((w, i) => (
                  <div key={i} className="rounded-cinematic p-3 border border-[var(--theme-warning)]/30 bg-[var(--theme-warning)]/10 text-sm text-[var(--theme-warning)]">
                    ⚠ {w}
                  </div>
                ))}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(4)}
                    className="px-4 py-2 text-xs font-black uppercase tracking-widest border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text-muted)]"
                  >
                    Back
                  </button>
                  <button
                    disabled={!v.issues.canProceed || importing}
                    onClick={() => runImport()}
                    className="px-6 py-2 bg-[var(--theme-accent)] text-white text-xs font-black uppercase tracking-widest rounded-cinematic disabled:opacity-40"
                  >
                    {importing
                      ? 'Importing…'
                      : `Import ${migrationData.invoices.length + migrationData.bills.length + migrationData.customers.length + migrationData.suppliers.length} records`}
                  </button>
                </div>

                {importing && batchResults.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {batchResults.map(b => (
                      <div key={b.type} className="flex items-center justify-between text-xs">
                        <span className="capitalize text-[var(--theme-text-muted)]">{b.type.replace('_', ' ')}</span>
                        <span className={
                          b.status === 'completed' ? 'text-[var(--theme-accent)]'
                          : b.status === 'failed' ? 'text-[var(--theme-destructive)]'
                          : 'text-[var(--theme-text-muted)]'
                        }>
                          {b.status === 'completed' ? `✓ ${b.count}` : b.status === 'failed' ? '✗ Failed' : '…'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Step 6: Complete ── */}
        {step === 6 && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-[var(--theme-text)]">Migration Complete</h2>
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6 space-y-4">

              <div className="space-y-1.5">
                {batchResults.map(b => (
                  <div
                    key={b.type}
                    className={`flex items-center justify-between text-sm rounded-cinematic p-2 ${
                      b.status === 'completed' ? '' : 'bg-[var(--theme-destructive)]/10'
                    }`}
                  >
                    <span className="capitalize text-[var(--theme-text-muted)]">{b.type.replace('_', ' ')}</span>
                    <span className={b.status === 'completed' ? 'text-[var(--theme-accent)] font-semibold' : 'text-[var(--theme-destructive)]'}>
                      {b.status === 'completed' ? `✓ ${b.count} imported` : `✗ ${b.error ?? 'Failed'}`}
                    </span>
                  </div>
                ))}
              </div>

              {runId && batchResults.some(b => b.status === 'failed') && (
                <button
                  onClick={() => runImport(runId ?? undefined)}
                  disabled={importing}
                  className="px-4 py-2 border border-[var(--theme-warning)]/50 text-[var(--theme-warning)] text-xs font-black uppercase tracking-widest rounded-cinematic"
                >
                  Resume Import (retry failed batches)
                </button>
              )}

              <div className="flex gap-3">
                {importReport && (
                  <button
                    onClick={downloadReport}
                    className="px-4 py-2 border border-[var(--theme-accent)]/50 text-[var(--theme-accent)] text-xs font-black uppercase tracking-widest rounded-cinematic"
                  >
                    ↓ Download Import Report
                  </button>
                )}
                <a
                  href="/dashboard"
                  className="px-6 py-2 bg-[var(--theme-accent)] text-white text-xs font-black uppercase tracking-widest rounded-cinematic inline-block"
                >
                  Go to Dashboard
                </a>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
