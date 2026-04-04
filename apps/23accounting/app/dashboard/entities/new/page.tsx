'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toaster, toast } from '@relentify/ui';

const inputCls = "w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:ring-2 focus:ring-[var(--theme-accent)] focus:border-[var(--theme-accent)] outline-none transition-all text-sm";
const labelCls = "block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2";

export default function NewEntityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    name: '',
    businessStructure: '',
    companyNumber: '',
    vatRegistered: false,
    vatNumber: '',
    currency: 'GBP',
    countryCode: 'GB',
    address: '',
  });

  function uf(k: string, v: string | boolean) { setF(p => ({ ...p, [k]: v })); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name,
          businessStructure: f.businessStructure || undefined,
          companyNumber: f.companyNumber || undefined,
          vatRegistered: f.vatRegistered,
          vatNumber: f.vatNumber || undefined,
          currency: f.currency,
          countryCode: f.countryCode,
          address: f.address || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast('Entity created', 'success');
      router.push('/dashboard/entities');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to create entity', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">New Entity</h1>
          <Link href="/dashboard/entities" className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest hover:text-[var(--theme-text)] no-underline">← Back</Link>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8 space-y-4">
            <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Entity Details</h2>

            <div>
              <label className={labelCls}>Entity Name *</label>
              <input type="text" required value={f.name} onChange={e => uf('name', e.target.value)} className={inputCls} placeholder="e.g. Acme Ltd" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Business Structure</label>
                <select value={f.businessStructure} onChange={e => uf('businessStructure', e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                  <option value="">Select...</option>
                  <option value="sole_trader">Sole Trader</option>
                  <option value="limited_company">Limited Company</option>
                  <option value="llp">LLP</option>
                  <option value="partnership">Partnership</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Company Number</label>
                <input type="text" value={f.companyNumber} onChange={e => uf('companyNumber', e.target.value)} className={inputCls} placeholder="e.g. 12345678" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Currency</label>
                <select value={f.currency} onChange={e => uf('currency', e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="CAD">CAD (CA$)</option>
                  <option value="AUD">AUD (A$)</option>
                  <option value="NZD">NZD (NZ$)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <select value={f.countryCode} onChange={e => uf('countryCode', e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                  <option value="GB">United Kingdom</option>
                  <option value="US">United States</option>
                  <option value="IE">Ireland</option>
                  <option value="AU">Australia</option>
                  <option value="NZ">New Zealand</option>
                  <option value="CA">Canada</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Address</label>
              <textarea value={f.address} onChange={e => uf('address', e.target.value)} rows={2} className={inputCls} placeholder="Business address" />
            </div>
          </div>

          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8 space-y-4">
            <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">VAT</h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={f.vatRegistered} onChange={e => uf('vatRegistered', e.target.checked)} className="w-4 h-4 rounded accent-[var(--theme-accent)]" />
              <span className="text-sm font-bold text-[var(--theme-text-muted)]">VAT Registered</span>
            </label>
            {f.vatRegistered && (
              <div>
                <label className={labelCls}>VAT Number</label>
                <input type="text" value={f.vatNumber} onChange={e => uf('vatNumber', e.target.value)} className={inputCls} placeholder="e.g. GB123456789" />
              </div>
            )}
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98]"
          >
            {loading ? 'Creating...' : 'Create Entity'}
          </button>
        </form>
      </main>
    </div>
  );
}
