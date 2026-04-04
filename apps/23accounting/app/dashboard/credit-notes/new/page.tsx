'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Toaster, toast, DatePicker } from '@relentify/ui';

const inputCls = "w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:ring-2 focus:ring-[var(--theme-accent)] focus:border-[var(--theme-accent)] outline-none transition-all text-sm";
const labelCls = "block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2";

interface Customer { id: string; name: string; email?: string; }
interface Invoice { id: string; invoice_number: string; client_name: string; total: string; status: string; }
interface LineItem { description: string; quantity: number; unitPrice: number; vatRate: number; }

export default function NewCreditNotePage() {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, vatRate: 20 },
  ]);

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => { if (d.customers) setCustomers(d.customers); }).catch(() => {});
    fetch('/api/invoices').then(r => r.json()).then(d => { if (d.invoices) setInvoices(d.invoices); }).catch(() => {});
  }, []);

  // When customer selected, auto-fill client name/email
  function handleCustomerChange(id: string) {
    setCustomerId(id);
    const c = customers.find(c => c.id === id);
    if (c) { setClientName(c.name); setClientEmail(c.email || ''); }
  }

  // When invoice selected, auto-fill client name
  function handleInvoiceChange(id: string) {
    setInvoiceId(id);
    const inv = invoices.find(i => i.id === id);
    if (inv && !clientName) setClientName(inv.client_name);
  }

  function updateItem(i: number, k: keyof LineItem, v: string) {
    setItems(prev => prev.map((item, idx) => idx === i
      ? { ...item, [k]: k === 'description' ? v : parseFloat(v) || 0 }
      : item));
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vatTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  const total = subtotal + vatTotal;
  const currencySymbol = { GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$' }[currency] || currency;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) { toast('Client name is required', 'error'); return; }
    if (items.some(i => !i.description.trim())) { toast('All line items need a description', 'error'); return; }

    setLoading(true);
    try {
      const r = await fetch('/api/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName, clientEmail: clientEmail || undefined,
          customerId: customerId || undefined,
          invoiceId: invoiceId || undefined,
          issueDate: issueDate || undefined,
          taxRate: 0, // per-line VAT, not header level
          reason: reason || undefined,
          notes: notes || undefined,
          currency,
          items: items.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.vatRate })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast('Credit note created', 'success');
      setTimeout(() => { window.location.assign(`/dashboard/credit-notes/${d.credit_note.id}`); }, 300);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to create credit note', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">New Credit Note</h1>
          <Link href="/dashboard/credit-notes" className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest hover:text-[var(--theme-text)] no-underline">← Back</Link>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Client details */}
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8 space-y-4">
            <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Credit Note Details</h2>

            {customers.length > 0 && (
              <div>
                <label className={labelCls}>Customer (optional)</label>
                <select value={customerId} onChange={e => handleCustomerChange(e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                  <option value="">— Select customer —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className={labelCls}>Client Name *</label>
              <input type="text" required value={clientName} onChange={e => setClientName(e.target.value)} className={inputCls} placeholder="e.g. Acme Ltd" />
            </div>

            <div>
              <label className={labelCls}>Client Email (optional)</label>
              <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className={inputCls} placeholder="client@example.com" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Issue Date</label>
                <DatePicker value={issueDate} onChange={setIssueDate} />
              </div>
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
            </div>

            <div>
              <label className={labelCls}>Related Invoice (optional)</label>
              <select value={invoiceId} onChange={e => handleInvoiceChange(e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                <option value="">— Not linked to an invoice —</option>
                {invoices.filter(i => i.status !== 'cancelled').map(i => (
                  <option key={i.id} value={i.id}>{i.invoice_number} — {i.client_name} ({currencySymbol}{parseFloat(i.total).toFixed(2)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Reason</label>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} className={inputCls} placeholder="e.g. Goods returned, pricing error, duplicate charge" />
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
                  <div className="col-span-1 flex items-end pb-0.5">
                    {i === 0 && <p className={labelCls}>&nbsp;</p>}
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="p-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)] transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => setItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0, vatRate: 20 }])}
              className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-accent)] hover:text-[var(--theme-accent)] transition-colors">
              + Add Line Item
            </button>

            <div className="border-t border-[var(--theme-border)] pt-4 space-y-1.5">
              <div className="flex justify-between text-sm text-[var(--theme-text-muted)]">
                <span>Subtotal</span><span>{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-[var(--theme-text-muted)]">
                <span>VAT</span><span>{currencySymbol}{vatTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-[var(--theme-text)]">
                <span>Total Credit</span><span>{currencySymbol}{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8">
            <label className={labelCls}>Internal Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputCls} placeholder="Any additional notes" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98]">
            {loading ? 'Creating...' : 'Create Credit Note'}
          </button>
        </form>
      </main>
    </div>
  );
}
