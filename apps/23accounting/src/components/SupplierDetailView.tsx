'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  toast, Toaster, Button, Input, Textarea, Label, Card, Badge, 
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
  PageHeader
} from '@relentify/ui';

const SC: Record<string, 'default' | 'accent' | 'success' | 'warning' | 'destructive' | 'outline' | 'zinc'> = {
  unpaid:  'warning',
  paid:    'success',
  overdue: 'destructive',
};

export default function SupplierDetailView({ supplier, bills, stats }: { supplier: any; bills: any[]; stats: any }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState({
    name: supplier.name || '',
    email: supplier.email || '',
    phone: supplier.phone || '',
    address: supplier.address || '',
    notes: supplier.notes || '',
  });

  const hasBills = bills.length > 0;

  async function handleSave() {
    setError(''); setLoading(true);
    try {
      const r = await fetch(`/api/suppliers/${supplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEditing(false);
      toast('Supplier updated', 'success');
      setTimeout(() => router.refresh(), 500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update';
      setError(msg); toast(msg, 'error');
    } finally { setLoading(false); }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      const r = await fetch(`/api/suppliers/${supplier.id}`, { method: 'DELETE' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Failed to delete'); }
      router.push('/dashboard/suppliers');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete';
      setError(msg); toast(msg, 'error'); setLoading(false); setConfirmDelete(false);
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <Toaster />

      {confirmDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[var(--theme-primary)]/60 backdrop-blur-sm">
          <Card variant="default" padding="lg" className="relative w-full max-w-md shadow-2xl space-y-6">
            <div>
              <h3 className="text-base font-black text-[var(--theme-text)] mb-2">Delete {supplier.name}?</h3>
              <p className="text-[var(--theme-text-muted)] text-sm">This cannot be undone.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={() => setConfirmDelete(false)} variant="ghost" className="flex-1 bg-[var(--theme-border)]/50 border border-[var(--theme-border)] rounded-cinematic uppercase tracking-widest text-sm font-black">Cancel</Button>
              <Button onClick={handleDelete} disabled={loading} variant="primary" className="flex-1 bg-[var(--theme-destructive)] hover:bg-[var(--theme-destructive)]/80 border-none rounded-cinematic uppercase tracking-widest text-sm font-black">
                {loading ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <PageHeader
        title={supplier.name}
        description={
          <Link href="/dashboard/suppliers" className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] text-xs font-bold no-underline">
            ← Back to Suppliers
          </Link>
        }
        actions={
          <div className="flex gap-2 sm:gap-3">
            {!editing ? (
              <>
                <Button onClick={() => setEditing(true)} variant="ghost" className="bg-[var(--theme-border)]/50 border border-[var(--theme-border)] rounded-cinematic text-xs sm:text-sm uppercase tracking-widest font-black">
                  Edit
                </Button>
                {hasBills ? (
                  <div className="relative group">
                    <Button disabled variant="outline" className="rounded-cinematic text-xs sm:text-sm uppercase tracking-widest font-black opacity-50 cursor-not-allowed">
                      Delete
                    </Button>
                    <div className="absolute bottom-full right-0 mb-2 w-56 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic px-3 py-2 text-[10px] text-[var(--theme-text-muted)] hidden group-hover:block shadow-xl z-10 uppercase font-black tracking-wider">
                      Can't delete — {bills.length} bill{bills.length !== 1 ? 's' : ''} on record.
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => setConfirmDelete(true)} disabled={loading} variant="ghost" className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] rounded-cinematic text-xs sm:text-sm uppercase tracking-widest font-black hover:bg-[var(--theme-destructive)]/20">
                    Delete
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button onClick={() => { setEditing(false); setForm({ name: supplier.name, email: supplier.email || '', phone: supplier.phone || '', address: supplier.address || '', notes: supplier.notes || '' }); }} variant="ghost" className="bg-[var(--theme-border)]/50 border border-[var(--theme-border)] rounded-cinematic text-xs sm:text-sm uppercase tracking-widest font-black">
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={loading} variant="primary" className="rounded-cinematic text-xs sm:text-sm uppercase tracking-widest font-black">
                  {loading ? 'Saving...' : 'Save'}
                </Button>
              </>
            )}
          </div>
        }
      />

      {error && <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic text-sm font-bold">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <Card variant="default" padding="md" className="flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Total Billed</p>
          <p className="text-2xl sm:text-3xl font-black text-[var(--theme-text)]">£{stats.totalBilled.toFixed(2)}</p>
        </Card>
        <Card variant="default" padding="md" className="flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Paid</p>
          <p className="text-2xl sm:text-3xl font-black text-[var(--theme-success)]">£{stats.totalPaid.toFixed(2)}</p>
        </Card>
        <Card variant="default" padding="md" className="flex flex-col items-center justify-center text-center border-[var(--theme-warning)]/20 bg-[var(--theme-warning)]/5">
          <p className="text-[10px] font-black text-[var(--theme-warning)]/70 uppercase tracking-widest mb-2">Outstanding</p>
          <p className="text-2xl sm:text-3xl font-black text-[var(--theme-warning)]">£{stats.outstanding.toFixed(2)}</p>
        </Card>
      </div>

      <Card variant="default" padding="lg" className="space-y-6">
        <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Supplier Details</h3>
        {editing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <Button onClick={handleSave} disabled={loading} variant="primary" className="w-full sm:hidden rounded-cinematic uppercase tracking-widest text-sm font-black">
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1">
              <Label>Email</Label>
              <p className="text-[var(--theme-text)] text-sm font-medium">{supplier.email || '—'}</p>
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <p className="text-[var(--theme-text)] text-sm font-medium">{supplier.phone || '—'}</p>
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Address</Label>
              <p className="text-[var(--theme-text)] whitespace-pre-wrap text-sm font-medium leading-relaxed">{supplier.address || '—'}</p>
            </div>
            {supplier.notes && (
              <div className="sm:col-span-2 space-y-1">
                <Label>Notes</Label>
                <p className="text-[var(--theme-text-muted)] whitespace-pre-wrap text-sm font-medium leading-relaxed italic">{supplier.notes}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-[var(--theme-border)] flex items-center justify-between">
          <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Bills ({bills.length})</h3>
          <Link href="/dashboard/bills/new" className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest hover:brightness-110 no-underline">+ New</Link>
        </div>
        {bills.length === 0 ? (
          <div className="p-12 sm:p-16 text-center">
            <p className="text-[var(--theme-text-muted)] font-medium mb-4">No bills yet</p>
            <Button asChild variant="primary" className="rounded-cinematic uppercase tracking-widest text-sm font-black">
              <Link href="/dashboard/bills/new">Create Bill</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Mobile invoice cards */}
            <div className="md:hidden divide-y divide-[var(--theme-border)]">
              {bills.map((b: any) => (
                <div key={b.id} onClick={() => router.push(`/dashboard/bills/${b.id}`)} className="p-4 hover:bg-[var(--theme-border)]/30 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[var(--theme-text)] font-black text-sm">{b.reference || '—'}</span>
                    <Badge variant={SC[b.status] || 'default'}>{b.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--theme-text-dim)] text-xs">{new Date(b.invoice_date).toLocaleDateString('en-GB')}</span>
                    <span className="text-[var(--theme-text)] font-bold text-sm">£{parseFloat(b.amount).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((b: any) => (
                  <TableRow key={b.id} onClick={() => router.push(`/dashboard/bills/${b.id}`)} className="cursor-pointer">
                    <TableCell className="text-[var(--theme-text)] font-black">{b.reference || '—'}</TableCell>
                    <TableCell className="text-[var(--theme-text-muted)]">{new Date(b.invoice_date).toLocaleDateString('en-GB')}</TableCell>
                    <TableCell>
                      <Badge variant={SC[b.status] || 'default'}>{b.status}</Badge>
                    </TableCell>
                    <TableCell className="text-[var(--theme-text)] font-bold text-right">£{parseFloat(b.amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Card>
    </div>
  );
}
