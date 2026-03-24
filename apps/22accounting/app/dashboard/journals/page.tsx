'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Toaster, toast } from '@relentify/ui';
import Comments from '@/src/components/Comments';

interface Journal {
  id: string;
  entry_date: string;
  reference: string | null;
  description: string | null;
  total_debit: string;
  line_count: string;
  created_at: string;
}

export default function JournalsPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [reversing, setReversing] = useState<string | null>(null);
  const [expandedJournalId, setExpandedJournalId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/journals')
      .then(r => r.json())
      .then(d => { if (d.journals) setJournals(d.journals); })
      .finally(() => setLoading(false));
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) {
        setCurrentUserId(d.user.id);
        setTargetUserId(d.actorId && d.actorId !== d.user.id ? d.actorId : null);
      }
    }).catch(() => {});
  }, []);

  async function reverse(id: string, ref: string | null) {
    if (!confirm(`Reverse journal entry${ref ? ` "${ref}"` : ''}? This will create an equal and opposite entry.`)) return;
    setReversing(id);
    try {
      const r = await fetch(`/api/journals/${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast('Journal reversed — reversal entry created', 'success');
      // Reload
      fetch('/api/journals').then(r => r.json()).then(d => { if (d.journals) setJournals(d.journals); });
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to reverse', 'error');
    } finally {
      setReversing(null);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Manual Journals</h2>
            <p className="text-[var(--theme-text-muted)] text-sm mt-0.5">Accruals, prepayments, corrections, depreciation</p>
          </div>
          <Link href="/dashboard/journals/new"
            className="px-5 py-2.5 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-[10px] uppercase tracking-widest hover:brightness-110 transition-all no-underline shadow-sm">
            + New Journal
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : journals.length === 0 ? (
          <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-[2rem] p-12 text-center">
            <p className="text-[var(--theme-text)] font-black text-lg mb-2">No manual journals yet</p>
            <p className="text-[var(--theme-text-muted)] text-sm mb-6">Post journals for accruals, prepayments, depreciation, and corrections.</p>
            <Link href="/dashboard/journals/new"
              className="inline-block px-6 py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 transition-all no-underline">
              Create First Journal
            </Link>
          </div>
        ) : (
          <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--theme-border)]">
                    <th className="px-4 py-3 text-left text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Date</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Reference</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Description</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Lines</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Total Dr</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--theme-border)]">
                  {journals.map(j => (
                    <React.Fragment key={j.id}>
                      <tr className="hover:bg-[var(--theme-border)]/20 transition-colors">
                        <td className="px-4 py-3 text-[var(--theme-text-muted)] text-sm">
                          {new Date(j.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-[var(--theme-text)] font-bold text-sm">{j.reference || '—'}</td>
                        <td className="px-4 py-3 text-[var(--theme-text-muted)] text-sm max-w-xs truncate">{j.description || '—'}</td>
                        <td className="px-4 py-3 text-center text-[var(--theme-text-muted)] text-sm">{j.line_count}</td>
                        <td className="px-4 py-3 text-right text-[var(--theme-text)] font-bold text-sm">£{parseFloat(j.total_debit).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => setExpandedJournalId(expandedJournalId === j.id ? null : j.id)}
                              className="text-[10px] font-black text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)] uppercase tracking-widest bg-transparent border border-[var(--theme-border)] rounded-lg px-2 py-1 transition-colors"
                              title="Comments"
                            >
                              💬
                            </button>
                            <button
                              onClick={() => reverse(j.id, j.reference)}
                              disabled={reversing === j.id}
                              className="text-[10px] font-black text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)] uppercase tracking-widest bg-transparent border-none cursor-pointer disabled:opacity-50 transition-colors"
                            >
                              {reversing === j.id ? 'Reversing…' : 'Reverse'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedJournalId === j.id && currentUserId && (
                        <tr>
                          <td colSpan={6} className="px-4 py-3 bg-[var(--theme-card)]">
                            <Comments recordType="journal" recordId={j.id} currentUserId={currentUserId} targetUserId={targetUserId} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-[10px] text-[var(--theme-text-dim)] mt-4">
          Only manual journals are shown here. System-generated entries (invoices, bills, payments) appear in the <Link href="/dashboard/reports/general-ledger" className="text-[var(--theme-accent)] no-underline">General Ledger</Link>.
        </p>
      </main>
    </div>
  );
}
