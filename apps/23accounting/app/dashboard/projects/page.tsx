'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Toaster, toast } from '@relentify/ui';

interface Project {
  id: string;
  name: string;
  customer_name: string | null;
  status: string;
  income: number;
  costs: number;
  profit: number;
  budget: string | null;
  currency: string;
  start_date: string | null;
  end_date: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-[var(--theme-accent)] bg-[var(--theme-accent)]/10',
  completed: 'text-[var(--theme-accent)] bg-[var(--theme-accent)]/10',
  archived: 'text-[var(--theme-text-muted)] bg-[var(--theme-card)]',
};

const fmt = (n: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n);

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'completed' | 'archived' | 'all'>('active');

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => { if (d.projects) setProjects(d.projects); })
      .catch(() => toast('Failed to load projects', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter);
  const totalIncome = filtered.reduce((s, p) => s + p.income, 0);
  const totalCosts = filtered.reduce((s, p) => s + p.costs, 0);
  const activeCount = projects.filter(p => p.status === 'active').length;

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Projects</h1>
            <p className="text-sm text-[var(--theme-text-muted)] mt-1">Job costing & project P&amp;L</p>
          </div>
          <Link href="/dashboard/projects/new" className="px-4 py-2.5 bg-[var(--theme-accent)] text-white font-black text-xs uppercase tracking-widest rounded-cinematic hover:brightness-110 no-underline transition-all">
            + New Project
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Active Projects', value: activeCount, isNum: true },
            { label: 'Total Billed', value: fmt(totalIncome), isNum: false },
            { label: 'Total Costs', value: fmt(totalCosts), isNum: false },
          ].map(c => (
            <div key={c.label} className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5">
              <p className="text-[9px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">{c.label}</p>
              <p className="text-2xl font-black text-[var(--theme-text)]">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {(['active', 'completed', 'archived', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-colors shrink-0 ${filter === s ? 'bg-[var(--theme-accent)] text-[var(--theme-text)]' : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)]/50'}`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-[var(--theme-text-muted)] text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-8 text-center">
            <p className="text-[var(--theme-text-muted)]">No projects found.</p>
            <Link href="/dashboard/projects/new" className="mt-3 inline-block text-[var(--theme-accent)] text-sm font-bold no-underline">Create your first project →</Link>
          </div>
        ) : (
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--theme-border)]/[0.05]">
                <tr className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">
                  <th className="text-left px-4 py-3">Project</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Customer</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3 hidden md:table-cell">Income</th>
                  <th className="text-right px-4 py-3 hidden md:table-cell">Costs</th>
                  <th className="text-right px-4 py-3">Profit</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-t border-[var(--theme-border)] hover:bg-[var(--theme-border)]/20 transition-colors">
                    <td className="px-4 py-3 font-bold text-[var(--theme-text)]">{p.name}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-[var(--theme-text-muted)]">{p.customer_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] || ''}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell text-[var(--theme-text)]">{fmt(p.income, p.currency)}</td>
                    <td className="px-4 py-3 text-right hidden md:table-cell text-[var(--theme-text)]">{fmt(p.costs, p.currency)}</td>
                    <td className={`px-4 py-3 text-right font-black ${p.profit >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'}`}>{fmt(p.profit, p.currency)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/projects/${p.id}`} className="text-[9px] font-black text-[var(--theme-accent)] uppercase tracking-widest no-underline hover:text-[var(--theme-accent)]">View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
