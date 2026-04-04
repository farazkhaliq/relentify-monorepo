'use client';
import { useState, useEffect } from 'react';
import type { WorkspacePermissions } from '@/src/lib/team-defaults';
import { DEFAULT_PERMISSIONS } from '@/src/lib/team-defaults';

interface Member {
  id: string;
  invited_email: string;
  status: 'pending' | 'active' | 'revoked';
  permissions: WorkspacePermissions;
  member_name: string | null;
  invited_at: string;
}

const MODULE_CONFIG: { module: keyof WorkspacePermissions; label: string; actions: { key: string; label: string }[] }[] = [
  { module: 'invoices',    label: 'Invoices',       actions: [{ key: 'view', label: 'View' }, { key: 'create', label: 'Create' }, { key: 'delete', label: 'Delete' }] },
  { module: 'bills',       label: 'Bills',          actions: [{ key: 'view', label: 'View' }, { key: 'create', label: 'Create' }, { key: 'delete', label: 'Delete' }] },
  { module: 'quotes',      label: 'Quotes',         actions: [{ key: 'view', label: 'View' }, { key: 'create', label: 'Create' }] },
  { module: 'creditNotes', label: 'Credit Notes',   actions: [{ key: 'view', label: 'View' }, { key: 'create', label: 'Create' }] },
  { module: 'expenses',    label: 'Expenses',       actions: [{ key: 'view', label: 'View' }, { key: 'create', label: 'Create' }, { key: 'approve', label: 'Approve' }] },
  { module: 'mileage',     label: 'Mileage',        actions: [{ key: 'view', label: 'View' }, { key: 'create', label: 'Create' }, { key: 'approve', label: 'Approve' }] },
  { module: 'po',          label: 'Purchase Orders', actions: [{ key: 'view', label: 'View' }, { key: 'create', label: 'Create' }, { key: 'approve', label: 'Approve' }] },
  { module: 'customers',   label: 'Customers',      actions: [{ key: 'view', label: 'View' }, { key: 'manage', label: 'Manage' }] },
  { module: 'suppliers',   label: 'Suppliers',      actions: [{ key: 'view', label: 'View' }, { key: 'manage', label: 'Manage' }] },
  { module: 'banking',     label: 'Banking',        actions: [{ key: 'view', label: 'View' }, { key: 'reconcile', label: 'Reconcile' }] },
  { module: 'journals',    label: 'Journals',       actions: [{ key: 'view', label: 'View' }, { key: 'create', label: 'Create' }] },
  { module: 'coa',         label: 'Chart of Accounts', actions: [{ key: 'view', label: 'View' }, { key: 'manage', label: 'Manage' }] },
  { module: 'projects',    label: 'Projects',       actions: [{ key: 'view', label: 'View' }, { key: 'manage', label: 'Manage' }] },
  { module: 'vat',         label: 'VAT',            actions: [{ key: 'view', label: 'View' }, { key: 'submit', label: 'Submit' }] },
  { module: 'reports',     label: 'Reports',        actions: [{ key: 'view', label: 'View' }] },
  { module: 'audit',       label: 'Audit Log',      actions: [{ key: 'view', label: 'View' }] },
  { module: 'entities',    label: 'Organisations',  actions: [{ key: 'view', label: 'View' }, { key: 'manage', label: 'Manage' }] },
  { module: 'settings',    label: 'Settings',       actions: [{ key: 'view', label: 'View' }] },
];

function PermissionMatrix({
  permissions,
  onChange,
  disabled = false,
}: {
  permissions: WorkspacePermissions;
  onChange: (p: WorkspacePermissions) => void;
  disabled?: boolean;
}) {
  function toggle(module: keyof WorkspacePermissions, action: string) {
    const updated = {
      ...permissions,
      [module]: {
        ...(permissions[module] as Record<string, boolean>),
        [action]: !(permissions[module] as Record<string, boolean>)[action],
      },
    };
    onChange(updated as WorkspacePermissions);
  }
  return (
    <div className="space-y-2">
      {MODULE_CONFIG.map(({ module, label, actions }) => (
        <div key={module} className="flex items-center gap-4">
          <span className="w-24 text-xs text-[var(--theme-text-muted)] shrink-0">{label}</span>
          <div className="flex gap-3 flex-wrap">
            {actions.map(({ key, label: aLabel }) => {
              const checked = (permissions[module] as Record<string, boolean>)?.[key] ?? false;
              return (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(module, key)}
                    className="accent-[var(--theme-accent)] w-3.5 h-3.5"
                  />
                  <span className="text-xs text-[var(--theme-text)]">{aLabel}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-[var(--theme-warning)]/10 text-[var(--theme-warning)] border-[var(--theme-warning)]/20',
    active: 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border-[var(--theme-accent)]/20',
    revoked: 'bg-[var(--theme-primary)]/3 text-[var(--theme-text-muted)] border-[var(--theme-border)]',
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}

function MemberRow({ member, onRevoke, onUpdate }: { member: Member; onRevoke: () => void; onUpdate: (p: WorkspacePermissions) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [perms, setPerms] = useState<WorkspacePermissions>(member.permissions);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/team/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: perms }),
      });
      onUpdate(perms);
    } finally { setSaving(false); }
  }

  async function revoke() {
    if (!confirm(`Revoke access for ${member.invited_email}?`)) return;
    setRevoking(true);
    try {
      await fetch(`/api/team/${member.id}`, { method: 'DELETE' });
      onRevoke();
    } finally { setRevoking(false); }
  }

  return (
    <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--theme-accent)]/20 flex items-center justify-center text-[var(--theme-accent)] text-sm font-bold">
            {member.invited_email[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm text-[var(--theme-text)] font-medium">{member.invited_email}</p>
            {member.member_name && <p className="text-xs text-[var(--theme-text-muted)]">{member.member_name}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={member.status} />
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors"
          >
            {expanded ? 'Hide' : 'Permissions'}
          </button>
          <button
            onClick={revoke}
            disabled={revoking}
            className="text-xs text-[var(--theme-destructive)] hover:text-[var(--theme-destructive)] transition-colors disabled:opacity-50"
          >
            {revoking ? '...' : 'Revoke'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="pt-3 border-t border-[var(--theme-border)] space-y-3">
          <PermissionMatrix permissions={perms} onChange={setPerms} />
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 bg-[var(--theme-accent)] hover:bg-[var(--theme-accent)] text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save permissions'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function TeamPage() {
  const [tier, setTier] = useState<string>('invoicing');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [invitePerms, setInvitePerms] = useState<WorkspacePermissions>(DEFAULT_PERMISSIONS);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
    ]).then(([me, team]) => {
      if (me?.user?.tier) setTier(me.user.tier);
      if (team?.members) setMembers(team.members);
    }).finally(() => setLoading(false));
  }, []);

  const hasAccess = ['small_business', 'medium_business', 'corporate'].includes(tier);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    setInviting(true);
    try {
      const r = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, permissions: invitePerms }),
      });
      const data = await r.json();
      if (!r.ok) { setInviteError(data.error || 'Failed to send invitation'); return; }
      setMembers(m => [data.member, ...m.filter(x => x.invited_email !== data.member.invited_email)]);
      setEmail('');
      setInviteSuccess(`Invitation sent to ${data.member.invited_email}`);
    } finally { setInviting(false); }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="h-8 w-48 bg-[var(--theme-primary)]/3 rounded animate-pulse mb-6" />
        <div className="h-40 bg-[var(--theme-primary)]/3 rounded-cinematic animate-pulse" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-black text-[var(--theme-text)] mb-2">Team Members</h1>
        <p className="text-[var(--theme-text-muted)] mb-8">Invite staff to access your workspace with granular permissions.</p>
        <div className="bg-[var(--theme-warning)]/10 border border-[var(--theme-warning)]/20 rounded-cinematic p-6 text-center">
          <p className="text-[var(--theme-warning)] font-bold mb-2">Small Business plan required</p>
          <p className="text-[var(--theme-text-muted)] text-sm mb-4">Upgrade to invite team members and control their permissions.</p>
          <a href="/dashboard/upgrade" className="inline-block px-5 py-2.5 bg-[var(--theme-accent)] hover:bg-[var(--theme-accent)] text-white text-sm font-bold rounded-lg transition-colors no-underline">
            View plans
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-black text-[var(--theme-text)] mb-1">Team Members</h1>
        <p className="text-[var(--theme-text-muted)] text-sm">Invite staff by email. They log in with their own account and see your workspace with the permissions you set.</p>
      </div>

      {/* Invite form */}
      <div className="bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic p-6 space-y-5">
        <h2 className="text-sm font-black uppercase tracking-widest text-[var(--theme-text)]">Invite someone</h2>
        <form onSubmit={invite} className="space-y-5">
          <div>
            <label className="block text-xs text-[var(--theme-text-muted)] mb-1.5">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              required
              className="w-full bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-text-dim)] focus:outline-none focus:border-[var(--theme-accent)]/50"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--theme-text-muted)] mb-2">Permissions</label>
            <PermissionMatrix permissions={invitePerms} onChange={setInvitePerms} />
          </div>
          {inviteError && <p className="text-xs text-[var(--theme-destructive)]">{inviteError}</p>}
          {inviteSuccess && <p className="text-xs text-[var(--theme-accent)]">{inviteSuccess}</p>}
          <button
            type="submit"
            disabled={inviting}
            className="px-5 py-2.5 bg-[var(--theme-accent)] hover:bg-[var(--theme-accent)] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            {inviting ? 'Sending…' : 'Send invitation'}
          </button>
        </form>
      </div>

      {/* Members list */}
      {members.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-[var(--theme-text)]">Team ({members.length})</h2>
          {members.map(m => (
            <MemberRow
              key={m.id}
              member={m}
              onRevoke={() => setMembers(prev => prev.filter(x => x.id !== m.id))}
              onUpdate={p => setMembers(prev => prev.map(x => x.id === m.id ? { ...x, permissions: p } : x))}
            />
          ))}
        </div>
      )}

      {members.length === 0 && (
        <p className="text-[var(--theme-text-muted)] text-sm text-center py-6">No team members yet. Invite someone above.</p>
      )}
    </div>
  );
}
