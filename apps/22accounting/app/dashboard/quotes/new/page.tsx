'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerCombobox, Toaster, toast, DatePicker } from '@relentify/ui';

interface Item { description: string; quantity: number; unitPrice: number; taxRate: number; }
interface UserProfile { vat_registered: boolean; vat_number: string | null; subscription_plan: string; }
interface Customer { id: string; name: string; email?: string; address?: string; }

const inputCls = "w-full px-4 py-3 bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-dim)] focus:ring-2 focus:ring-[var(--theme-accent)] focus:border-[var(--theme-accent)] outline-none transition-all text-sm";

const VALIDITY_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: 'Custom', days: -1 },
];

export default function NewQuotePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '', address: '' });

  const [f, setF] = useState({
    issueDate: new Date().toISOString().split('T')[0],
    validityDays: '30',
    validUntil: '',
    taxRate: 0,
    currency: 'GBP',
    notes: '',
  });
  const [items, setItems] = useState<Item[]>([{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }]);

  useEffect(() => {
    async function loadData() {
      try {
        const [custRes, userRes] = await Promise.all([fetch('/api/customers'), fetch('/api/user')]);
        const custData = await custRes.json();
        const userData = await userRes.json();
        if (custData.customers) setCustomers(custData.customers);
        if (userData.user?.vat_registered) setF(p => ({ ...p, taxRate: 20 }));
        setUserProfile(userData.user);
      } catch { /* silent */ }
    }
    loadData();
  }, []);

  // Auto-calculate valid until from issue date + validity days
  useEffect(() => {
    const days = parseInt(f.validityDays);
    if (days < 0 || !f.issueDate) return;
    const base = new Date(f.issueDate);
    base.setDate(base.getDate() + days);
    setF(p => ({ ...p, validUntil: base.toISOString().split('T')[0] }));
  }, [f.issueDate, f.validityDays]);

  function uf(k: string, v: string | number) { setF(p => ({ ...p, [k]: v })); }
  function ui(i: number, k: keyof Item, v: string | number) { setItems(p => { const u = [...p]; u[i] = { ...u[i], [k]: v }; return u; }); }

  function handleCustomerSelect(customerId: string) {
    setSelectedCustomerId(customerId);
    setSelectedCustomer(customers.find(c => c.id === customerId) || null);
  }

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault(); setModalError(''); setModalLoading(true);
    try {
      const r = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCust) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setCustomers(prev => [...prev, d.customer]);
      handleCustomerSelect(d.customer.id);
      setShowModal(false);
      setNewCust({ name: '', email: '', phone: '', address: '' });
      toast('Customer created', 'success');
    } catch (e: unknown) { setModalError(e instanceof Error ? e.message : 'Failed'); }
    finally { setModalLoading(false); }
  }

  const sub = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const tax = sub * (f.taxRate / 100);
  const total = sub + tax;
  const sym: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$' };
  const cs = sym[f.currency] || '£';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomerId) { toast('Please select a customer', 'error'); return; }
    if (items.some(i => !i.description.trim())) { toast('Please add a description for all line items', 'error'); return; }
    if (!f.validUntil) { toast('Valid until date is required', 'error'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          clientName: selectedCustomer?.name || '',
          clientEmail: selectedCustomer?.email || '',
          clientAddress: selectedCustomer?.address || '',
          issueDate: f.issueDate,
          validUntil: f.validUntil,
          taxRate: Number(f.taxRate),
          currency: f.currency,
          notes: f.notes,
          items: items.map(i => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), taxRate: Number(i.taxRate) })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      router.push(`/dashboard/quotes/${d.quote.id}`);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to create quote', 'error');
    } finally { setLoading(false); }
  }

  return (
    <div>
      <Toaster />

      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--theme-primary)]/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-[2rem] p-6 sm:p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-black text-[var(--theme-text)]">New Customer</h3>
              <button onClick={() => setShowModal(false)} className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] bg-transparent border-none cursor-pointer text-xl">✕</button>
            </div>
            {modalError && <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic mb-4 text-sm font-bold">{modalError}</div>}
            <form onSubmit={createCustomer} className="space-y-4">
              <div><label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Name *</label><input type="text" required value={newCust.name} onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))} className={inputCls} /></div>
              <div><label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Email</label><input type="email" value={newCust.email} onChange={e => setNewCust(p => ({ ...p, email: e.target.value }))} className={inputCls} /></div>
              <div><label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Phone</label><input type="tel" value={newCust.phone} onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))} className={inputCls} /></div>
              <div><label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Address</label><textarea value={newCust.address} onChange={e => setNewCust(p => ({ ...p, address: e.target.value }))} rows={2} className={inputCls} /></div>
              <button type="submit" disabled={modalLoading} className="w-full py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all">{modalLoading ? 'Creating...' : 'Create Customer'}</button>
            </form>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight mb-8">New Quote</h2>

        <form onSubmit={onSubmit} className="space-y-6">

          {/* Customer */}
          <div className="bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-5 sm:p-8 space-y-4">
            <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Customer *</h3>
            <CustomerCombobox customers={customers} value={selectedCustomerId} onValueChange={handleCustomerSelect} onCreateNew={() => { setModalError(''); setShowModal(true); }} />
            {selectedCustomer && (
              <div className="mt-3 px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic space-y-1">
                {selectedCustomer.email && <p className="text-[var(--theme-text-muted)] text-xs">{selectedCustomer.email}</p>}
                {selectedCustomer.address && <p className="text-[var(--theme-text-muted)] text-xs whitespace-pre-wrap">{selectedCustomer.address}</p>}
              </div>
            )}
          </div>

          {/* Quote Details */}
          <div className="bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-5 sm:p-8 space-y-4">
            <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Quote Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Quote Date *</label>
                <DatePicker value={f.issueDate} onChange={v => uf('issueDate', v)} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Valid For</label>
                <select value={f.validityDays} onChange={e => uf('validityDays', e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-background)]'}>
                  {VALIDITY_OPTIONS.map(o => <option key={o.days} value={o.days} className="bg-[var(--theme-background)]">{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Valid Until *</label>
                <DatePicker value={f.validUntil} onChange={v => uf('validUntil', v)} disabled={f.validityDays !== '-1'} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Currency</label>
                {(['medium_business', 'corporate'] as const).includes(userProfile?.subscription_plan as 'medium_business' | 'corporate') ? (
                  <select value={f.currency} onChange={e => uf('currency', e.target.value)} className={inputCls + ' appearance-none'}>
                    {['GBP','USD','EUR','CAD','AUD','NZD'].map(c => <option key={c} value={c} className="bg-[var(--theme-background)]">{c}</option>)}
                  </select>
                ) : (
                  <div>
                    <input value="GBP (£)" disabled className={inputCls + ' opacity-60 cursor-not-allowed'} />
                    <p className="text-[10px] text-[var(--theme-text-muted)] mt-1">Multi-currency available on Medium Business plan and above.</p>
                  </div>
                )}
              </div>
            </div>
            {userProfile?.vat_registered && (
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">VAT %</label>
                <input type="number" min="0" max="100" step="0.01" value={f.taxRate} onChange={e => uf('taxRate', e.target.value)} onFocus={e => e.target.select()} className={inputCls} />
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-5 sm:p-8 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Line Items</h3>
              <button type="button" onClick={() => setItems(p => [...p, { description: '', quantity: 1, unitPrice: 0, taxRate: 0 }])} className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest hover:text-[var(--theme-accent)] bg-transparent border-none cursor-pointer">+ Add</button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="space-y-2 pb-4 border-b border-[var(--theme-border)]/50 last:border-0 last:pb-0">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    {idx === 0 && <label className="block text-[9px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Description</label>}
                    <textarea required value={item.description} onChange={e => ui(idx, 'description', e.target.value)} rows={2}
                      className="w-full px-3 py-2.5 bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-lg text-[var(--theme-text)] text-sm outline-none focus:ring-2 focus:ring-[var(--theme-accent)] resize-none min-h-[60px]"
                      placeholder="Description of service or product" />
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="text-[var(--theme-destructive)] hover:text-[var(--theme-destructive)] bg-transparent border-none cursor-pointer text-lg mt-6 shrink-0">✕</button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    {idx === 0 && <label className="block text-[9px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Qty</label>}
                    <input type="number" min="0.01" step="0.01" required value={item.quantity} onChange={e => ui(idx, 'quantity', parseFloat(e.target.value) || 0)} onFocus={e => e.target.select()} className="w-full px-3 py-2.5 bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-lg text-[var(--theme-text)] text-sm outline-none focus:ring-2 focus:ring-[var(--theme-accent)]" />
                  </div>
                  <div>
                    {idx === 0 && <label className="block text-[9px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Price</label>}
                    <input type="number" min="0" step="0.01" required value={item.unitPrice} onChange={e => ui(idx, 'unitPrice', parseFloat(e.target.value) || 0)} onFocus={e => e.target.select()} className="w-full px-3 py-2.5 bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-lg text-[var(--theme-text)] text-sm outline-none focus:ring-2 focus:ring-[var(--theme-accent)]" />
                  </div>
                  <div>
                    {idx === 0 && <label className="block text-[9px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Amount</label>}
                    <p className="px-3 py-2.5 text-sm font-black text-[var(--theme-text)]">{cs}{(item.quantity * item.unitPrice).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-5 sm:p-8">
            <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Notes</h3>
            <textarea value={f.notes} onChange={e => uf('notes', e.target.value)} rows={2} className={inputCls} placeholder="Any additional notes for the client" />
          </div>

          {/* Totals */}
          <div className="bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-5 sm:p-8">
            <div className="flex justify-between items-center text-[var(--theme-text)] mb-2"><span className="font-bold">Subtotal:</span><span>{cs}{sub.toFixed(2)}</span></div>
            {userProfile?.vat_registered && <div className="flex justify-between items-center text-[var(--theme-text-muted)] text-sm mb-2"><span>VAT ({f.taxRate}%):</span><span>{cs}{tax.toFixed(2)}</span></div>}
            <div className="flex justify-between items-center text-[var(--theme-text)] text-xl font-black pt-4 border-t border-[var(--theme-border)]"><span>Total:</span><span className="text-[var(--theme-accent)]">{cs}{total.toFixed(2)}</span></div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2">
            {loading ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating...</>) : 'Create Quote'}
          </button>
        </form>
      </main>
    </div>
  );
}
