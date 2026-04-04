'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Toaster, toast } from '@relentify/ui';

interface Project {
  id: string;
  name: string;
  description: string | null;
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

interface Invoice { invoice_number: string; client_name: string; due_date: string; total: string; status: string; currency: string; }
interface Bill { supplier_name: string; category: string; due_date: string; amount: string; currency: string; status: string; }

type Tab = 'summary' | 'income' | 'costs';

const fmt = (n: number | string, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(n));

const STATUS_COLORS: Record<string, string> = {
  active: 'text-[var(--theme-accent)] bg-[var(--theme-accent)]/10',
  completed: 'text-[var(--theme-accent)] bg-[var(--theme-accent)]/10',
  archived: 'text-[var(--theme-text-muted)] bg-[var(--theme-card)]',
  paid: 'text-[var(--theme-accent)] bg-[var(--theme-accent)]/10',
  unpaid: 'text-[var(--theme-warning)] bg-[var(--theme-warning)]/10',
  overdue: 'text-[var(--theme-destructive)] bg-[var(--theme-destructive)]/10',
  sent: 'text-[var(--theme-accent)] bg-[var(--theme-accent)]/10',
};

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('summary');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { toast(d.error, 'error'); return; }
        setProject(d.project);
        setInvoices(d.invoices || []);
        setBills(d.bills || []);
      })
      .catch(() => toast('Failed to load project', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  async function updateStatus(status: string) {
    if (!project) return;
    setUpdatingStatus(true);
    try {
      const r = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setProject(prev => prev ? { ...prev, status } : prev);
      toast(`Project ${status}`, 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to update', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  }


  if (loading) return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent flex items-center justify-center">
      <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
    </div>
  );

  if (!project) return null;

  const budget = project.budget ? parseFloat(project.budget) : null;
  const budgetUsed = budget ? (project.costs / budget) * 100 : null;
  const margin = project.income > 0 ? (project.profit / project.income) * 100 : null;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <Toaster />
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/dashboard/projects" className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest hover:text-[var(--theme-text)] no-underline">← Projects</Link>
            </div>
            <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">{project.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${STATUS_COLORS[project.status] || ''}`}>{project.status}</span>
              {project.customer_name && <span className="text-xs text-[var(--theme-text-muted)]">{project.customer_name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {project.status === 'active' && (
              <button onClick={() => updateStatus('completed')} disabled={updatingStatus} className="px-3 py-1.5 text-xs font-black text-[var(--theme-accent)] border border-[var(--theme-accent)]/20 rounded-lg hover:bg-[var(--theme-accent)]/10 transition-colors disabled:opacity-50">
                Mark Complete
              </button>
            )}
            {project.status !== 'archived' && (
              <button onClick={() => updateStatus('archived')} disabled={updatingStatus} className="px-3 py-1.5 text-xs font-black text-[var(--theme-text-muted)] border border-[var(--theme-border)] rounded-lg hover:bg-[var(--theme-border)]/30 transition-colors disabled:opacity-50">
                Archive
              </button>
            )}
          </div>
        </div>

        {/* Budget progress */}
        {budget !== null && (
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Budget</span>
              <span className="text-sm font-black text-[var(--theme-text)]">{fmt(project.costs, project.currency)} / {fmt(budget, project.currency)}</span>
            </div>
            <div className="h-2 bg-[var(--theme-border)]/30 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${(budgetUsed || 0) > 100 ? 'bg-[var(--theme-destructive)]' : 'bg-[var(--theme-accent)]'}`}
                style={{ width: `${Math.min(budgetUsed || 0, 100)}%` }}
              />
            </div>
            <p className="text-xs text-[var(--theme-text-muted)] mt-1">{fmt(Math.max(budget - project.costs, 0), project.currency)} remaining</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-[var(--theme-border)]">
          {(['summary', 'income', 'costs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${tab === t ? 'text-[var(--theme-accent)] border-b-2 border-[var(--theme-accent)] -mb-px' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Summary tab */}
        {tab === 'summary' && (
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6 space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-[var(--theme-border)]">
              <span className="text-sm text-[var(--theme-text-muted)]">Income (paid invoices)</span>
              <span className="font-black text-[var(--theme-text)]">{fmt(project.income, project.currency)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--theme-border)]">
              <span className="text-sm text-[var(--theme-text-muted)]">Costs (bills)</span>
              <span className="font-black text-[var(--theme-text)]">{fmt(project.costs, project.currency)}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="font-black text-[var(--theme-text)]">Gross Profit</span>
              <span className={`text-xl font-black ${project.profit >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'}`}>{fmt(project.profit, project.currency)}</span>
            </div>
            {margin !== null && (
              <div className="flex justify-between items-center py-2 border-t border-[var(--theme-border)]">
                <span className="text-xs text-[var(--theme-text-muted)]">Margin</span>
                <span className="text-sm font-black text-[var(--theme-text-muted)]">{margin.toFixed(1)}%</span>
              </div>
            )}
            {project.description && (
              <p className="text-sm text-[var(--theme-text-muted)] pt-4 border-t border-[var(--theme-border)]">{project.description}</p>
            )}
          </div>
        )}

        {/* Income tab */}
        {tab === 'income' && (
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic overflow-hidden">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-[var(--theme-text-muted)] text-sm">No invoices linked to this project.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[var(--theme-border)]/[0.05]">
                  <tr className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">
                    <th className="text-left px-4 py-3">Invoice</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Client</th>
                    <th className="text-left px-4 py-3">Due Date</th>
                    <th className="text-right px-4 py-3">Amount</th>
                    <th className="text-left px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, i) => (
                    <tr key={i} className="border-t border-[var(--theme-border)]">
                      <td className="px-4 py-3 font-bold text-[var(--theme-text)]">{inv.invoice_number}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-[var(--theme-text-muted)]">{inv.client_name}</td>
                      <td className="px-4 py-3 text-[var(--theme-text-muted)]">{inv.due_date?.split('T')[0]}</td>
                      <td className="px-4 py-3 text-right font-black text-[var(--theme-text)]">{fmt(inv.total, inv.currency)}</td>
                      <td className="px-4 py-3"><span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${STATUS_COLORS[inv.status] || ''}`}>{inv.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Costs tab */}
        {tab === 'costs' && (
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic overflow-hidden">
            {bills.length === 0 ? (
              <div className="p-8 text-center text-[var(--theme-text-muted)] text-sm">No bills linked to this project.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[var(--theme-border)]/[0.05]">
                  <tr className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">
                    <th className="text-left px-4 py-3">Supplier</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Category</th>
                    <th className="text-left px-4 py-3">Due Date</th>
                    <th className="text-right px-4 py-3">Amount</th>
                    <th className="text-left px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b, i) => (
                    <tr key={i} className="border-t border-[var(--theme-border)]">
                      <td className="px-4 py-3 font-bold text-[var(--theme-text)]">{b.supplier_name}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-[var(--theme-text-muted)]">{b.category}</td>
                      <td className="px-4 py-3 text-[var(--theme-text-muted)]">{b.due_date?.split('T')[0]}</td>
                      <td className="px-4 py-3 text-right font-black text-[var(--theme-text)]">{fmt(b.amount, b.currency)}</td>
                      <td className="px-4 py-3"><span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status] || ''}`}>{b.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
  );
}
