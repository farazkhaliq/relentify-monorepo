'use client';
import { useEffect, useState } from 'react';

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'COGS' | 'EXPENSE' | 'SUSPENSE';

interface Account {
  id: string;
  code: number;
  name: string;
  account_type: AccountType;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  balance: string;
}

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET:     'Assets',
  LIABILITY: 'Liabilities',
  EQUITY:    'Equity',
  INCOME:    'Income',
  COGS:      'Cost of Sales',
  EXPENSE:   'Overheads & Expenses',
  SUSPENSE:  'Suspense',
};

const TYPE_ORDER: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'COGS', 'EXPENSE', 'SUSPENSE'];

const TYPE_RANGES: Record<AccountType, string> = {
  ASSET:     '1000–1999',
  LIABILITY: '2000–2999',
  EQUITY:    '3000–3999',
  INCOME:    '4000–4999',
  COGS:      '5000–6999',
  EXPENSE:   '7000–9998',
  SUSPENSE:  '9999',
};

function fmt(n: number | string) {
  const v = parseFloat(String(n));
  if (isNaN(v) || v === 0) return '—';
  return `£${Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingFor, setAddingFor] = useState<AccountType | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  function load() {
    setLoading(true);
    fetch('/api/accounts')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setAccounts(d.accounts || []);
      })
      .catch(() => setError('Failed to load accounts'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(type: AccountType) {
    setSaveError('');
    if (!newCode || !newName) { setSaveError('Code and name are required'); return; }
    setSaving(true);
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: parseInt(newCode), name: newName, accountType: type, description: newDesc }),
    });
    const d = await res.json();
    setSaving(false);
    if (d.error) { setSaveError(d.error); return; }
    setAddingFor(null);
    setNewCode(''); setNewName(''); setNewDesc('');
    load();
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Deactivate this account? It will no longer appear in dropdowns.')) return;
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (d.error) { alert(d.error); return; }
    load();
  }

  const grouped = TYPE_ORDER.reduce<Record<AccountType, Account[]>>((acc, t) => {
    acc[t] = accounts.filter(a => a.account_type === t);
    return acc;
  }, {} as Record<AccountType, Account[]>);

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--theme-text)]">Chart of Accounts</h1>
          <p className="text-sm text-[var(--theme-text-muted)] mt-1">
            Your nominal ledger. System accounts (marked ✦) cannot be deactivated.
          </p>
        </div>

        {loading && <p className="text-[var(--theme-text-muted)]">Loading…</p>}
        {error && <p className="text-[var(--theme-destructive)]">{error}</p>}

        {!loading && TYPE_ORDER.map(type => {
          const group = grouped[type];
          return (
            <div key={type} className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider">
                  {TYPE_LABELS[type]} <span className="font-normal opacity-60">({TYPE_RANGES[type]})</span>
                </h2>
                {type !== 'SUSPENSE' && (
                  <button
                    onClick={() => { setAddingFor(type); setSaveError(''); setNewCode(''); setNewName(''); setNewDesc(''); }}
                    className="text-xs text-[var(--theme-accent)] hover:text-[var(--theme-accent)]"
                  >
                    + Add account
                  </button>
                )}
              </div>

              <div className="bg-[var(--theme-card)] rounded-cinematic border border-[var(--theme-border)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--theme-border)] bg-[var(--theme-border)]/[0.05]">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--theme-text-muted)] w-20">Code</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--theme-text-muted)]">Name</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--theme-text-muted)] hidden md:table-cell">Description</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-[var(--theme-text-muted)] w-32">Balance</th>
                      <th className="px-4 py-2.5 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-[var(--theme-text-muted)] italic text-xs">No accounts</td>
                      </tr>
                    )}
                    {group.map(acct => (
                      <tr key={acct.id} className="border-b border-[var(--theme-border)] last:border-0 hover:bg-[var(--theme-border)]/20">
                        <td className="px-4 py-2.5 font-mono text-[var(--theme-text-muted)]">{acct.code}</td>
                        <td className="px-4 py-2.5 text-[var(--theme-text)] font-medium">
                          {acct.name}
                          {acct.is_system && <span className="ml-1.5 text-[10px] text-[var(--theme-warning)]" title="System account">✦</span>}
                          {!acct.is_active && <span className="ml-1.5 text-[10px] text-[var(--theme-text-muted)] italic">(inactive)</span>}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--theme-text-muted)] hidden md:table-cell text-xs">{acct.description || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[var(--theme-text-muted)] text-xs">{fmt(acct.balance)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {!acct.is_system && acct.is_active && (
                            <button
                              onClick={() => handleDeactivate(acct.id)}
                              className="text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)]"
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {addingFor === type && (
                      <tr className="bg-[var(--theme-accent)]/10 border-t border-[var(--theme-accent)]/20">
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            placeholder="Code"
                            value={newCode}
                            onChange={e => setNewCode(e.target.value)}
                            className="w-16 border border-[var(--theme-border)] rounded px-2 py-1 text-xs bg-[var(--theme-card)] text-[var(--theme-text)]"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            placeholder="Account name"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="w-full border border-[var(--theme-border)] rounded px-2 py-1 text-xs bg-[var(--theme-card)] text-[var(--theme-text)]"
                          />
                        </td>
                        <td className="px-2 py-2 hidden md:table-cell">
                          <input
                            type="text"
                            placeholder="Description (optional)"
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            className="w-full border border-[var(--theme-border)] rounded px-2 py-1 text-xs bg-[var(--theme-card)] text-[var(--theme-text)]"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          {saveError && <span className="text-[10px] text-[var(--theme-destructive)] mr-1">{saveError}</span>}
                        </td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleAdd(type)}
                            disabled={saving}
                            className="text-xs bg-[var(--theme-accent)] text-white rounded px-2 py-1 mr-1 hover:bg-[var(--theme-accent)] disabled:opacity-50"
                          >
                            {saving ? '…' : 'Save'}
                          </button>
                          <button
                            onClick={() => setAddingFor(null)}
                            className="text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
