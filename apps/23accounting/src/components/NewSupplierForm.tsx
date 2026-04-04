'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Input, Textarea, Label, Button } from '@relentify/ui';

export default function NewSupplierForm() {
  const [f, setF] = useState({ name: '', email: '', phone: '', address: '', notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function u(k: string, v: string) { setF(p => ({ ...p, [k]: v })); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      router.push('/dashboard/suppliers');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card variant="default" padding="lg">
      {error && (
        <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic mb-6 text-sm font-bold">
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label>Supplier Name *</Label>
          <Input 
            type="text" 
            required 
            value={f.name} 
            onChange={e => u('name', e.target.value)} 
            placeholder="e.g. BT Group, Amazon" 
          />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input 
            type="email" 
            value={f.email} 
            onChange={e => u('email', e.target.value)} 
            placeholder="accounts@supplier.com" 
          />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input 
            type="tel" 
            value={f.phone} 
            onChange={e => u('phone', e.target.value)} 
            placeholder="07123 456789" 
          />
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Textarea 
            value={f.address} 
            onChange={e => u('address', e.target.value)} 
            rows={3} 
            placeholder="Street, City, Postcode" 
          />
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea 
            value={f.notes} 
            onChange={e => u('notes', e.target.value)} 
            rows={2} 
            placeholder="Additional notes" 
          />
        </div>
        <div className="flex gap-4 pt-2">
          <Button 
            type="submit" 
            disabled={loading} 
            variant="primary" 
            className="flex-1 rounded-cinematic uppercase tracking-widest text-sm font-black"
          >
            {loading ? 'Creating...' : 'Create Supplier'}
          </Button>
          <Button 
            type="button" 
            onClick={() => router.push('/dashboard/suppliers')} 
            variant="ghost"
            className="px-6 rounded-cinematic uppercase tracking-widest text-sm font-black"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
