'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const SC: Record<string, string> = {
  draft:   'bg-[var(--theme-primary)]/3 text-[var(--theme-text-muted)]',
  issued:  'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]',
  applied: 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]',
  voided:  'bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)]',
};

type CreditNote = {
  id: string;
  credit_note_number: string;
  client_name: string;
  issue_date: string;
  total: string | number;
  status: string;
  linked_invoice_number?: string;
  currency: string;
};

const currencySymbol = (c: string) => ({ GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$' }[c] || c + ' ');

export default function CreditNotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/credit-notes')
      .then(r => r.json())
      .then(d => { if (d.credit_notes) setNotes(d.credit_notes); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = notes.filter(n => filter === 'all' || n.status === filter);
  const filters = ['all', 'draft', 'issued', 'applied', 'voided'];

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Credit Notes</h2>
          <Link href="/dashboard/credit-notes/new" className="px-4 sm:px-6 py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-[10px] uppercase tracking-widest hover:brightness-110 transition-all shadow-lg no-underline active:scale-[0.98]">+ New</Link>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                filter === f
                  ? 'bg-[var(--theme-accent)] text-[var(--theme-text)] border-[var(--theme-accent)]'
                  : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:text-[var(--theme-text)]'
              }`}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-12 sm:p-16 text-center">
            <div className="w-16 h-16 bg-[var(--theme-card)] rounded-cinematic flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-[var(--theme-text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /></svg>
            </div>
            <p className="text-[var(--theme-text)] font-black text-lg mb-2">
              {filter === 'all' ? 'No credit notes yet' : `No ${filter} credit notes`}
            </p>
            {filter === 'all' && (
              <>
                <p className="text-[var(--theme-text-muted)] text-sm mb-8">Issue a credit note to reduce an outstanding invoice balance</p>
                <Link href="/dashboard/credit-notes/new" className="inline-block px-8 py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-[10px] uppercase tracking-widest hover:brightness-110 transition-all shadow-lg no-underline">Create First Credit Note</Link>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map(n => (
                <div key={n.id} onClick={() => router.push(`/dashboard/credit-notes/${n.id}`)}
                  className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-4 cursor-pointer hover:border-[var(--theme-accent)]/30 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[var(--theme-text)] font-black text-sm">{n.credit_note_number}</span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${SC[n.status] || 'bg-[var(--theme-primary)]/3 text-[var(--theme-text-muted)]'}`}>{n.status}</span>
                  </div>
                  <div className="text-[var(--theme-text-muted)] text-sm mb-1">{n.client_name}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--theme-text-muted)] text-xs">{new Date(n.issue_date).toLocaleDateString('en-GB')}</span>
                    <span className="text-[var(--theme-text)] font-bold text-sm">{currencySymbol(n.currency)}{parseFloat(String(n.total)).toFixed(2)}</span>
                  </div>
                  {n.linked_invoice_number && (
                    <p className="text-[var(--theme-text-muted)] text-xs mt-1">re: {n.linked_invoice_number}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] overflow-hidden">
              <table className="w-full">
                <thead className="border-b border-[var(--theme-border)]">
                  <tr>
                    <th className="text-left px-6 py-4 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Number</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Client</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Invoice</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Date</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Status</th>
                    <th className="text-right px-6 py-4 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--theme-border)]">
                  {filtered.map(n => (
                    <tr key={n.id} onClick={() => router.push(`/dashboard/credit-notes/${n.id}`)}
                      className="hover:bg-[var(--theme-border)]/20 cursor-pointer transition-colors">
                      <td className="px-6 py-4 text-[var(--theme-text)] font-black text-sm">{n.credit_note_number}</td>
                      <td className="px-6 py-4 text-[var(--theme-text-muted)] text-sm">{n.client_name}</td>
                      <td className="px-6 py-4 text-[var(--theme-text-muted)] text-sm">{n.linked_invoice_number || '—'}</td>
                      <td className="px-6 py-4 text-[var(--theme-text-muted)] text-sm">{new Date(n.issue_date).toLocaleDateString('en-GB')}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${SC[n.status] || 'bg-[var(--theme-primary)]/3 text-[var(--theme-text-muted)]'}`}>{n.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-[var(--theme-text)] font-bold text-sm">{currencySymbol(n.currency)}{parseFloat(String(n.total)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
