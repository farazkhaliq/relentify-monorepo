'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ApiKeyScope } from '@/src/lib/api-key.service';

const SCOPE_GROUPS: Record<string, ApiKeyScope[]> = {
  Invoices: ['invoices:read', 'invoices:write'],
  Customers: ['customers:read', 'customers:write'],
  Suppliers: ['suppliers:read', 'suppliers:write'],
  Bills: ['bills:read', 'bills:write'],
  Expenses: ['expenses:read'],
  Reports: ['reports:read'],
  Webhooks: ['webhooks:manage'],
};

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  is_test_mode: boolean;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<Set<string>>(new Set());
  const [newKeyTestMode, setNewKeyTestMode] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/keys');
      if (!res.ok) throw new Error('Failed to fetch keys');
      const data = await res.json();
      setKeys(data.keys.filter((k: ApiKeyRow) => !k.revoked_at));
    } catch {
      setError('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const toggleScope = (scope: string) => {
    setNewKeyScopes(prev => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) { setError('Name is required'); return; }
    if (newKeyScopes.size === 0) { setError('Select at least one scope'); return; }
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim(), scopes: [...newKeyScopes], isTestMode: newKeyTestMode }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create key');
      }
      const data = await res.json();
      setRawKey(data.key);
      setNewKeyName('');
      setNewKeyScopes(new Set());
      setNewKeyTestMode(false);
      fetchKeys();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/v1/keys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke key');
      fetchKeys();
    } catch {
      setError('Failed to revoke key');
    }
  };

  const handleRotate = async (id: string) => {
    if (!confirm('Rotate this key? The old key will remain valid for 1 hour.')) return;
    try {
      const res = await fetch(`/api/v1/keys/${id}`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to rotate key');
      const data = await res.json();
      setRawKey(data.key);
      fetchKeys();
    } catch {
      setError('Failed to rotate key');
    }
  };

  const copyKey = () => {
    if (rawKey) {
      navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return <p className="text-sm text-[var(--theme-text-muted)]">Loading API keys...</p>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-[var(--theme-destructive)] bg-[var(--theme-destructive)]/10 px-4 py-3 text-sm text-[var(--theme-destructive)]">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Raw key display (shown once) */}
      {rawKey && (
        <div className="rounded-lg border border-[var(--theme-accent)] bg-[var(--theme-card)] p-4 space-y-2">
          <p className="text-sm font-bold text-[var(--theme-text)]">
            Your API key (shown once — copy it now):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-[var(--theme-background)] px-3 py-2 text-xs font-mono text-[var(--theme-text)] border border-[var(--theme-border)] break-all">
              {rawKey}
            </code>
            <button
              onClick={copyKey}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold bg-[var(--theme-accent)] text-white hover:opacity-90 transition-opacity"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => { setRawKey(null); setCopied(false); }}
            className="text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--theme-text)]">API Keys</h3>
          <p className="text-sm text-[var(--theme-text-muted)]">Manage API keys for external integrations</p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setRawKey(null); }}
          className="rounded-lg px-4 py-2 text-sm font-bold bg-[var(--theme-accent)] text-white hover:opacity-90 transition-opacity"
        >
          {showCreate ? 'Cancel' : 'Create API Key'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-[var(--theme-text)] mb-1">Key Name</label>
            <input
              type="text"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="e.g. Production Integration"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--theme-text)] mb-2">Scopes</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Object.entries(SCOPE_GROUPS).map(([group, scopes]) => (
                <div key={group} className="space-y-1">
                  <p className="text-xs font-bold text-[var(--theme-text-muted)] uppercase tracking-wider">{group}</p>
                  {scopes.map(scope => (
                    <label key={scope} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.has(scope)}
                        onChange={() => toggleScope(scope)}
                        className="rounded border-[var(--theme-border)] accent-[var(--theme-accent)]"
                      />
                      <span className="text-sm text-[var(--theme-text)]">{scope}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newKeyTestMode}
                onChange={e => setNewKeyTestMode(e.target.checked)}
                className="rounded border-[var(--theme-border)] accent-[var(--theme-accent)]"
              />
              <span className="text-sm text-[var(--theme-text)]">Test mode</span>
              <span className="text-xs text-[var(--theme-text-muted)]">(validates requests but skips DB writes)</span>
            </label>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="rounded-lg px-4 py-2 text-sm font-bold bg-[var(--theme-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Key'}
          </button>
        </div>
      )}

      {/* Keys table */}
      {keys.length === 0 ? (
        <p className="text-sm text-[var(--theme-text-muted)] py-8 text-center">No API keys yet. Create one to get started.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--theme-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--theme-border)] bg-[var(--theme-card)]">
                <th className="text-left px-4 py-3 font-bold text-[var(--theme-text-muted)]">Name</th>
                <th className="text-left px-4 py-3 font-bold text-[var(--theme-text-muted)]">Prefix</th>
                <th className="text-left px-4 py-3 font-bold text-[var(--theme-text-muted)]">Mode</th>
                <th className="text-left px-4 py-3 font-bold text-[var(--theme-text-muted)]">Scopes</th>
                <th className="text-left px-4 py-3 font-bold text-[var(--theme-text-muted)]">Last Used</th>
                <th className="text-left px-4 py-3 font-bold text-[var(--theme-text-muted)]">Created</th>
                <th className="text-right px-4 py-3 font-bold text-[var(--theme-text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(key => (
                <tr key={key.id} className="border-b border-[var(--theme-border)] last:border-b-0">
                  <td className="px-4 py-3 font-medium text-[var(--theme-text)]">{key.name}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-[var(--theme-text-muted)]">rly_{key.key_prefix}...</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                      key.is_test_mode
                        ? 'bg-[var(--theme-warning)]/20 text-[var(--theme-warning)]'
                        : 'bg-[var(--theme-success)]/20 text-[var(--theme-success)]'
                    }`}>
                      {key.is_test_mode ? 'Test' : 'Live'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[var(--theme-text-muted)]">{key.scopes.length} scope{key.scopes.length !== 1 ? 's' : ''}</span>
                  </td>
                  <td className="px-4 py-3 text-[var(--theme-text-muted)]">{formatDate(key.last_used_at)}</td>
                  <td className="px-4 py-3 text-[var(--theme-text-muted)]">{formatDate(key.created_at)}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleRotate(key.id)}
                      className="text-xs font-bold text-[var(--theme-accent)] hover:underline"
                    >
                      Rotate
                    </button>
                    <button
                      onClick={() => handleRevoke(key.id)}
                      className="text-xs font-bold text-[var(--theme-destructive)] hover:underline"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
