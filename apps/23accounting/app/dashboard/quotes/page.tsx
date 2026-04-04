'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const SC: Record<string, string> = {
  draft:    'border-[var(--theme-border)] text-[var(--theme-text-muted)] bg-[var(--theme-card)]',
  sent:     'border-[var(--theme-accent)]/20 text-[var(--theme-accent)] bg-[var(--theme-accent)]/10',
  accepted: 'border-[var(--theme-accent)]/30 text-[var(--theme-accent)] bg-[var(--theme-accent)]/10',
  declined: 'border-[var(--theme-destructive)]/30 text-[var(--theme-destructive)] bg-[var(--theme-destructive)]/10',
  expired:  'border-[var(--theme-border)] text-[var(--theme-text-muted)] bg-[var(--theme-card)]',
};

const FILTER_LABELS: Record<string, string> = {
  all: 'All', draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', expired: 'Expired',
};

type Quote = { id: string; quote_number: string; client_name: string; valid_until: string; total: string | number; status: string; };

function QuotesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') || 'all';
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/quotes').then(r => r.json()).then(d => { if (d.quotes) setQuotes(d.quotes); }).finally(() => setLoading(false));
  }, []);

  const filtered = quotes.filter(q => filter === 'all' || q.status === filter);

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Quotes</h1>
          <Link href="/dashboard/quotes/new" className="px-4 sm:px-6 py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-[10px] uppercase tracking-widest hover:brightness-110 transition-all shadow-lg no-underline active:scale-[0.98]">+ New</Link>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {Object.keys(FILTER_LABELS).map(f => (
            <button key={f} onClick={() => router.push(`/dashboard/quotes${f === 'all' ? '' : `?filter=${f}`}`)}
              className={`shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                filter === f
                  ? 'bg-[var(--theme-accent)] text-[var(--theme-text)] border-[var(--theme-accent)]'
                  : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:text-[var(--theme-text)]'
              }`}>
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-12 sm:p-16 text-center">
            <div className="w-16 h-16 bg-[var(--theme-card)] rounded-cinematic flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-[var(--theme-text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            {filter === 'all' ? (
              <>
                <p className="text-[var(--theme-text)] font-black text-lg mb-2">No quotes yet</p>
                <p className="text-[var(--theme-text-muted)] text-sm mb-8">Send a quote to a client and convert it to an invoice when accepted</p>
                <Link href="/dashboard/quotes/new" className="inline-block px-8 py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-[10px] uppercase tracking-widest hover:brightness-110 transition-all shadow-lg no-underline">Create Your First Quote</Link>
              </>
            ) : (
              <>
                <p className="text-[var(--theme-text)] font-black text-lg mb-2">No {FILTER_LABELS[filter].toLowerCase()} quotes</p>
                <button onClick={() => router.push('/dashboard/quotes')} className="mt-4 text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest bg-transparent border-none cursor-pointer">Clear filter</button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {filtered.map(qt => (
                <Link key={qt.id} href={`/dashboard/quotes/${qt.id}`} className="block bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic p-4 no-underline hover:bg-[var(--theme-border)]/20 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[var(--theme-accent)] font-black text-sm">{qt.quote_number}</span>
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${SC[qt.status] || ''}`}>{qt.status}</span>
                  </div>
                  <p className="text-[var(--theme-text)] font-bold text-sm mb-1.5">{qt.client_name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--theme-text-muted)] text-xs">Valid until {new Date(qt.valid_until).toLocaleDateString('en-GB')}</span>
                    <span className="text-[var(--theme-text)] font-black text-sm">£{Number(qt.total).toFixed(2)}</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="hidden md:block bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-[2rem] overflow-hidden">
              <table className="w-full">
                <thead className="bg-[var(--theme-border)]/[0.05] border-b border-[var(--theme-border)]">
                  <tr>
                    <th className="text-left px-6 py-4 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Quote</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Client</th>
                    <th className="text-left px-6 py-4 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Valid Until</th>
                    <th className="text-right px-6 py-4 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Total</th>
                    <th className="text-center px-6 py-4 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--theme-border)]">
                  {filtered.map(qt => (
                    <tr key={qt.id} onClick={() => router.push(`/dashboard/quotes/${qt.id}`)} className="hover:bg-[var(--theme-border)]/20 transition-colors cursor-pointer">
                      <td className="px-6 py-4 text-[var(--theme-accent)] font-black text-sm">{qt.quote_number}</td>
                      <td className="px-6 py-4 text-[var(--theme-text)] font-medium text-sm">{qt.client_name}</td>
                      <td className="px-6 py-4 text-[var(--theme-text-muted)] text-sm">{new Date(qt.valid_until).toLocaleDateString('en-GB')}</td>
                      <td className="px-6 py-4 text-right text-[var(--theme-text)] font-black text-sm">£{Number(qt.total).toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${SC[qt.status] || ''}`}>{qt.status}</span>
                      </td>
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

export default function QuotesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--theme-background)] bg-transparent flex items-center justify-center"><svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>}>
      <QuotesContent />
    </Suspense>
  );
}
