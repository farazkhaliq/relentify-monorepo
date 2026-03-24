'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toaster, toast, SupplierCombobox, DatePicker } from '@relentify/ui';

const inputCls = "w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:ring-2 focus:ring-[var(--theme-accent)] focus:border-[var(--theme-accent)] outline-none transition-all text-sm";
const labelCls = "block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2";

interface Supplier { id: string; name: string; email?: string; }

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export default function NewPOPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', email: '', phone: '' });
  const [supplierModalLoading, setSupplierModalLoading] = useState(false);
  const [supplierModalError, setSupplierModalError] = useState('');

  useEffect(() => {
    fetch('/api/suppliers').then(r => r.json()).then(d => {
      if (d.suppliers) setSuppliers(d.suppliers);
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
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, vatRate: 20 },
  ]);

  function updateItem(i: number, k: keyof LineItem, v: string) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: k === 'description' ? v : parseFloat(v) || 0 } : item));
  }

  function addItem() {
    setItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0, vatRate: 20 }]);
  }

  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i));
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vatTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  const total = subtotal + vatTotal;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSupplierId) { toast('Select or create a supplier', 'error'); return; }
    if (items.some(i => !i.description.trim())) { toast('All line items need a description', 'error'); return; }

    setLoading(true);
    try {
      const r = await fetch('/api/po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierName: selectedSupplier?.name || '', description, currency, items, expectedDate: expectedDate || undefined, notes: notes || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);

      if (d.po.status === 'pending_approval') {
        toast('PO raised — approval request sent', 'success');
      } else {
        toast('Purchase order created and auto-approved', 'success');
      }
      setTimeout(() => { window.location.assign(`/dashboard/po/${d.po.id}`); }, 300);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to create purchase order', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />

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
                <input type="text" value={newSupplier.name} onChange={e => setNewSupplier(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:ring-2 focus:ring-[var(--theme-accent)] outline-none text-sm" placeholder="e.g. Office Depot" autoFocus />
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
          <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">New Purchase Order</h1>
          <Link href="/dashboard/po" className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest hover:text-[var(--theme-text)] no-underline">← Back</Link>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Supplier & details */}
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8 space-y-4">
            <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">PO Details</h2>

            <div>
              <label className={labelCls}>Supplier *</label>
              <SupplierCombobox
                suppliers={suppliers}
                value={selectedSupplierId}
                onValueChange={setSelectedSupplierId}
                onCreateNew={() => { setSupplierModalError(''); setShowSupplierModal(true); }}
              />
              {selectedSupplier?.email && (
                <div className="mt-2 px-3 py-2 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg">
                  <p className="text-[var(--theme-text-muted)] text-xs">{selectedSupplier.email}</p>
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>Description (optional)</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} className={inputCls} placeholder="Brief description of what is being purchased" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="CAD">CAD (CA$)</option>
                  <option value="AUD">AUD (A$)</option>
                  <option value="NZD">NZD (NZ$)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Expected Delivery Date</label>
                <DatePicker value={expectedDate} onChange={setExpectedDate} />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8 space-y-4">
            <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Line Items</h2>

            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-12 sm:col-span-5">
                    {i === 0 && <p className={labelCls}>Description</p>}
                    <input type="text" required value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} className={inputCls} placeholder="Item description" />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    {i === 0 && <p className={labelCls}>Qty</p>}
                    <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} onFocus={e => e.target.select()} className={inputCls} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    {i === 0 && <p className={labelCls}>Unit Price</p>}
                    <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)} onFocus={e => e.target.select()} className={inputCls} />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    {i === 0 && <p className={labelCls}>VAT %</p>}
                    <select value={item.vatRate} onChange={e => updateItem(i, 'vatRate', e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={20}>20%</option>
                    </select>
                  </div>
                  <div className="col-span-1 sm:col-span-1 flex items-end pb-0.5">
                    {i === 0 && <p className={labelCls}>&nbsp;</p>}
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="p-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)] transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={addItem} className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-accent)] hover:text-[var(--theme-accent)] transition-colors">
              + Add Line Item
            </button>

            {/* Totals */}
            <div className="border-t border-[var(--theme-border)] pt-4 space-y-1.5">
              <div className="flex justify-between text-sm text-[var(--theme-text-muted)]">
                <span>Subtotal</span><span>£{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-[var(--theme-text-muted)]">
                <span>VAT</span><span>£{vatTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-[var(--theme-text)]">
                <span>Total</span><span>£{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8">
            <label className={labelCls}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputCls} placeholder="Any additional notes for the approver" />
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98]">
            {loading ? 'Submitting...' : 'Submit Purchase Order'}
          </button>
        </form>
      </main>
    </div>
  );
}
