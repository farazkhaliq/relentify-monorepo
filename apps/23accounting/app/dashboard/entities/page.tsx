'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from '@relentify/ui';

interface Entity {
  id: string;
  name: string;
  business_structure: string | null;
  company_number: string | null;
  vat_registered: boolean;
  vat_number: string | null;
  currency: string;
  is_default: boolean;
}

const STRUCTURE_LABELS: Record<string, string> = {
  sole_trader: 'Sole Trader',
  limited_company: 'Limited Company',
  llp: 'LLP',
  partnership: 'Partnership',
};

export default function EntitiesPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState('');

  useEffect(() => {
    fetch('/api/entities')
      .then(r => r.json())
      .then(d => { if (d.entities) setEntities(d.entities); })
      .catch(() => toast('Failed to load entities', 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function activate(id: string) {
    setActivating(id);
    try {
      const r = await fetch(`/api/entities/${id}/activate`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast(`Switched to ${d.entity.name}`, 'success');
      router.refresh();
      window.location.reload();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to switch entity', 'error');
    } finally {
      setActivating('');
    }
  }

  async function deleteEntity(id: string, name: string) {
    if (!confirm(`Delete entity "${name}"? This cannot be undone.`)) return;
    try {
      const r = await fetch(`/api/entities/${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEntities(prev => prev.filter(e => e.id !== id));
      toast('Entity deleted', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to delete entity', 'error');
    }
  }

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Entities</h1>
            <p className="text-sm text-[var(--theme-text-muted)] mt-1">Manage your legal entities</p>
          </div>
          <Link href="/dashboard/entities/new" className="px-4 py-2.5 bg-[var(--theme-accent)] text-white font-black text-xs uppercase tracking-widest rounded-cinematic hover:brightness-110 no-underline transition-all">
            + New Entity
          </Link>
        </div>

        {loading ? (
          <div className="text-[var(--theme-text-muted)] text-sm">Loading...</div>
        ) : entities.length === 0 ? (
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-8 text-center">
            <p className="text-[var(--theme-text-muted)]">No entities found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entities.map(entity => (
              <div key={entity.id} className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-[var(--theme-text)]">{entity.name}</span>
                      {entity.is_default && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-accent)] bg-[var(--theme-accent)]/10 px-2 py-0.5 rounded-full">Default</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--theme-text-muted)]">
                      {entity.business_structure && <span>{STRUCTURE_LABELS[entity.business_structure] || entity.business_structure}</span>}
                      {entity.company_number && <span>Co. No: {entity.company_number}</span>}
                      {entity.vat_registered && <span>VAT: {entity.vat_number || 'Registered'}</span>}
                      <span>{entity.currency}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!entity.is_default && (
                    <button
                      onClick={() => activate(entity.id)}
                      disabled={activating === entity.id}
                      className="px-3 py-1.5 text-xs font-black text-[var(--theme-accent)] border border-[var(--theme-accent)]/20 rounded-lg hover:bg-[var(--theme-accent)]/10 transition-colors disabled:opacity-50"
                    >
                      {activating === entity.id ? 'Switching...' : 'Switch To'}
                    </button>
                  )}
                  <Link href={`/dashboard/entities/${entity.id}/edit`} className="px-3 py-1.5 text-xs font-black text-[var(--theme-text-muted)] border border-[var(--theme-border)] rounded-lg hover:bg-[var(--theme-border)]/30 transition-colors no-underline">
                    Edit
                  </Link>
                  {!entity.is_default && (
                    <button
                      onClick={() => deleteEntity(entity.id, entity.name)}
                      className="px-3 py-1.5 text-xs font-black text-[var(--theme-destructive)] border border-[var(--theme-destructive)]/20 rounded-lg hover:bg-[var(--theme-destructive)]/10 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
