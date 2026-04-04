'use client';
import { useState, useRef } from 'react';
import { Toaster, toast, DatePicker } from '@relentify/ui';

type ImportType = 'customers' | 'suppliers' | 'invoices' | 'bills' | 'expenses' | 'opening_balances';

interface ImportResult {
  imported: number;
  errors: string[];
  total: number;
  suspenseAmount?: number;
}

const TYPES: { key: ImportType; label: string; description: string; requiredColumns: string[] }[] = [
  {
    key: 'customers',
    label: 'Customers',
    description: 'Import your customer contact list.',
    requiredColumns: ['Name'],
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    description: 'Import your supplier / vendor directory.',
    requiredColumns: ['Name'],
  },
  {
    key: 'invoices',
    label: 'Sales Invoices',
    description: 'Import historical sales invoices. One row per invoice.',
    requiredColumns: ['Client Name', 'Due Date', 'Description', 'Unit Price'],
  },
  {
    key: 'bills',
    label: 'Bills',
    description: 'Import supplier bills / purchase invoices.',
    requiredColumns: ['Supplier Name', 'Amount', 'Due Date'],
  },
  {
    key: 'expenses',
    label: 'Expenses',
    description: 'Import expense claims.',
    requiredColumns: ['Date', 'Description', 'Gross Amount'],
  },
  {
    key: 'opening_balances',
    label: 'Opening Balances',
    description: 'Import account opening balances when migrating from another system.',
    requiredColumns: [],
  },
];

export default function ImportPage() {
  const [activeType, setActiveType] = useState<ImportType>('customers');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Opening balances state
  const [obAsOfDate, setObAsOfDate] = useState('');
  const [obConfirmReplace, setObConfirmReplace] = useState(false);
  const [obExisting, setObExisting] = useState<{ existingDate: string; existingId: string } | null>(null);

  const current = TYPES.find(t => t.key === activeType)!;

  function handleTypeChange(t: ImportType) {
    setActiveType(t);
    setFile(null);
    setResult(null);
    setObExisting(null);
    setObConfirmReplace(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
  }

  async function downloadTemplate() {
    const res = await fetch(`/api/import/template?type=${activeType}`);
    if (!res.ok) { toast('Failed to download template', 'error'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relentify-${activeType}-template.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('type', activeType);
      fd.append('file', file);
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data);
      if (data.imported > 0) toast(`${data.imported} record${data.imported !== 1 ? 's' : ''} imported`, 'success');
      else toast('No records imported', 'error');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  }

  async function handleObImport() {
    if (!file || !obAsOfDate) return;
    setImporting(true);
    setResult(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('asOfDate', obAsOfDate);
    if (obConfirmReplace) fd.append('confirmReplace', 'true');

    const res = await fetch('/api/import/opening-balances', { method: 'POST', body: fd });
    const data = await res.json();

    if (res.status === 409 && data.error === 'EXISTING_OPENING_BALANCE') {
      setObExisting({ existingDate: data.existingDate, existingId: data.existingId });
      setImporting(false);
      return;
    }

    if (!res.ok) {
      setResult({ imported: 0, errors: [data.error || 'Import failed'], total: 0 });
    } else {
      setResult({ imported: data.linesImported, errors: [], total: data.linesImported, suspenseAmount: data.suspenseAmount });
    }
    setImporting(false);
  }

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Import Data</h1>
          <p className="text-sm text-[var(--theme-text-muted)] mt-1">
            Import your existing data from Excel (.xlsx) or CSV files.
          </p>
        </div>

        {/* Type tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => handleTypeChange(t.key)}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-colors shrink-0 ${
                activeType === t.key
                  ? 'bg-[var(--theme-accent)] text-white'
                  : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)]/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeType === 'opening_balances' ? (
          /* Opening balances custom panel */
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6 space-y-6">
            <p className="text-sm text-[var(--theme-text-muted)]">
              Download the pre-filled Excel template with your chart of accounts, fill in the opening debit/credit for each account, then upload it below.
            </p>

            {/* Step 1: Download template */}
            <div>
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Step 1 — Download Template</p>
              <a
                href="/api/import/opening-balances/template"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--theme-accent)] hover:bg-[var(--theme-accent)] text-white text-sm font-semibold rounded-cinematic transition-colors"
                download
              >
                Download Excel Template
              </a>
            </div>

            {/* Step 2: Choose as-of date */}
            <div>
              <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">
                Step 2 — Opening Balances Date *
              </label>
              <DatePicker value={obAsOfDate} onChange={setObAsOfDate} />
              <p className="text-xs text-[var(--theme-text-muted)] mt-1">Usually the day before you started using Relentify.</p>
            </div>

            {/* Step 3: Upload */}
            <div>
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Step 3 — Upload Completed Template</p>
              <input
                type="file"
                accept=".xlsx,.csv"
                ref={fileRef}
                onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); setObExisting(null); }}
                className="block text-sm text-[var(--theme-text-muted)]"
              />
            </div>

            {/* Existing entry warning */}
            {obExisting && (
              <div className="rounded-cinematic border border-[var(--theme-warning)]/30 bg-[var(--theme-warning)]/10 p-4 text-sm text-[var(--theme-warning)]">
                <p className="font-semibold mb-1">Opening balance entry already exists (as of {obExisting.existingDate})</p>
                <p className="mb-3">Uploading will void the existing entry and replace it.</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={obConfirmReplace}
                    onChange={e => setObConfirmReplace(e.target.checked)}
                    className="rounded"
                  />
                  <span>Yes, replace the existing opening balance entry</span>
                </label>
              </div>
            )}

            {/* Import button */}
            <button
              disabled={importing || !file || !obAsOfDate || (!!obExisting && !obConfirmReplace)}
              onClick={handleObImport}
              className="px-6 py-3 bg-[var(--theme-accent)] hover:bg-[var(--theme-accent)] disabled:opacity-50 text-white font-semibold rounded-cinematic transition-colors"
            >
              {importing ? 'Importing…' : 'Import Opening Balances'}
            </button>

            {/* Result */}
            {result && (
              <div className={`rounded-cinematic p-4 text-sm ${result.errors.length === 0 ? 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]' : 'bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)]'}`}>
                {result.errors.length === 0 ? (
                  <>
                    <p className="font-semibold">✓ {result.imported} lines imported successfully.</p>
                    {(result.suspenseAmount ?? 0) > 0 && (
                      <p className="mt-1 text-[var(--theme-warning)]">⚠ Imbalance of £{result.suspenseAmount!.toFixed(2)} posted to Suspense (9999). Review your trial balance.</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-semibold mb-2">Import failed:</p>
                    {result.errors.map((e, i) => <p key={i}>• {e}</p>)}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Generic import panel */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Step 1: Download template */}
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center text-xs font-black shrink-0">1</div>
                <h2 className="text-sm font-black text-[var(--theme-text)]">Download Template</h2>
              </div>
              <p className="text-xs text-[var(--theme-text-muted)] mb-4 leading-relaxed">
                {current.description} Download the template, fill it in, then upload it below.
              </p>
              <div className="text-[10px] text-[var(--theme-text-muted)] mb-4">
                <p className="font-black uppercase tracking-widest mb-1">Required columns</p>
                <p>{current.requiredColumns.join(', ')}</p>
              </div>
              <button
                onClick={downloadTemplate}
                className="w-full py-2.5 border border-[var(--theme-accent)]/50 text-[var(--theme-accent)] text-xs font-black uppercase tracking-widest rounded-cinematic hover:bg-[var(--theme-accent)]/10 transition-colors"
              >
                ↓ Download Template
              </button>
            </div>

            {/* Step 2: Upload file */}
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center text-xs font-black shrink-0">2</div>
                <h2 className="text-sm font-black text-[var(--theme-text)]">Upload File</h2>
              </div>
              <p className="text-xs text-[var(--theme-text-muted)] mb-4">
                Accepts <span className="font-bold text-[var(--theme-text-muted)]">.xlsx</span> and <span className="font-bold text-[var(--theme-text-muted)]">.csv</span> files. Maximum 500 rows per import.
              </p>
              <label className="block w-full cursor-pointer">
                <div className={`border-2 border-dashed rounded-cinematic p-6 text-center transition-colors ${
                  file
                    ? 'border-[var(--theme-accent)]/50 bg-[var(--theme-accent)]/10'
                    : 'border-[var(--theme-border)] hover:border-[var(--theme-accent)]/30'
                }`}>
                  {file ? (
                    <>
                      <p className="text-xs font-black text-[var(--theme-accent)] truncate">{file.name}</p>
                      <p className="text-[10px] text-[var(--theme-text-muted)] mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-[var(--theme-text-muted)] font-medium">Click to select file</p>
                      <p className="text-[10px] text-[var(--theme-text-muted)] mt-1">.xlsx or .csv</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Step 3: Import */}
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center text-xs font-black shrink-0">3</div>
                <h2 className="text-sm font-black text-[var(--theme-text)]">Import</h2>
              </div>
              <p className="text-xs text-[var(--theme-text-muted)] mb-4">
                Records are added to your account. Existing data is not affected.
              </p>
              <button
                onClick={handleImport}
                disabled={!file || importing}
                className="w-full py-3 bg-[var(--theme-accent)] text-white font-black text-xs uppercase tracking-widest rounded-cinematic hover:brightness-110 disabled:opacity-40 transition-all"
              >
                {importing ? 'Importing…' : `Import ${current.label}`}
              </button>

              {result && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--theme-text-muted)]">Imported</span>
                    <span className="font-black text-[var(--theme-accent)]">{result.imported} / {result.total}</span>
                  </div>
                  {result.errors.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-[var(--theme-destructive)] uppercase tracking-widest mb-1">{result.errors.length} error{result.errors.length !== 1 ? 's' : ''}</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {result.errors.map((e, i) => (
                          <p key={i} className="text-[10px] text-[var(--theme-destructive)]">{e}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="mt-6 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5">
          <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-3">Tips</p>
          <ul className="text-xs text-[var(--theme-text-muted)] space-y-1.5 leading-relaxed">
            <li>• Use the template to ensure columns are in the correct order and format</li>
            <li>• Dates must be in <span className="font-mono font-bold text-[var(--theme-text-muted)]">YYYY-MM-DD</span> format (e.g. 2024-01-31) or DD/MM/YYYY</li>
            <li>• Leave optional columns blank — do not delete them from the template</li>
            <li>• Import up to 500 rows at a time. For larger datasets, split into multiple files</li>
            <li>• Importing will never overwrite or delete existing records</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
