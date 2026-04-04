'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toaster, toast, DatePicker } from '@relentify/ui';

const inputCls = "w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:ring-2 focus:ring-[var(--theme-accent)] focus:border-[var(--theme-accent)] outline-none transition-all text-sm";
const labelCls = "block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2";

interface Customer { id: string; name: string; }

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subscriptionPlan, setSubscriptionPlan] = useState('');
  const [f, setF] = useState({
    name: '',
    description: '',
    customerId: '',
    budget: '',
    currency: 'GBP',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/user').then(r => r.json()),
    ]).then(([custData, userData]) => {
      if (custData.customers) setCustomers(custData.customers);
      if (userData.user?.subscription_plan) setSubscriptionPlan(userData.user.subscription_plan);
    }).catch(() => {});
  }, []);

  function uf(k: string, v: string) { setF(p => ({ ...p, [k]: v })); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name,
          description: f.description || undefined,
          customerId: f.customerId || undefined,
          budget: f.budget ? parseFloat(f.budget) : undefined,
          currency: f.currency,
          startDate: f.startDate || undefined,
          endDate: f.endDate || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast('Project created', 'success');
      router.push(`/dashboard/projects/${d.project.id}`);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to create project', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">New Project</h1>
          <Link href="/dashboard/projects" className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest hover:text-[var(--theme-text)] no-underline">← Back</Link>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8 space-y-4">
            <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Project Details</h2>

            <div>
              <label className={labelCls}>Project Name *</label>
              <input type="text" required value={f.name} onChange={e => uf('name', e.target.value)} className={inputCls} placeholder="e.g. Website Redesign" />
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea value={f.description} onChange={e => uf('description', e.target.value)} rows={2} className={inputCls} placeholder="Optional description" />
            </div>

            <div>
              <label className={labelCls}>Customer (optional)</label>
              <select value={f.customerId} onChange={e => uf('customerId', e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                <option value="">No customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8 space-y-4">
            <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Budget & Timeline</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Budget (optional)</label>
                <input type="number" min="0" step="0.01" value={f.budget} onChange={e => uf('budget', e.target.value)} onFocus={e => e.target.select()} className={inputCls} placeholder="0.00" />
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                {(['medium_business', 'corporate'] as const).includes(subscriptionPlan as 'medium_business' | 'corporate') ? (
                  <select value={f.currency} onChange={e => uf('currency', e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                    <option value="GBP">GBP (£)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="CAD">CAD (CA$)</option>
                    <option value="AUD">AUD (A$)</option>
                    <option value="NZD">NZD (NZ$)</option>
                  </select>
                ) : (
                  <div>
                    <input value="GBP (£)" disabled className={inputCls + ' opacity-60 cursor-not-allowed'} />
                    <p className="text-[10px] text-[var(--theme-text-muted)] mt-1">Multi-currency available on Medium Business plan and above.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Start Date</label>
                <DatePicker value={f.startDate} onChange={v => uf('startDate', v)} />
              </div>
              <div>
                <label className={labelCls}>End Date</label>
                <DatePicker value={f.endDate} onChange={v => uf('endDate', v)} />
              </div>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98]"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </main>
    </div>
  );
}
