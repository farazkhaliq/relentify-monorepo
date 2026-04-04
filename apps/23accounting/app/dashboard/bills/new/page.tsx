'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toaster, toast, SupplierCombobox, DatePicker } from '@relentify/ui';
import { canAccess, Tier } from '@/src/lib/tiers';
import { usePeriodLock } from '@/src/hooks/usePeriodLock';

interface Supplier { id: string; name: string; email?: string; }
interface Project { id: string; name: string; status: string; }
interface AvailablePO { id: string; po_number: string; supplier_name: string; total: string; currency: string; }

const CATEGORIES = ['general', 'office', 'travel', 'marketing', 'utilities', 'professional_services'];
const CATEGORY_LABELS: Record<string, string> = {
  general: 'General', office: 'Office', travel: 'Travel',
  marketing: 'Marketing', utilities: 'Utilities', professional_services: 'Professional Services',
};
const VAT_RATES = [
  { label: '0% (Exempt / Zero-rated)', value: '0' },
  { label: '5% (Reduced rate)',         value: '5' },
  { label: '20% (Standard rate)',       value: '20' },
  { label: 'Custom amount',             value: 'custom' },
];

const inputCls = "w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:ring-2 focus:ring-[var(--theme-accent)] focus:border-[var(--theme-accent)] outline-none transition-all text-sm";
const labelCls = "block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2";

export default function NewBillPage() {
  const router = useRouter();
  const { earliestOpenDate, isDateLocked, lockedMessage } = usePeriodLock();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [availablePOs, setAvailablePOs] = useState<AvailablePO[]>([]);
  const [selectedPOId, setSelectedPOId] = useState('');
  const [poVarianceReason, setPOVarianceReason] = useState('');
  const [poEnabled, setPOEnabled] = useState(false);
  const [poVarianceTolerance, setPOVarianceTolerance] = useState(0);

  // Inline new supplier modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', email: '', phone: '' });
  const [supplierModalLoading, setSupplierModalLoading] = useState(false);
  const [supplierModalError, setSupplierModalError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/suppliers').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/user').then(r => r.json()),
      fetch('/api/po/settings').then(r => r.json()).catch(() => ({ settings: null })),
    ]).then(([supData, projData, userData, poData]) => {
      if (supData.suppliers) setSuppliers(supData.suppliers);
      if (projData.projects) setProjects(projData.projects.filter((p: Project) => p.status === 'active'));
      if (userData.user?.subscription_plan) setSubscriptionPlan(userData.user.subscription_plan);
      if (poData.settings?.enabled) {
        setPOEnabled(true);
        setPOVarianceTolerance(parseFloat(poData.settings.variance_tolerance_pct) || 0);
        fetch('/api/po?forLinking=true').then(r => r.json()).then(d => {
          if (d.pos) setAvailablePOs(d.pos);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  async function handleCreateSupplier() {
    if (!newSupplier.name.trim()) { setSupplierModalError('Supplier name is required'); return; }
    setSupplierModalLoading(true); setSupplierModalError('');
    try {
      const r = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplier),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSuppliers(prev => [...prev, d.supplier].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedSupplierId(d.supplier.id);
      setShowSupplierModal(false);
      setNewSupplier({ name: '', email: '', phone: '' });
    } catch (e: unknown) {
      setSupplierModalError(e instanceof Error ? e.message : 'Failed to create supplier');
    } finally {
      setSupplierModalLoading(false);
    }
  }

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  const [f, setF] = useState({
    netAmount: '',
    vatRate: '20',
    customVatAmount: '',
    currency: 'GBP',
    invoiceDate: '',
    dueDate: '',
    category: 'general',
    notes: '',
    reference: '',
  });

  function uf(k: string, v: string) { setF(p => ({ ...p, [k]: v })); }

  const net = parseFloat(f.netAmount) || 0;
  const isCustomVat = f.vatRate === 'custom';
  const vatRate = isCustomVat ? 0 : (parseFloat(f.vatRate) || 0);
  const vatAmount = isCustomVat ? (parseFloat(f.customVatAmount) || 0) : net * (vatRate / 100);
  const total = net + vatAmount;

  const selectedPO = availablePOs.find(po => po.id === selectedPOId);
  const poTotal = selectedPO ? parseFloat(selectedPO.total) : 0;
  const variancePctDiff = selectedPO && poTotal > 0 ? ((total - poTotal) / poTotal) * 100 : 0;
  const isOverTolerance = selectedPO && total > poTotal && variancePctDiff > poVarianceTolerance;
  const isWithinTolerance = selectedPO && total > poTotal && variancePctDiff <= poVarianceTolerance;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSupplierId && !selectedPO) { toast('Select or create a supplier', 'error'); return; }
    if (net <= 0) { toast('Enter a valid amount', 'error'); return; }
    setLoading(true);
    try {
      const supplierName = selectedSupplier?.name || selectedPO?.supplier_name || '';
      const r = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName,
          amount: total,
          vatRate: isCustomVat ? null : vatRate,
          vatAmount,
          currency: f.currency,
          invoiceDate: f.invoiceDate || undefined,
          dueDate: f.dueDate,
          category: f.category,
          notes: f.notes,
          reference: f.reference,
          projectId: selectedProjectId || undefined,
          poId: selectedPOId || undefined,
          poVarianceReason: poVarianceReason.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setTimeout(() => { window.location.assign(`/dashboard/bills/${d.bill.id}`); }, 300);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to create bill', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />

      {/* Inline new supplier modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--theme-primary)]/60 backdrop-blur-sm" onClick={() => setShowSupplierModal(false)} />
          <div className="relative bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-[2rem] p-6 sm:p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-black text-[var(--theme-text)]">New Supplier</h3>
              <button type="button" onClick={() => setShowSupplierModal(false)} className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]">✕</button>
            </div>
            {supplierModalError && <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic mb-4 text-sm font-bold">{supplierModalError}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Name *</label>
                <input type="text" value={newSupplier.name} onChange={e => setNewSupplier(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:ring-2 focus:ring-[var(--theme-accent)] outline-none text-sm" placeholder="e.g. BT Group" autoFocus />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Email</label>
                <input type="email" value={newSupplier.email} onChange={e => setNewSupplier(p => ({ ...p, email: e.target.value }))} className="w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:ring-2 focus:ring-[var(--theme-accent)] outline-none text-sm" placeholder="accounts@supplier.com" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Phone</label>
                <input type="tel" value={newSupplier.phone} onChange={e => setNewSupplier(p => ({ ...p, phone: e.target.value }))} className="w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:ring-2 focus:ring-[var(--theme-accent)] outline-none text-sm" placeholder="07123 456789" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowSupplierModal(false)} className="flex-1 px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-text)] font-black rounded-cinematic text-sm uppercase tracking-widest hover:bg-[var(--theme-border)]/40 transition-all">Cancel</button>
              <button type="button" onClick={handleCreateSupplier} disabled={supplierModalLoading} className="flex-1 px-4 py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all">
                {supplierModalLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">New Bill</h2>
          <Link href="/dashboard/bills" className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest hover:text-[var(--theme-text)] no-underline">← Back</Link>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Supplier & reference */}
          <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-5 sm:p-8 space-y-4">
            <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Bill Details</h3>

            <div>
              <label className={labelCls}>Supplier *</label>
              <SupplierCombobox
                suppliers={suppliers}
                value={selectedSupplierId}
                onValueChange={setSelectedSupplierId}
                onCreateNew={() => { setSupplierModalError(''); setShowSupplierModal(true); }}
              />
              {selectedSupplier && (
                <div className="mt-2 px-3 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg">
                  {selectedSupplier.email && <p className="text-[var(--theme-text-muted)] text-xs">{selectedSupplier.email}</p>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Reference</label>
                <input type="text" value={f.reference} onChange={e => uf('reference', e.target.value)} className={inputCls} placeholder="Invoice or PO number" />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select value={f.category} onChange={e => uf('category', e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Invoice Date</label>
                <DatePicker value={f.invoiceDate} min={earliestOpenDate || undefined} onChange={v => uf('invoiceDate', isDateLocked(v) ? (earliestOpenDate || v) : v)} />
                {lockedMessage(f.invoiceDate) && <p className="mt-1 text-xs text-[var(--theme-warning)]">{lockedMessage(f.invoiceDate)}</p>}
              </div>
              <div>
                <label className={labelCls}>Due Date *</label>
                <DatePicker value={f.dueDate} min={earliestOpenDate || undefined} onChange={v => uf('dueDate', isDateLocked(v) ? (earliestOpenDate || v) : v)} />
                {lockedMessage(f.dueDate) && <p className="mt-1 text-xs text-[var(--theme-warning)]">{lockedMessage(f.dueDate)}</p>}
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                {(() => {
                  const hasMultiCurrency = canAccess(subscriptionPlan as Tier, 'multi_currency');
                  return hasMultiCurrency ? (
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
                      <p className="mt-1.5 text-[10px] text-[var(--theme-warning)] font-medium">Multiple currencies available on Medium Business plan and above.</p>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <textarea value={f.notes} onChange={e => uf('notes', e.target.value)} rows={2} className={inputCls} placeholder="Any additional notes" />
            </div>
          </div>

          {/* Amounts & VAT */}
          <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-5 sm:p-8 space-y-4">
            <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Amounts</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Net Amount (ex. VAT) *</label>
                <input
                  type="number" required min="0.01" step="0.01"
                  value={f.netAmount} onChange={e => uf('netAmount', e.target.value)}
                  onFocus={e => e.target.select()}
                  className={inputCls} placeholder="0.00"
                />
              </div>
              <div>
                <label className={labelCls}>VAT</label>
                <select value={f.vatRate} onChange={e => uf('vatRate', e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                  {VAT_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>

            {isCustomVat && (
              <div>
                <label className={labelCls}>VAT Amount *</label>
                <input
                  type="number" min="0" step="0.01"
                  value={f.customVatAmount} onChange={e => uf('customVatAmount', e.target.value)}
                  onFocus={e => e.target.select()}
                  className={inputCls} placeholder="0.00"
                />
              </div>
            )}

            {net > 0 && (
              <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--theme-text-muted)]">Net</span>
                  <span className="font-black text-[var(--theme-text)]">£{net.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--theme-text-muted)]">VAT ({vatRate}%)</span>
                  <span className="font-black text-[var(--theme-text)]">£{vatAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-[var(--theme-border)] pt-2 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">Total (inc. VAT)</span>
                  <span className="font-black text-lg text-[var(--theme-text)]">£{total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {poEnabled && availablePOs.length > 0 && (
            <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-5 sm:p-8 space-y-4">
              <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Link to Purchase Order (optional)</h3>
              <select
                value={selectedPOId}
                onChange={e => {
                  setSelectedPOId(e.target.value);
                  setPOVarianceReason('');
                  if (e.target.value && !selectedSupplierId) {
                    const po = availablePOs.find(p => p.id === e.target.value);
                    if (po) {
                      const match = suppliers.find(s => s.name === po.supplier_name);
                      if (match) setSelectedSupplierId(match.id);
                    }
                  }
                }}
                className={inputCls + ' appearance-none bg-[var(--theme-card)]'}
              >
                <option value="">No PO linked</option>
                {availablePOs.map(po => (
                  <option key={po.id} value={po.id}>
                    {po.po_number} — {po.supplier_name} (£{parseFloat(po.total).toFixed(2)})
                  </option>
                ))}
              </select>

              {selectedPO && total > 0 && (
                <div className={`text-xs px-4 py-3 rounded-cinematic border ${
                  isOverTolerance
                    ? 'bg-[var(--theme-warning)]/10 border-[var(--theme-warning)]/20 text-[var(--theme-warning)]'
                    : 'bg-[var(--theme-card)] border-[var(--theme-border)] text-[var(--theme-text-muted)]'
                }`}>
                  {isOverTolerance
                    ? `Bill total £${total.toFixed(2)} is ${variancePctDiff.toFixed(1)}% over the PO amount of £${poTotal.toFixed(2)} — over your ${poVarianceTolerance}% tolerance. A variance reason is required.`
                    : isWithinTolerance
                      ? `Bill total is £${(total - poTotal).toFixed(2)} over the PO amount — within your ${poVarianceTolerance}% tolerance. This will be recorded as fulfilled with variance.`
                      : `Bill total £${total.toFixed(2)} vs PO total £${poTotal.toFixed(2)}.`
                  }
                </div>
              )}

              {isOverTolerance && (
                <div>
                  <label className={labelCls}>Variance Reason *</label>
                  <textarea
                    value={poVarianceReason}
                    onChange={e => setPOVarianceReason(e.target.value)}
                    required
                    rows={2}
                    className={inputCls}
                    placeholder="Explain why the bill amount differs from the PO total..."
                  />
                </div>
              )}
            </div>
          )}

          {projects.length > 0 && (
            <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-5 sm:p-8">
              <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-3">Project (optional)</h3>
              <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating...</>
            ) : 'Create Bill'}
          </button>
        </form>
      </main>
    </div>
  );
}
