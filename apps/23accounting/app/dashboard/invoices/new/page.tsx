'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerCombobox, Toaster, toast, DatePicker } from '@relentify/ui';
import { canAccess, Tier } from '@/src/lib/tiers';
import { usePeriodLock } from '@/src/hooks/usePeriodLock';

interface Item { description: string; quantity: number; unitPrice: number; taxRate: number; }
interface UserProfile { vat_registered: boolean; vat_number: string | null; business_name: string | null; subscription_plan: string | null; }
interface Customer { id: string; name: string; email?: string; address?: string; }
interface Project { id: string; name: string; status: string; }

const CURRENCY_MAP: Record<string, string> = { GB: 'GBP', US: 'USD', EU: 'EUR', CA: 'CAD', AU: 'AUD', NZ: 'NZD' };
const inputCls = "w-full px-4 py-3 bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-dim)] focus:ring-2 focus:ring-[var(--theme-accent)] focus:border-[var(--theme-accent)] outline-none transition-all text-sm";

export default function NewInvoicePage() {
  const router = useRouter();
  const { earliestOpenDate, isDateLocked, lockedMessage } = usePeriodLock();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  function getDefaultCurrency() {
    if (typeof window === 'undefined') return 'GBP';
    const saved = localStorage.getItem('relentify_country');
    return (saved && CURRENCY_MAP[saved]) ? CURRENCY_MAP[saved] : 'GBP';
  }

  const [f, setF] = useState({ issueDate: new Date().toISOString().split('T')[0], dueDate: '', paymentTerms: 'net_30', taxRate: 0, notes: '', currency: 'GBP' });
  const [items, setItems] = useState<Item[]>([{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '', address: '' });

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectModalLoading, setProjectModalLoading] = useState(false);
  const [projectModalError, setProjectModalError] = useState('');
  const [newProject, setNewProject] = useState({ name: '', description: '' });

  useEffect(() => {
    setF(p => ({ ...p, currency: getDefaultCurrency() }));
    async function loadData() {
      try {
        const [custRes, userRes, projRes] = await Promise.all([fetch('/api/customers'), fetch('/api/user'), fetch('/api/projects')]);
        const custData = await custRes.json();
        const userData = await userRes.json();
        const projData = await projRes.json();
        if (custData.customers) setCustomers(custData.customers);
        if (userData.user) {
          setUserProfile(userData.user);
          if (userData.user.vat_registered) setF(p => ({ ...p, taxRate: 20 }));
        }
        if (projData.projects) setProjects(projData.projects.filter((p: Project) => p.status === 'active'));
      } catch (e) { console.error('Failed to load data:', e); }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!f.issueDate || !f.paymentTerms || f.paymentTerms === 'custom') return;
    const base = new Date(f.issueDate);
    const days: Record<string, number> = { due_on_receipt: 0, net_7: 7, net_14: 14, net_30: 30, net_60: 60 };
    const d = days[f.paymentTerms];
    if (d === undefined) return;
    base.setDate(base.getDate() + d);
    setF(p => ({ ...p, dueDate: base.toISOString().split('T')[0] }));
  }, [f.issueDate, f.paymentTerms]);

  function uf(k: string, v: string | number) { setF(p => ({ ...p, [k]: v })); }
  function ui(i: number, k: keyof Item, v: string | number) { setItems(p => { const u = [...p]; u[i] = { ...u[i], [k]: v }; return u; }); }

  function handleCustomerSelect(customerId: string) {
    setSelectedCustomerId(customerId);
    const customer = customers.find(c => c.id === customerId) || null;
    setSelectedCustomer(customer);
  }

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault(); setModalError(''); setModalLoading(true);
    try {
      const r = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCust) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      const created: Customer = d.customer;
      setCustomers(prev => [...prev, created]);
      handleCustomerSelect(created.id);
      setShowModal(false);
      setNewCust({ name: '', email: '', phone: '', address: '' });
      toast('Customer created', 'success');
    } catch (e: unknown) { setModalError(e instanceof Error ? e.message : 'Failed'); }
    finally { setModalLoading(false); }
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault(); setProjectModalError(''); setProjectModalLoading(true);
    try {
      const r = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newProject.name, description: newProject.description || undefined }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setProjects(prev => [...prev, d.project]);
      setSelectedProjectId(d.project.id);
      setShowProjectModal(false);
      setNewProject({ name: '', description: '' });
      toast('Project created', 'success');
    } catch (e: unknown) { setProjectModalError(e instanceof Error ? e.message : 'Failed'); }
    finally { setProjectModalLoading(false); }
  }

  const canUseProjects = canAccess(userProfile?.subscription_plan as Tier, 'project_tracking');

  const sub = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const tax = sub * (f.taxRate / 100);
  const total = sub + tax;
  const currencySymbol: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$' };
  const sym = currencySymbol[f.currency] || '£';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!selectedCustomerId) { toast('Please select a customer', 'error'); return; }
    if (items.some(i => !i.description.trim())) { toast('Please add a description for all line items', 'error'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          clientName: selectedCustomer?.name || '',
          clientEmail: selectedCustomer?.email || '',
          clientAddress: selectedCustomer?.address || '',
          customerId: selectedCustomerId,
          projectId: selectedProjectId || undefined,
          taxRate: Number(f.taxRate),
          items: items.map(i => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), taxRate: Number(i.taxRate) })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      router.push(`/dashboard/invoices/${d.invoice.id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create invoice';
      setError(msg); toast(msg, 'error');
    } finally { setLoading(false); }
  }

  return (
    <div>
      <Toaster />

      {showProjectModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--theme-primary)]/60 backdrop-blur-sm" onClick={() => setShowProjectModal(false)} />
          <div className="relative bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-[2rem] p-6 sm:p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-black text-[var(--theme-text)]">New Project</h3>
              <button onClick={() => setShowProjectModal(false)} className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] bg-transparent border-none cursor-pointer text-xl">✕</button>
            </div>
            {projectModalError && <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic mb-4 text-sm font-bold">{projectModalError}</div>}
            <form onSubmit={createProject} className="space-y-4">
              <div><label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Name *</label><input type="text" required value={newProject.name} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} className={inputCls} /></div>
              <div><label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Description</label><textarea value={newProject.description} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} rows={2} className={inputCls} /></div>
              <button type="submit" disabled={projectModalLoading} className="w-full py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all">
                {projectModalLoading ? 'Creating...' : 'Create Project'}
              </button>
            </form>
          </div>
        </div>
      )}

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
              <button type="submit" disabled={modalLoading} className="w-full py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all">
                {modalLoading ? 'Creating...' : 'Create Customer'}
              </button>
            </form>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight mb-8">New Invoice</h2>
        {error && <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic mb-6 text-sm font-bold">{error}</div>}

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

          {/* Project (optional) */}
          <div className="bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-5 sm:p-8">
            <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Project (optional)</h3>
            {!canUseProjects ? (
              <p className="text-[10px] text-[var(--theme-warning)] font-medium">Project tracking is available on the Small Business plan and above.</p>
            ) : (
              <div className="flex gap-2">
                <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-background)] flex-1'}>
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button type="button" onClick={() => { setProjectModalError(''); setShowProjectModal(true); }} className="shrink-0 px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)] hover:border-[var(--theme-accent)] font-black rounded-cinematic text-xs uppercase tracking-widest transition-all">+ New</button>
              </div>
            )}
          </div>

          {/* Invoice Details — all fields stack to single column on mobile */}
          <div className="bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-5 sm:p-8 space-y-4">
            <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Invoice Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Invoice Date *</label>
                <DatePicker value={f.issueDate} min={earliestOpenDate || undefined} onChange={v => uf('issueDate', isDateLocked(v) ? (earliestOpenDate || v) : v)} />
                {lockedMessage(f.issueDate) && <p className="mt-1 text-xs text-[var(--theme-warning)]">{lockedMessage(f.issueDate)}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Payment Terms *</label>
                <select value={f.paymentTerms} onChange={e => uf('paymentTerms', e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-background)]'}>
                  <option value="due_on_receipt" className="bg-[var(--theme-background)]">Due on Receipt</option>
                  <option value="net_7" className="bg-[var(--theme-background)]">Net 7 Days</option>
                  <option value="net_14" className="bg-[var(--theme-background)]">Net 14 Days</option>
                  <option value="net_30" className="bg-[var(--theme-background)]">Net 30 Days</option>
                  <option value="net_60" className="bg-[var(--theme-background)]">Net 60 Days</option>
                  <option value="custom" className="bg-[var(--theme-background)]">Custom</option>
                </select>
              </div>
            </div>
            {/* These fields always stack single column on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Due Date *</label>
                <DatePicker value={f.dueDate} onChange={v => uf('dueDate', v)} disabled={f.paymentTerms !== 'custom'} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Currency</label>
                {(() => {
                  const hasMultiCurrency = canAccess(userProfile?.subscription_plan as Tier, 'multi_currency');
                  return hasMultiCurrency ? (
                    <select value={f.currency} onChange={e => uf('currency', e.target.value)} className={inputCls + ' appearance-none'}>
                      <option value="GBP" className="bg-[var(--theme-background)]">GBP (£)</option>
                      <option value="USD" className="bg-[var(--theme-background)]">USD ($)</option>
                      <option value="EUR" className="bg-[var(--theme-background)]">EUR (€)</option>
                      <option value="CAD" className="bg-[var(--theme-background)]">CAD (CA$)</option>
                      <option value="AUD" className="bg-[var(--theme-background)]">AUD (A$)</option>
                      <option value="NZD" className="bg-[var(--theme-background)]">NZD (NZ$)</option>
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
            {userProfile?.vat_registered && (
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">VAT %</label>
                <input type="number" min="0" max="100" step="0.01" value={f.taxRate} onChange={e => uf('taxRate', e.target.value)} onFocus={e => e.target.select()} className={inputCls} />
              </div>
            )}
          </div>

          {/* Line Items — description wraps, qty/price on separate row on mobile */}
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
                    <textarea
                      required
                      value={item.description}
                      onChange={e => ui(idx, 'description', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2.5 bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-lg text-[var(--theme-text)] text-sm outline-none focus:ring-2 focus:ring-[var(--theme-accent)] resize-none min-h-[60px]"
                      placeholder="Description of service or product"
                    />
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="text-[var(--theme-destructive)] hover:text-[var(--theme-destructive)] bg-transparent border-none cursor-pointer text-lg mt-6 shrink-0">✕</button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    {idx === 0 && <label className="block text-[9px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Qty</label>}
                    <input
                      type="number" min="0.01" step="0.01" required value={item.quantity}
                      onChange={e => ui(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      onFocus={e => e.target.select()}
                      className="w-full px-3 py-2.5 bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-lg text-[var(--theme-text)] text-sm outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
                    />
                  </div>
                  <div>
                    {idx === 0 && <label className="block text-[9px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Price</label>}
                    <input
                      type="number" min="0" step="0.01" required value={item.unitPrice}
                      onChange={e => ui(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                      onFocus={e => e.target.select()}
                      className="w-full px-3 py-2.5 bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-lg text-[var(--theme-text)] text-sm outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
                    />
                  </div>
                  <div>
                    {idx === 0 && <label className="block text-[9px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-1">Amount</label>}
                    <p className="px-3 py-2.5 text-sm font-black text-[var(--theme-text)]">{sym}{(item.quantity * item.unitPrice).toFixed(2)}</p>
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
            <div className="flex justify-between items-center text-[var(--theme-text)] mb-2"><span className="font-bold">Subtotal:</span><span>{sym}{sub.toFixed(2)}</span></div>
            {userProfile?.vat_registered && <div className="flex justify-between items-center text-[var(--theme-text-muted)] text-sm mb-2"><span>VAT ({f.taxRate}%):</span><span>{sym}{tax.toFixed(2)}</span></div>}
            <div className="flex justify-between items-center text-[var(--theme-text)] text-xl font-black pt-4 border-t border-[var(--theme-border)]"><span>Total:</span><span className="text-[var(--theme-accent)]">{sym}{total.toFixed(2)}</span></div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2">
            {loading ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating...</>) : 'Create Invoice'}
          </button>
        </form>
      </main>
    </div>
  );
}