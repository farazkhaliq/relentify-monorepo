'use client';

import { useState, useEffect, useCallback } from 'react';

const WEBHOOK_EVENTS = [
  'invoice.created', 'invoice.sent', 'invoice.paid', 'invoice.voided',
  'bill.created', 'bill.paid',
  'customer.created', 'supplier.created',
  'expense.approved',
  'payment.received',
] as const;

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export function WebhooksPanel() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<Set<string>>(new Set());
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const fetchEndpoints = useCallback(async () => {
    try {
      const res = await fetch('/api/webhooks-ui');
      if (!res.ok) throw new Error('Failed to fetch webhooks');
      const data = await res.json();
      setEndpoints(data.endpoints);
    } catch {
      setError('Failed to load webhook endpoints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEndpoints(); }, [fetchEndpoints]);

  const toggleEvent = (event: string) => {
    setNewEvents(prev => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!newUrl.trim()) { setError('URL is required'); return; }
    if (newEvents.size === 0) { setError('Select at least one event'); return; }
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/webhooks-ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim(), events: [...newEvents] }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create webhook');
      }
      const data = await res.json();
      setSecret(data.secret);
      setNewUrl('');
      setNewEvents(new Set());
      fetchEndpoints();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    try {
      const res = await fetch(`/api/webhooks-ui/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete endpoint');
      fetchEndpoints();
    } catch {
      setError('Failed to delete endpoint');
    }
  };

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return <p className="text-sm text-[var(--theme-text-muted)]">Loading webhooks...</p>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-[var(--theme-destructive)] bg-[var(--theme-destructive)]/10 px-4 py-3 text-sm text-[var(--theme-destructive)]">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">x</button>
        </div>
      )}

      {/* Signing secret display (shown once) */}
      {secret && (
        <div className="rounded-lg border border-[var(--theme-accent)] bg-[var(--theme-card)] p-4 space-y-2">
          <p className="text-sm font-bold text-[var(--theme-text)]">
            Signing secret (shown once — copy it now):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-[var(--theme-background)] px-3 py-2 text-xs font-mono text-[var(--theme-text)] border border-[var(--theme-border)] break-all">
              {secret}
            </code>
            <button
              onClick={copySecret}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold bg-[var(--theme-accent)] text-white hover:opacity-90 transition-opacity"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => { setSecret(null); setCopied(false); }}
            className="text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--theme-text)]">Webhooks</h3>
          <p className="text-sm text-[var(--theme-text-muted)]">Receive real-time notifications when events occur</p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setSecret(null); }}
          className="rounded-lg px-4 py-2 text-sm font-bold bg-[var(--theme-accent)] text-white hover:opacity-90 transition-opacity"
        >
          {showCreate ? 'Cancel' : 'Add Webhook'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-[var(--theme-text)] mb-1">Endpoint URL</label>
            <input
              type="url"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="https://example.com/webhooks"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--theme-text)] mb-2">Events</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WEBHOOK_EVENTS.map(event => (
                <label key={event} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEvents.has(event)}
                    onChange={() => toggleEvent(event)}
                    className="rounded border-[var(--theme-border)] accent-[var(--theme-accent)]"
                  />
                  <span className="text-sm text-[var(--theme-text)]">{event}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="rounded-lg px-4 py-2 text-sm font-bold bg-[var(--theme-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Webhook'}
          </button>
        </div>
      )}

      {/* Endpoints list */}
      {endpoints.length === 0 ? (
        <p className="text-sm text-[var(--theme-text-muted)] py-8 text-center">No webhook endpoints yet. Add one to start receiving events.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--theme-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--theme-border)] bg-[var(--theme-card)]">
                <th className="text-left px-4 py-3 font-bold text-[var(--theme-text-muted)]">URL</th>
                <th className="text-left px-4 py-3 font-bold text-[var(--theme-text-muted)]">Events</th>
                <th className="text-left px-4 py-3 font-bold text-[var(--theme-text-muted)]">Status</th>
                <th className="text-left px-4 py-3 font-bold text-[var(--theme-text-muted)]">Created</th>
                <th className="text-right px-4 py-3 font-bold text-[var(--theme-text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map(ep => (
                <tr key={ep.id} className="border-b border-[var(--theme-border)] last:border-b-0">
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-[var(--theme-text)] break-all">{ep.url}</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[var(--theme-text-muted)]">{ep.events.length} event{ep.events.length !== 1 ? 's' : ''}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                      ep.is_active
                        ? 'bg-[var(--theme-success)]/20 text-[var(--theme-success)]'
                        : 'bg-[var(--theme-destructive)]/20 text-[var(--theme-destructive)]'
                    }`}>
                      {ep.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--theme-text-muted)]">{formatDate(ep.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(ep.id)}
                      className="text-xs font-bold text-[var(--theme-destructive)] hover:underline"
                    >
                      Delete
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
