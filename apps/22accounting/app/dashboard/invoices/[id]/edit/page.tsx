'use client';

import { useState, useEffect , use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Toaster, toast, Card, Input, NativeSelect as Select, Label, Button, ThemeProvider, Textarea, DatePicker
} from '@relentify/ui';
import { canAccess, Tier } from '@/src/lib/tiers';

interface Item { description: string; quantity: number; unitPrice: number; }
interface UserProfile { vat_registered: boolean; vat_number: string | null; business_name: string | null; subscription_plan: string | null; }
interface Customer { id: string; name: string; email?: string; address?: string; }

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '', address: '' });
  const [f, setF] = useState({ invoiceDate: '', dueDate: '', paymentTerms: 'net_30', taxRate: 0, notes: '', currency: 'GBP' });
  const [items, setItems] = useState<Item[]>([{ description: '', quantity: 1, unitPrice: 0 }]);

  useEffect(() => {
    async function load() {
      try {
        const [invRes, custRes, userRes] = await Promise.all([
          fetch(`/api/invoices/${id}`),
          fetch('/api/customers'),
          fetch('/api/user'),
        ]);
        const invData = await invRes.json();
        const custData = await custRes.json();
        const userData = await userRes.json();

        if (invData.error || invData.invoice?.status !== 'draft') {
          router.push(`/dashboard/invoices/${id}`);
          return;
        }

        const inv = invData.invoice;
        if (custData.customers) setCustomers(custData.customers);
        if (userData.user) setUserProfile(userData.user);

        setF({
          invoiceDate: inv.issue_date?.split('T')[0] || new Date().toISOString().split('T')[0],
          dueDate: inv.due_date?.split('T')[0] || '',
          paymentTerms: inv.payment_terms || 'net_30',
          taxRate: Number(inv.tax_rate) || 0,
          notes: inv.notes || '',
          currency: inv.currency || 'GBP',
        });

        if (inv.items?.length > 0) {
          setItems(inv.items.map((i: any) => ({
            description: i.description,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unit_price),
          })));
        }

        if (custData.customers && inv.client_name) {
          const matched = custData.customers.find((c: Customer) => c.name === inv.client_name);
          if (matched) { setSelectedCustomerId(matched.id); setSelectedCustomer(matched); }
        }
      } catch {
        toast('Failed to load invoice', 'error');
      } finally {
        setInitialLoading(false);
      }
    }
    load();
  }, [id, router]);

  function uf(k: string, v: string | number) { setF(p => ({ ...p, [k]: v })); }
  function ui(i: number, k: keyof Item, v: string | number) {
    setItems(p => { const u = [...p]; u[i] = { ...u[i], [k]: v } as Item; return u; });
  }
  function handleCustomerSelect(cid: string) {
    setSelectedCustomerId(cid);
    setSelectedCustomer(customers.find(c => c.id === cid) || null);
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
      toast('Customer added', 'success');
    } catch (e: unknown) { setModalError(e instanceof Error ? e.message : 'Failed'); }
    finally { setModalLoading(false); }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomerId) { toast('Please select a customer', 'error'); return; }
    if (items.some(i => !i.description.trim())) { toast('Please fill in all item descriptions', 'error'); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          clientName: selectedCustomer?.name || '',
          clientEmail: selectedCustomer?.email || '',
          clientAddress: selectedCustomer?.address || '',
          customerId: selectedCustomerId,
          taxRate: Number(f.taxRate),
          items: items.map(i => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), taxRate: 0 })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      router.push(`/dashboard/invoices/${id}`);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to save', 'error');
    } finally { setSaving(false); }
  }

  const sub = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const tax = sub * (f.taxRate / 100);
  const total = sub + tax;
  const sym: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$' };
  const cs = sym[f.currency] || '£';

  if (initialLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-6 h-6 animate-spin border-2 border-[var(--theme-accent)] border-t-transparent rounded-full" />
    </div>
  );

  return (
    <ThemeProvider initialPreset="B">
      <div className="min-h-screen bg-background font-sans">
        <Toaster />

        {/* New customer modal */}
        {showModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[var(--theme-primary)]/70 backdrop-blur-sm">
            <Card variant="default" padding="lg" className="relative w-full max-w-md shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-[var(--theme-text)]">New Customer</h3>
                <Button onClick={() => setShowModal(false)} variant="ghost" size="sm" className="px-2">✕</Button>
              </div>
              {modalError && <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic text-sm font-bold">{modalError}</div>}
              <form onSubmit={createCustomer} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input type="text" required value={newCust.name} onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))} placeholder="Acme Ltd" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newCust.email} onChange={e => setNewCust(p => ({ ...p, email: e.target.value }))} placeholder="billing@acme.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input type="tel" value={newCust.phone} onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))} placeholder="+44 7700 900000" />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea value={newCust.address} onChange={e => setNewCust(p => ({ ...p, address: e.target.value }))} rows={3} placeholder="123 High Street" />
                </div>
                <Button type="submit" disabled={modalLoading} variant="primary" className="w-full rounded-cinematic uppercase tracking-widest font-black">
                  {modalLoading ? 'Adding...' : 'Add Customer'}
                </Button>
              </form>
            </Card>
          </div>
        )}

        {/* Header */}
        <div className="bg-background border-b border-[var(--theme-border)] sticky top-0 z-50">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href={`/dashboard/invoices/${id}`} className="flex items-center gap-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] no-underline transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              <span className="text-sm font-bold">Back</span>
            </Link>
            <h1 className="text-sm font-black text-[var(--theme-text)] uppercase tracking-widest">Edit Invoice</h1>
            <Button
              form="edit-form"
              type="submit"
              disabled={saving}
              variant="primary"
              className="px-6 rounded-lg text-xs uppercase tracking-widest font-black"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
          <form id="edit-form" onSubmit={onSubmit} className="space-y-6">

            {/* Customer */}
            <Card variant="default" padding="lg" className="space-y-4">
              <Label className="text-[var(--theme-accent)]">Customer</Label>
              <div className="space-y-4">
                <Select value={selectedCustomerId} onChange={e => handleCustomerSelect(e.target.value)}>
                  <option value="">Select a customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                {selectedCustomer && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-[var(--theme-accent)]/5 border border-[var(--theme-accent)]/20 rounded-cinematic">
                    <div className="w-8 h-8 rounded-full bg-[var(--theme-accent)]/20 flex items-center justify-center shrink-0">
                      <span className="text-[var(--theme-accent)] font-black text-sm">{selectedCustomer.name[0]}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[var(--theme-text)] font-bold text-sm truncate">{selectedCustomer.name}</p>
                      {selectedCustomer.email && <p className="text-[var(--theme-text-dim)] text-xs truncate">{selectedCustomer.email}</p>}
                    </div>
                  </div>
                )}
                <Button type="button" onClick={() => setShowModal(true)} variant="ghost" className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest hover:brightness-110 p-0 h-auto">
                  + New Customer
                </Button>
              </div>
            </Card>

            {/* Dates & Terms */}
            <Card variant="default" padding="lg" className="space-y-4">
              <Label className="text-[var(--theme-accent)]">Dates & Terms</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <DatePicker value={f.invoiceDate} onChange={v => uf('invoiceDate', v)} />
                </div>
                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <Select value={f.paymentTerms} onChange={e => uf('paymentTerms', e.target.value)}>
                    <option value="due_on_receipt">Due on Receipt</option>
                    <option value="net_7">Net 7 Days</option>
                    <option value="net_14">Net 14 Days</option>
                    <option value="net_30">Net 30 Days</option>
                    <option value="net_60">Net 60 Days</option>
                    <option value="custom">Custom Due Date</option>
                  </Select>
                </div>
                {f.paymentTerms === 'custom' && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Due Date</Label>
                    <DatePicker value={f.dueDate} onChange={v => uf('dueDate', v)} />
                  </div>
                )}
              </div>
            </Card>

            {/* Currency & VAT */}
            <Card variant="default" padding="lg" className="space-y-4">
              <Label className="text-[var(--theme-accent)]">Currency & Tax</Label>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  {(() => {
                    const hasMultiCurrency = canAccess(userProfile?.subscription_plan as Tier, 'multi_currency');
                    return hasMultiCurrency ? (
                      <Select value={f.currency} onChange={e => uf('currency', e.target.value)}>
                        <option value="GBP">GBP — British Pound (£)</option>
                        <option value="USD">USD — US Dollar ($)</option>
                        <option value="EUR">EUR — Euro (€)</option>
                        <option value="CAD">CAD — Canadian Dollar</option>
                        <option value="AUD">AUD — Australian Dollar</option>
                        <option value="NZD">NZD — New Zealand Dollar</option>
                      </Select>
                    ) : (
                      <div>
                        <Input value={f.currency === 'GBP' ? 'GBP — British Pound (£)' : f.currency} disabled className="opacity-60 cursor-not-allowed" />
                        {f.currency === 'GBP' && <p className="mt-1.5 text-[10px] text-[var(--theme-warning)] font-medium">Multiple currencies available on Medium Business plan and above.</p>}
                      </div>
                    );
                  })()}
                </div>
                {userProfile?.vat_registered && (
                  <div className="space-y-2">
                    <Label>VAT Rate (%)</Label>
                    <Input type="number" min="0" max="100" step="0.01" value={f.taxRate} onChange={e => uf('taxRate', e.target.value)} onFocus={e => e.target.select()} placeholder="20" />
                  </div>
                )}
              </div>
            </Card>

            {/* Line Items */}
            <Card variant="default" padding="none" className="overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--theme-border)] bg-[var(--theme-card)] flex items-center justify-between">
                <Label className="text-[var(--theme-accent)]">Line Items</Label>
                <Button
                  type="button"
                  onClick={() => setItems(p => [...p, { description: '', quantity: 1, unitPrice: 0 }])}
                  variant="ghost"
                  className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest hover:brightness-110 p-0 h-auto"
                >
                  + Add Item
                </Button>
              </div>
              <div className="divide-y divide-[var(--theme-border)]">
                {items.map((item, idx) => (
                  <div key={idx} className="p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          required
                          value={item.description}
                          onChange={e => ui(idx, 'description', e.target.value)}
                          rows={2}
                          placeholder="Service or product description"
                        />
                      </div>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          onClick={() => setItems(p => p.filter((_, i) => i !== idx))}
                          variant="ghost"
                          className="mt-7 text-[var(--theme-text-dim)] hover:text-[var(--theme-destructive)]"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-center block">Qty</Label>
                        <Input
                          type="number" min="0.01" step="0.01" required
                          value={item.quantity}
                          onChange={e => ui(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          onFocus={e => e.target.select()}
                          className="text-center"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-center block">Unit Price</Label>
                        <Input
                          type="number" min="0" step="0.01" required
                          value={item.unitPrice}
                          onChange={e => ui(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          onFocus={e => e.target.select()}
                          className="text-center"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-center block">Amount</Label>
                        <div className="h-12 flex items-center justify-center bg-[var(--theme-accent)]/5 border border-[var(--theme-accent)]/20 rounded-cinematic">
                          <span className="text-[var(--theme-accent)] font-black text-sm">{cs}{(item.quantity * item.unitPrice).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Notes */}
            <Card variant="default" padding="lg" className="space-y-4">
              <Label className="text-[var(--theme-accent)]">Notes (optional)</Label>
              <Textarea
                value={f.notes}
                onChange={e => uf('notes', e.target.value)}
                rows={3}
                placeholder="Payment instructions, thanks, or any notes for the client..."
              />
            </Card>

            {/* Totals */}
            <Card variant="default" padding="lg" className="space-y-3 bg-[var(--theme-card)]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--theme-text-muted)] text-sm">Subtotal</span>
                <span className="text-[var(--theme-text)] font-bold text-sm">{cs}{sub.toFixed(2)}</span>
              </div>
              {userProfile?.vat_registered && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--theme-text-muted)] text-sm">VAT ({f.taxRate}%)</span>
                  <span className="text-[var(--theme-text)] text-sm">{cs}{tax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--theme-border)]">
                <span className="text-[var(--theme-text)] font-black">Total</span>
                <span className="text-2xl font-black text-[var(--theme-accent)]">{cs}{total.toFixed(2)}</span>
              </div>
            </Card>

            <Button
              type="submit"
              disabled={saving}
              variant="primary"
              className="w-full py-4 rounded-cinematic uppercase tracking-widest font-black text-sm flex items-center justify-center gap-2"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>

          </form>
        </main>
      </div>
    </ThemeProvider>
  );
}
