'use client';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Toaster, toast } from '@relentify/ui';
import Attachments from '@/src/components/Attachments';
import Comments from '@/src/components/Comments';

type Connection = {
  id: string;
  display_name: string;
  account_type: string;
  currency: string;
  balance: string | null;
  balance_updated_at: string | null;
};

type Tx = {
  id: string;
  transaction_date: string;
  description: string;
  amount: string;
  type: 'credit' | 'debit';
  status: 'unmatched' | 'matched' | 'ignored';
  connection_id?: string;
  categorisation_type?: string;
  category?: string;
  poa_name?: string;
  invoice_number?: string;
  bill_supplier?: string;
};

type Invoice = { id: string; invoice_number: string; client_name: string; total: string };
type Bill = { id: string; supplier_name: string; amount: string };
type MatchMode = 'invoice_bill' | 'payment_on_account' | 'bank_entry';

const INCOME_CATS = ['Sales Income', 'Interest Received', 'Directors Loan In', 'Capital Introduced', 'Other Income'];
const EXPENSE_CATS = ['Bank Charges', 'Payroll', 'Tax / VAT', 'Directors Loan Out', 'General Expense', 'Other'];

const SC: Record<string, string> = {
  unmatched: 'border-[var(--theme-warning)]/30 text-[var(--theme-warning)] bg-[var(--theme-warning)]/10',
  matched:   'border-[var(--theme-accent)]/30 text-[var(--theme-accent)] bg-[var(--theme-accent)]/10',
  ignored:   'border-[var(--theme-border)] text-[var(--theme-text-dim)] bg-[var(--theme-border)]/[0.05]',
};

function parseCSV(text: string) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('narr') || h.includes('detail'));
  const creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('in'));
  const debitIdx = headers.findIndex(h => h.includes('debit') || h.includes('out'));
  const amountIdx = headers.findIndex(h => h === 'amount');

  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
    const credit = creditIdx >= 0 ? parseFloat(cols[creditIdx] || '0') || 0 : 0;
    const debit = debitIdx >= 0 ? parseFloat(cols[debitIdx] || '0') || 0 : 0;
    const amount = amountIdx >= 0 ? parseFloat(cols[amountIdx] || '0') || 0 : 0;
    return {
      date: cols[dateIdx] || '',
      description: cols[descIdx] || cols[1] || '',
      credit: credit || (amount > 0 ? amount : 0),
      debit: debit || (amount < 0 ? Math.abs(amount) : 0),
    };
  }).filter(r => r.date && (r.credit > 0 || r.debit > 0));
}

function BankingContent() {
  const params = useSearchParams();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [activeConn, setActiveConn] = useState<string | null>(null); // null = All
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [matchMode, setMatchMode] = useState<MatchMode>('invoice_bill');
  const [invoiceId, setInvoiceId] = useState('');
  const [billId, setBillId] = useState('');
  const [poaName, setPoaName] = useState('');
  const [entryCategory, setEntryCategory] = useState('');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, connRes, invRes, billRes] = await Promise.all([
        fetch('/api/banking').then(r => r.json()),
        fetch('/api/openbanking/sync').then(r => r.json()),
        fetch('/api/invoices').then(r => r.json()),
        fetch('/api/bills').then(r => r.json()),
      ]);
      if (txRes.transactions) setTransactions(txRes.transactions);
      if (connRes.connections) setConnections(connRes.connections);
      if (invRes.invoices) setInvoices(invRes.invoices.filter((i: Invoice & { status: string }) => ['sent', 'overdue'].includes(i.status)));
      if (billRes.bills) setBills(billRes.bills.filter((b: Bill & { status: string }) => ['unpaid', 'overdue'].includes(b.status)));
    } catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) {
        setCurrentUserId(d.user.id);
        setTargetUserId(d.actorId && d.actorId !== d.user.id ? d.actorId : null);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const status = params.get('ob');
    if (status === 'connected') {
      const n = params.get('accounts');
      toast(`${n} bank account${n === '1' ? '' : 's'} connected`, 'success');
    }
    if (status === 'error') toast('Bank connection failed', 'error');
    if (status === 'denied') toast('Bank connection cancelled', 'error');
  }, [load, params]);

  async function syncAll() {
    setSyncing(true);
    try {
      const r = await fetch('/api/openbanking/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast(`Synced — ${d.imported} new transactions`, 'success');
      load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Sync failed', 'error');
    } finally { setSyncing(false); }
  }

  async function disconnectConn(id: string, name: string) {
    if (!confirm(`Disconnect ${name}?`)) return;
    await fetch('/api/openbanking/disconnect', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectionId: id }) });
    toast('Account disconnected', 'info');
    if (activeConn === id) setActiveConn(null);
    load();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) { toast('No valid rows found in CSV', 'error'); return; }
      const r = await fetch('/api/banking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast(`Imported ${d.imported} transactions`, 'success');
      await load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Import failed', 'error');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function openMatch(txId: string) {
    setMatchingId(txId);
    setMatchMode('invoice_bill');
    setInvoiceId(''); setBillId(''); setPoaName(''); setEntryCategory('');
  }

  async function handleMatch(tx: Tx) {
    let body: Record<string, string>;
    if (matchMode === 'invoice_bill') {
      if (!invoiceId && !billId) { toast('Select an invoice or bill', 'error'); return; }
      body = invoiceId
        ? { type: 'invoice_match', invoiceId }
        : { type: 'bill_match', billId };
    } else if (matchMode === 'payment_on_account') {
      if (!poaName.trim()) { toast('Enter a customer or supplier name', 'error'); return; }
      body = { type: 'payment_on_account', poaName: poaName.trim() };
    } else {
      if (!entryCategory) { toast('Select a category', 'error'); return; }
      body = { type: 'bank_entry', category: entryCategory };
    }
    try {
      const r = await fetch(`/api/banking/${tx.id}/match`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('Match failed');
      setMatchingId(null);
      toast('Categorised', 'success');
      await load();
    } catch { toast('Failed to categorise', 'error'); }
  }

  async function handleIgnore(txId: string) {
    try {
      await fetch(`/api/banking/${txId}/match`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ignore' }),
      });
      toast('Ignored', 'info');
      await load();
    } catch { toast('Failed', 'error'); }
  }

  const displayedTxs = activeConn === null
    ? transactions
    : activeConn === 'csv'
    ? transactions.filter(tx => !tx.connection_id)
    : transactions.filter(tx => tx.connection_id === activeConn);

  const unmatchedCount = displayedTxs.filter(t => t.status === 'unmatched').length;

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Bank Accounts</h1>
            {unmatchedCount > 0 && (
              <p className="text-sm text-[var(--theme-warning)] mt-0.5">{unmatchedCount} transaction{unmatchedCount !== 1 ? 's' : ''} to review</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {connections.length > 0 && (
              <button onClick={syncAll} disabled={syncing}
                className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest hover:text-[var(--theme-accent)] bg-transparent border-none cursor-pointer disabled:opacity-50">
                {syncing ? 'Syncing…' : '↻ Sync All'}
              </button>
            )}
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-[var(--theme-card)] text-[var(--theme-text)] rounded-cinematic hover:brightness-110 transition-all cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
              {importing ? 'Importing…' : '+ CSV'}
            </label>
            <a href="/api/openbanking/connect"
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-[var(--theme-accent)] text-white rounded-cinematic hover:brightness-110 transition-all no-underline">
              + Connect Bank
            </a>
          </div>
        </div>

        {/* Connected account cards */}
        {connections.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {connections.map(conn => (
              <div key={conn.id} className={`bg-[var(--theme-card)] shadow-cinematic border rounded-cinematic p-4 cursor-pointer transition-all ${activeConn === conn.id ? 'border-[var(--theme-accent)] ring-1 ring-[var(--theme-accent)]' : 'border-[var(--theme-border)] hover:border-[var(--theme-accent)]/20'}`}
                onClick={() => setActiveConn(activeConn === conn.id ? null : conn.id)}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-black text-[var(--theme-text)] text-sm">{conn.display_name}</p>
                    <p className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-widest">{conn.account_type}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[var(--theme-accent)] animate-pulse" />
                    <span className="text-[9px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Live</span>
                  </div>
                </div>
                {conn.balance !== null && (
                  <p className="text-2xl font-black text-[var(--theme-accent)] mb-1">
                    {conn.currency === 'GBP' ? '£' : conn.currency}{Number(conn.balance).toFixed(2)}
                  </p>
                )}
                {conn.balance_updated_at && (
                  <p className="text-[9px] text-[var(--theme-text-muted)] mb-3">
                    Updated {new Date(conn.balance_updated_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                )}
                <button onClick={e => { e.stopPropagation(); disconnectConn(conn.id, conn.display_name); }}
                  className="text-[9px] font-black text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)] uppercase tracking-widest bg-transparent border-none cursor-pointer p-0">
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}

        {connections.length === 0 && transactions.length === 0 && (
          <div className="bg-[var(--theme-card)] shadow-cinematic border border-dashed border-[var(--theme-border)] rounded-cinematic p-5 text-center mb-6">
            <p className="text-[var(--theme-text-muted)] text-sm">No bank accounts connected. Connect your bank for live transaction feeds, or import a CSV.</p>
          </div>
        )}

        {/* Account filter tabs */}
        {(connections.length > 0 || transactions.length > 0) && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button onClick={() => setActiveConn(null)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border-none cursor-pointer transition-colors ${activeConn === null ? 'bg-[var(--theme-accent)] text-[var(--theme-text)]' : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-border)]/40'}`}>
              All ({transactions.length})
            </button>
            {connections.map(conn => {
              const count = transactions.filter(t => t.connection_id === conn.id).length;
              return (
                <button key={conn.id} onClick={() => setActiveConn(conn.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border-none cursor-pointer transition-colors ${activeConn === conn.id ? 'bg-[var(--theme-accent)] text-[var(--theme-text)]' : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-border)]/40'}`}>
                  {conn.display_name} ({count})
                </button>
              );
            })}
            {transactions.filter(t => !t.connection_id).length > 0 && (
              <button onClick={() => setActiveConn('csv')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border-none cursor-pointer transition-colors ${activeConn === 'csv' ? 'bg-[var(--theme-accent)] text-[var(--theme-text)]' : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-border)]/40'}`}>
                CSV Import ({transactions.filter(t => !t.connection_id).length})
              </button>
            )}
          </div>
        )}

        {/* Summary pills */}
        {displayedTxs.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {(['unmatched', 'matched', 'ignored'] as const).map(s => {
              const count = displayedTxs.filter(t => t.status === s).length;
              return count > 0 ? (
                <span key={s} className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${SC[s]}`}>
                  {count} {s}
                </span>
              ) : null;
            })}
          </div>
        )}

        {/* Transactions list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : displayedTxs.length === 0 ? (
          <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-[2rem] p-16 text-center">
            <div className="w-16 h-16 bg-[var(--theme-card)] rounded-cinematic flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-[var(--theme-text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
            <p className="text-[var(--theme-text)] font-black text-lg mb-2">No transactions yet</p>
            <p className="text-[var(--theme-text-muted)] text-sm">Sync a connected account or import a CSV to start categorising</p>
          </div>
        ) : (
          <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-[2rem] overflow-hidden">
            <div className="divide-y divide-[var(--theme-border)]">
              {displayedTxs.map(tx => (
                <div key={tx.id} className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[var(--theme-text)] font-black text-sm truncate">{tx.description}</span>
                        <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${SC[tx.status]}`}>{tx.status}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[var(--theme-text-muted)] flex-wrap">
                        <span>{new Date(tx.transaction_date).toLocaleDateString('en-GB')}</span>
                        <span className={`font-black ${tx.type === 'credit' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'}`}>
                          {tx.type === 'credit' ? '+' : '-'}£{Number(tx.amount).toFixed(2)}
                        </span>
                        {tx.invoice_number && <span className="text-[var(--theme-text-muted)]">→ Invoice {tx.invoice_number}</span>}
                        {tx.bill_supplier && <span className="text-[var(--theme-text-muted)]">→ {tx.bill_supplier}</span>}
                        {tx.poa_name && <span className="text-[var(--theme-text-muted)]">→ On account: {tx.poa_name}</span>}
                        {tx.categorisation_type === 'bank_entry' && tx.category && <span className="text-[var(--theme-text-muted)]">→ {tx.category}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {tx.status === 'unmatched' && matchingId !== tx.id && (
                        <>
                          <button onClick={() => openMatch(tx.id)}
                            className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--theme-text)] bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg hover:bg-[var(--theme-border)]/40 transition-colors cursor-pointer">
                            Categorise
                          </button>
                          <button onClick={() => handleIgnore(tx.id)}
                            className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] bg-transparent border-none cursor-pointer hover:text-[var(--theme-text)] transition-colors">
                            Ignore
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
                        className="text-[8px] font-black text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)] uppercase tracking-widest border border-[var(--theme-border)] rounded-lg px-2 py-1 transition-colors bg-transparent"
                        title="Attachments"
                      >📎</button>
                    </div>
                  </div>

                  {/* Attachments & Comments panel */}
                  {expandedTxId === tx.id && (
                    <div className="mt-2 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-xl px-4 py-3 space-y-3">
                      <Attachments recordType="bank_transaction" recordId={tx.id} />
                      {currentUserId && (
                        <Comments recordType="bank_transaction" recordId={tx.id} currentUserId={currentUserId} targetUserId={targetUserId} />
                      )}
                    </div>
                  )}

                  {/* Categorisation panel */}
                  {matchingId === tx.id && (
                    <div className="mt-4 p-4 bg-[var(--theme-card)] rounded-cinematic border border-[var(--theme-border)] space-y-4">

                      {/* Mode selector */}
                      <div className="flex rounded-lg overflow-hidden border border-[var(--theme-border)] w-full">
                        {([
                          { key: 'invoice_bill', label: tx.type === 'credit' ? 'Match Invoice' : 'Match Bill' },
                          { key: 'payment_on_account', label: 'On Account' },
                          { key: 'bank_entry', label: 'Bank Entry' },
                        ] as { key: MatchMode; label: string }[]).map(opt => (
                          <button key={opt.key} onClick={() => setMatchMode(opt.key)}
                            className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest border-none cursor-pointer transition-colors ${matchMode === opt.key ? 'bg-[var(--theme-accent)] text-[var(--theme-text)]' : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-border)]/40'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Invoice / Bill match */}
                      {matchMode === 'invoice_bill' && (
                        <>
                          {tx.type === 'credit' && (
                            <div>
                              <label className="block text-[9px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">
                                {invoices.length > 0 ? 'Match to Invoice' : 'No open invoices found'}
                              </label>
                              {invoices.length > 0 && (
                                <select value={invoiceId} onChange={e => setInvoiceId(e.target.value)}
                                  className="w-full px-3 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--theme-text)] outline-none focus:ring-2 focus:ring-[var(--theme-accent)]">
                                  <option value="">Select invoice…</option>
                                  {invoices.map(inv => <option key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.client_name} — £{Number(inv.total).toFixed(2)}</option>)}
                                </select>
                              )}
                            </div>
                          )}
                          {tx.type === 'debit' && (
                            <div>
                              <label className="block text-[9px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">
                                {bills.length > 0 ? 'Match to Bill' : 'No open bills found'}
                              </label>
                              {bills.length > 0 && (
                                <select value={billId} onChange={e => setBillId(e.target.value)}
                                  className="w-full px-3 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--theme-text)] outline-none focus:ring-2 focus:ring-[var(--theme-accent)]">
                                  <option value="">Select bill…</option>
                                  {bills.map(b => <option key={b.id} value={b.id}>{b.supplier_name} — £{Number(b.amount).toFixed(2)}</option>)}
                                </select>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* Payment on Account */}
                      {matchMode === 'payment_on_account' && (
                        <div>
                          <label className="block text-[9px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">
                            {tx.type === 'credit' ? 'Customer Name' : 'Supplier Name'}
                          </label>
                          <input
                            type="text"
                            value={poaName}
                            onChange={e => setPoaName(e.target.value)}
                            placeholder={tx.type === 'credit' ? 'e.g. Acme Ltd' : 'e.g. BT Group'}
                            className="w-full px-3 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
                          />
                          <p className="text-[9px] text-[var(--theme-text-muted)] mt-1">Records as a payment on account — not matched to a specific invoice or bill</p>
                        </div>
                      )}

                      {/* Bank Entry */}
                      {matchMode === 'bank_entry' && (
                        <div>
                          <label className="block text-[9px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Category</label>
                          <select value={entryCategory} onChange={e => setEntryCategory(e.target.value)}
                            className="w-full px-3 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--theme-text)] outline-none focus:ring-2 focus:ring-[var(--theme-accent)]">
                            <option value="">Select category…</option>
                            {(tx.type === 'credit' ? INCOME_CATS : EXPENSE_CATS).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={() => handleMatch(tx)}
                          className="px-4 py-2 bg-[var(--theme-accent)] text-white font-black rounded-lg text-[10px] uppercase tracking-widest hover:brightness-110 transition-all border-none cursor-pointer">
                          Confirm
                        </button>
                        <button onClick={() => setMatchingId(null)}
                          className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] bg-transparent border-none cursor-pointer hover:text-[var(--theme-text)]">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function BankingPage() {
  return (
    <Suspense>
      <BankingContent />
    </Suspense>
  );
}
