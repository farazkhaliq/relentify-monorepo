'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  TabsNav as Tabs, Card, Input, NativeSelect as Select, Checkbox, Button, Label, Badge,
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell, DatePicker
} from '@relentify/ui';
import { canAccess } from '@/src/lib/tiers';

export default function SettingsForm({ user }: { user: any }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('business');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [business, setBusiness] = useState({
    fullName: user.full_name || '',
    businessName: user.business_name || '',
    businessStructure: user.business_structure || 'sole_trader',
    companyNumber: user.company_number || '',
    vatRegistered: user.vat_registered || false,
    vatNumber: user.vat_number || '',
    acceptCardPayments: user.accept_card_payments !== false,
    paymentRemindersEnabled: user.payment_reminders_enabled || false,
    registeredAddress: user.registered_address || '',
    bankAccountName: user.bank_account_name || '',
    sortCode: user.sort_code || '',
    accountNumber: user.account_number || '',
  });

  const [account, setAccount] = useState({
    email: user.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [deleteMode, setDeleteMode] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [accountantEmail, setAccountantEmail] = useState('');
  const [accountantInvite, setAccountantInvite] = useState<{ accountant_email: string; status: string } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Period lock state
  const [lockData, setLockData] = useState<{ lockedThrough: string | null; history: any[] } | null>(null);
  const [lockOverrides, setLockOverrides] = useState<any[]>([]);
  const [lockLoading, setLockLoading] = useState(false);
  const [lockSaved, setLockSaved] = useState('');
  const [lockError, setLockError] = useState('');
  const [manualLockDate, setManualLockDate] = useState('');
  const [overrideUserId, setOverrideUserId] = useState('');
  const [overrideUntil, setOverrideUntil] = useState('');
  const [lockMembers, setLockMembers] = useState<{ id: string; name: string; email: string }[]>([]);

  // Year-end close state
  const [lastFyEndDate, setLastFyEndDate] = useState<string | null>(user.last_fy_end_date ?? null);
  const [yeDate, setYeDate] = useState<string>(() => {
    if (user.last_fy_end_date) {
      const d = new Date(user.last_fy_end_date);
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().split('T')[0];
    }
    return '';
  });
  const [yePreview, setYePreview] = useState<any>(null);
  const [yePreviewLoading, setYePreviewLoading] = useState(false);
  const [yeConfirmOpen, setYeConfirmOpen] = useState(false);
  const [yeLoading, setYeLoading] = useState(false);
  const [yeSuccess, setYeSuccess] = useState('');
  const [yeError, setYeError] = useState('');

  // PO settings state
  const [poSettings, setPOSettings] = useState({
    enabled: false,
    approverUserId: '',
    approvalThreshold: '500',
    varianceTolerancePct: '5',
  });
  const [poMembers, setPOMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [poLoading, setPOLoading] = useState(false);
  const [poSaved, setPOSaved] = useState(false);

  // PO approver mappings state
  const [poMappings, setPOMappings] = useState<{ staff_user_id: string; approver_user_id: string; staff_name: string; approver_name: string }[]>([]);
  const [newMappingStaff, setNewMappingStaff] = useState('');
  const [newMappingApprover, setNewMappingApprover] = useState('');
  const [mappingLoading, setMappingLoading] = useState(false);

  // Expense approval settings state
  const [expApproval, setExpApproval] = useState({ enabled: false, approverUserId: '' });
  const [expApprovalMembers, setExpApprovalMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [expApprovalLoading, setExpApprovalLoading] = useState(false);
  const [expApprovalSaved, setExpApprovalSaved] = useState(false);

  function loadLockData() {
    fetch('/api/period-locks').then(r => r.json()).then(d => {
      if (d.lockedThrough !== undefined) setLockData({ lockedThrough: d.lockedThrough, history: d.history || [] });
    }).catch(() => {});
    fetch('/api/period-locks/overrides').then(r => r.json()).then(d => {
      if (d.overrides) setLockOverrides(d.overrides);
    }).catch(() => {});
    Promise.all([
      fetch('/api/user').then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
    ]).then(([userData, teamData]) => {
      const members: { id: string; name: string; email: string }[] = [];
      if (userData.user) members.push({ id: userData.user.id, name: userData.user.name || userData.user.full_name || 'You', email: userData.user.email });
      if (teamData.members) {
        for (const m of teamData.members) {
          if (m.member_user_id && m.status === 'accepted') {
            members.push({ id: m.member_user_id, name: m.member_name || m.member_email, email: m.member_email });
          }
        }
      }
      setLockMembers(members);
    }).catch(() => {});
  }

  async function loadYePreview() {
    if (!yeDate) return;
    setYePreviewLoading(true);
    setYeError('');
    const res = await fetch(`/api/year-end/preview?yearEndDate=${yeDate}`);
    const data = await res.json();
    if (!res.ok) { setYeError(data.error || 'Preview failed'); setYePreviewLoading(false); return; }
    setYePreview(data);
    setYeConfirmOpen(true);
    setYePreviewLoading(false);
  }

  async function confirmYearEndClose() {
    setYeLoading(true);
    setYeError('');
    const res = await fetch('/api/year-end/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yearEndDate: yeDate }),
    });
    const data = await res.json();
    if (!res.ok) { setYeError(data.error || 'Year-end close failed'); setYeLoading(false); return; }
    setYeSuccess(`Year-end closed. Journal entry posted. Period locked through ${data.lockedThroughDate}.`);
    setLastFyEndDate(yeDate);
    setYeConfirmOpen(false);
    setYeLoading(false);
    loadLockData();
  }

  useEffect(() => {
    if (activeTab === 'accountant') {
      fetch('/api/settings/accountant').then(r => r.json()).then(d => setAccountantInvite(d.accountant)).catch(() => {});
    }
    if (activeTab === 'locks') {
      loadLockData();
    }
    if (activeTab === 'po' && canAccess(user?.tier, 'po_approvals')) {
      fetch('/api/po/settings').then(r => r.json()).then(d => {
        if (d.settings) {
          setPOSettings({
            enabled: d.settings.enabled,
            approverUserId: d.settings.approver_user_id || '',
            approvalThreshold: d.settings.approval_threshold || '500',
            varianceTolerancePct: d.settings.variance_tolerance_pct || '5',
          });
        }
      }).catch(() => {});
      // Load owner + team members for approver dropdown
      Promise.all([
        fetch('/api/user').then(r => r.json()),
        fetch('/api/team').then(r => r.json()),
      ]).then(([userData, teamData]) => {
        const members: { id: string; name: string; email: string }[] = [];
        if (userData.user) members.push({ id: userData.user.id, name: userData.user.name || userData.user.full_name || 'You', email: userData.user.email });
        if (teamData.members) {
          for (const m of teamData.members) {
            if (m.member_user_id && m.status === 'accepted') {
              members.push({ id: m.member_user_id, name: m.member_name || m.member_email, email: m.member_email });
            }
          }
        }
        setPOMembers(members);
      }).catch(() => {});
      // Load per-staff approver mappings
      fetch('/api/po/approver-mappings').then(r => r.json()).then(d => {
        if (Array.isArray(d.mappings)) setPOMappings(d.mappings);
      }).catch(() => {});
    }
    if (activeTab === 'expenses_approval') {
      fetch('/api/expense-approval-settings').then(r => r.json()).then(d => {
        if (d.settings) setExpApproval({ enabled: d.settings.enabled, approverUserId: d.settings.approver_user_id || '' });
      }).catch(() => {});
      Promise.all([
        fetch('/api/user').then(r => r.json()),
        fetch('/api/team').then(r => r.json()),
      ]).then(([userData, teamData]) => {
        const members: { id: string; name: string; email: string }[] = [];
        if (userData.user) members.push({ id: userData.user.id, name: userData.user.name || userData.user.full_name || 'You', email: userData.user.email });
        if (teamData.members) {
          for (const m of teamData.members) {
            if (m.member_user_id && m.status === 'accepted') {
              members.push({ id: m.member_user_id, name: m.member_name || m.member_email, email: m.member_email });
            }
          }
        }
        setExpApprovalMembers(members);
      }).catch(() => {});
    }
  }, [activeTab, user?.tier]);

  async function handleBusinessSave() {
    setError(''); setSuccess(''); setLoading(true);
    try {
      const r = await fetch('/api/user/update', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...business, acceptCardPayments: business.acceptCardPayments }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSuccess('Business details updated successfully');
      setTimeout(() => router.refresh(), 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordChange() {
    setError(''); setSuccess(''); setLoading(true);
    if (account.newPassword !== account.confirmPassword) { setError('New passwords do not match'); setLoading(false); return; }
    if (account.newPassword.length < 8) { setError('Password must be at least 8 characters'); setLoading(false); return; }
    try {
      const r = await fetch('/api/user/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: account.currentPassword, newPassword: account.newPassword }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSuccess('Password changed successfully');
      setAccount({ ...account, currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  const tabOptions = [
    { label: 'Business Details', value: 'business' },
    { label: 'Account Settings', value: 'account' },
    { label: 'Payment Provider', value: 'stripe' },
    { label: 'Accountant', value: 'accountant' },
    ...(canAccess(user?.tier, 'po_approvals') ? [{ label: 'Purchase Orders', value: 'po' }] : []),
    { label: 'Expense Approvals', value: 'expenses_approval' },
    { label: 'Period Locks', value: 'locks' }
  ];

  return (
    <div className="space-y-6">
      {error && <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic text-sm font-bold">{error}</div>}
      {success && <div className="bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/20 text-[var(--theme-accent)] px-4 py-3 rounded-cinematic text-sm font-bold">{success}</div>}

      <Tabs 
        options={tabOptions} 
        selectedValue={activeTab} 
        onValueChange={setActiveTab} 
        variant="cinematic" 
        className="w-full justify-start overflow-x-auto"
      />

      {activeTab === 'business' && (
        <Card variant="default" padding="lg" className="space-y-6">
          <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Business Information</h3>
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input type="text" required value={business.fullName} onChange={e => setBusiness({...business, fullName: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input type="text" value={business.businessName} onChange={e => setBusiness({...business, businessName: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Business Structure *</Label>
            <Select value={business.businessStructure} onChange={e => setBusiness({...business, businessStructure: e.target.value})}>
              <option value="sole_trader">Sole Trader</option>
              <option value="company">Limited Company</option>
            </Select>
          </div>
          {business.businessStructure === 'company' && (
            <div className="space-y-2">
              <Label>Company Number *</Label>
              <Input type="text" required value={business.companyNumber} onChange={e => setBusiness({...business, companyNumber: e.target.value})} placeholder="e.g., 12345678" />
              <p className="text-xs text-[var(--theme-text-dim)] mt-1">Required for KYC compliance</p>
            </div>
          )}
          <div className="flex items-center gap-4 py-4">
            <Checkbox id="vat-registered" checked={business.vatRegistered} onCheckedChange={v => setBusiness({...business, vatRegistered: !!v})} />
            <Label htmlFor="vat-registered" className="text-sm font-medium cursor-pointer normal-case tracking-normal">VAT Registered</Label>
          </div>
          {business.vatRegistered && (
            <div className="space-y-2">
              <Label>VAT Number *</Label>
              <Input type="text" required value={business.vatNumber} onChange={e => setBusiness({...business, vatNumber: e.target.value})} placeholder="GB123456789" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Registered Address</Label>
            <textarea
              value={business.registeredAddress}
              onChange={e => setBusiness({...business, registeredAddress: e.target.value})}
              placeholder="e.g. 123 High Street, London, EC1A 1BB"
              rows={3}
              className="w-full rounded-cinematic border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] text-sm px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/40"
            />
            <p className="text-xs text-[var(--theme-text-dim)]">Appears on invoices and remittance advices.</p>
          </div>
          <div className="pt-2 border-t border-[var(--theme-border)]">
            <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4 mt-4">Bank Details for Remittances</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input type="text" value={business.bankAccountName} onChange={e => setBusiness({...business, bankAccountName: e.target.value})} placeholder="e.g. Acme Ltd" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sort Code</Label>
                  <Input type="text" value={business.sortCode} onChange={e => setBusiness({...business, sortCode: e.target.value})} placeholder="00-00-00" maxLength={8} />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input type="text" value={business.accountNumber} onChange={e => setBusiness({...business, accountNumber: e.target.value})} placeholder="00000000" maxLength={10} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 py-4 border-t border-[var(--theme-border)]">
            <Checkbox id="accept-card-payments" checked={business.acceptCardPayments} onCheckedChange={v => setBusiness({...business, acceptCardPayments: !!v})} />
            <div>
              <Label htmlFor="accept-card-payments" className="text-sm font-medium cursor-pointer normal-case tracking-normal">Accept card payments on invoices</Label>
              <p className="text-xs text-[var(--theme-text-dim)] mt-0.5">When disabled, invoices are sent without a payment link.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 py-4 border-t border-[var(--theme-border)]">
            <Checkbox id="payment-reminders" checked={business.paymentRemindersEnabled} onCheckedChange={v => setBusiness({...business, paymentRemindersEnabled: !!v})} />
            <div>
              <Label htmlFor="payment-reminders" className="text-sm font-medium cursor-pointer normal-case tracking-normal">Automatic payment reminders</Label>
              <p className="text-xs text-[var(--theme-text-dim)] mt-0.5">Send reminders 3 days before, on, and 7 days after due date.</p>
            </div>
          </div>
          <Button onClick={handleBusinessSave} disabled={loading} variant="primary" className="w-full rounded-cinematic uppercase tracking-widest text-sm font-black">
            {loading ? 'Saving...' : 'Save Business Details'}
          </Button>
        </Card>
      )}

      {activeTab === 'account' && (
        <div className="space-y-6">
          <Card variant="default" padding="lg" className="space-y-6">
            <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Email Address</h3>
            <div className="space-y-2">
              <Label>Current Email</Label>
              <Input type="email" value={account.email} disabled className="opacity-60 cursor-not-allowed" />
              <p className="text-xs text-[var(--theme-text-dim)] mt-2">Contact support to change your email address</p>
            </div>
          </Card>
          <Card variant="default" padding="lg" className="space-y-6">
            <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Change Password</h3>
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input type="password" value={account.currentPassword} onChange={e => setAccount({...account, currentPassword: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={account.newPassword} onChange={e => setAccount({...account, newPassword: e.target.value})} placeholder="Min 8 characters" />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input type="password" value={account.confirmPassword} onChange={e => setAccount({...account, confirmPassword: e.target.value})} />
            </div>
            <Button onClick={handlePasswordChange} disabled={loading || !account.currentPassword || !account.newPassword} variant="primary" className="w-full rounded-cinematic uppercase tracking-widest text-sm font-black">
              {loading ? 'Changing...' : 'Change Password'}
            </Button>
          </Card>

          <Card variant="default" padding="lg" className="space-y-4">
            <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Your Data</h3>
            <p className="text-sm text-[var(--theme-text-muted)]">Download a CSV of all your account and financial data.</p>
            <Button
              variant="outline"
              className="rounded-cinematic uppercase tracking-widest text-sm font-black"
              onClick={() => { window.location.href = '/api/account/export'; }}
            >
              Download CSV Export
            </Button>
          </Card>

          <Card variant="default" padding="lg" className="space-y-4 border-[var(--theme-destructive)]/20">
            <h3 className="text-[10px] font-black text-[var(--theme-destructive)] uppercase tracking-widest">Delete Account</h3>
            <p className="text-sm text-[var(--theme-text-muted)]">Permanently delete your account and all data. This cannot be undone.</p>
            {!deleteMode ? (
              <Button
                variant="outline"
                className="rounded-cinematic uppercase tracking-widest text-sm font-black border-[var(--theme-destructive)]/30 text-[var(--theme-destructive)] hover:bg-[var(--theme-destructive)]/5"
                onClick={() => setDeleteMode(true)}
              >
                Delete My Account
              </Button>
            ) : (
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="Enter your password to confirm"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                />
                {deleteError && <p className="text-sm text-[var(--theme-destructive)]">{deleteError}</p>}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="rounded-cinematic uppercase tracking-widest text-sm font-black border-[var(--theme-destructive)]/30 text-[var(--theme-destructive)] hover:bg-[var(--theme-destructive)]/10"
                    disabled={!deletePassword || deleteLoading}
                    onClick={async () => {
                      setDeleteLoading(true);
                      setDeleteError('');
                      const res = await fetch('/api/account/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password: deletePassword }),
                      });
                      if (res.ok) {
                        window.location.href = '/login';
                      } else {
                        const d = await res.json();
                        setDeleteError(d.error || 'Something went wrong');
                        setDeleteLoading(false);
                      }
                    }}
                  >
                    {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
                  </Button>
                  <Button variant="outline" className="rounded-cinematic uppercase tracking-widest text-sm font-black" onClick={() => { setDeleteMode(false); setDeletePassword(''); setDeleteError(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'accountant' && (
        <Card variant="default" padding="lg" className="space-y-6">
          <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Accountant Access</h3>
          <p className="text-[var(--theme-text-muted)] text-sm">Invite your accountant to view your financial data in read-only mode. They will receive an email with an accept link.</p>

          {accountantInvite && (
            <div className={`p-4 rounded-cinematic border flex items-center justify-between gap-4 ${accountantInvite.status === 'accepted' ? 'bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/20' : 'bg-[var(--theme-primary)]/3 border-[var(--theme-border)]'}`}>
              <div>
                <p className="text-sm font-black text-[var(--theme-text)]">{accountantInvite.accountant_email}</p>
                <Badge variant={accountantInvite.status === 'accepted' ? 'success' : 'default'} className="mt-1">{accountantInvite.status}</Badge>
              </div>
              <Button
                onClick={async () => {
                  if (!confirm('Revoke accountant access?')) return;
                  await fetch('/api/settings/accountant', { method: 'DELETE' });
                  setAccountantInvite(null);
                  setSuccess('Accountant access revoked');
                }}
                variant="ghost"
                className="text-[var(--theme-destructive)] hover:text-[var(--theme-destructive)] uppercase tracking-widest text-[10px] font-black"
              >
                Revoke
              </Button>
            </div>
          )}

          <div className="flex gap-3">
            <Input
              type="email"
              value={accountantEmail}
              onChange={e => setAccountantEmail(e.target.value)}
              placeholder="accountant@example.com"
            />
            <Button
              onClick={async () => {
                setInviteLoading(true); setError(''); setSuccess('');
                try {
                  const r = await fetch('/api/settings/accountant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountantEmail: accountantEmail }) });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  setSuccess('Invitation sent');
                  setAccountantEmail('');
                  fetch('/api/settings/accountant').then(r => r.json()).then(d => setAccountantInvite(d.accountant)).catch(() => {});
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Failed');
                } finally { setInviteLoading(false); }
              }}
              disabled={inviteLoading || !accountantEmail}
              variant="primary"
              className="shrink-0 rounded-cinematic uppercase tracking-widest text-sm font-black"
            >
              {inviteLoading ? 'Sending…' : 'Send Invite'}
            </Button>
          </div>
        </Card>
      )}

      {activeTab === 'po' && canAccess(user?.tier, 'po_approvals') && (
        <Card variant="default" padding="lg" className="space-y-6">
          <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Purchase Order Approvals</h3>

          {poSaved && <div className="bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/20 text-[var(--theme-accent)] px-4 py-3 rounded-cinematic text-sm font-bold">PO settings saved</div>}

          <div className="flex items-center gap-4 py-2">
            <Checkbox
              id="po-enabled"
              checked={poSettings.enabled}
              onCheckedChange={v => setPOSettings(p => ({ ...p, enabled: !!v }))}
            />
            <div>
              <Label htmlFor="po-enabled" className="text-sm font-medium cursor-pointer normal-case tracking-normal">Enable purchase order approvals</Label>
              <p className="text-xs text-[var(--theme-text-dim)] mt-0.5">When enabled, purchase orders appear in the Expenses menu and can be linked to supplier bills.</p>
            </div>
          </div>

          {poSettings.enabled && (
            <>
              <div className="space-y-2">
                <Label>Approver</Label>
                <Select
                  value={poSettings.approverUserId}
                  onChange={e => setPOSettings(p => ({ ...p, approverUserId: e.target.value }))}
                >
                  <option value="">No approver set (POs auto-approve)</option>
                  {poMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name} — {m.email}</option>
                  ))}
                </Select>
                <p className="text-xs text-[var(--theme-text-dim)] mt-1">Team members must accept their invite to appear here.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Approval Threshold (£)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={poSettings.approvalThreshold}
                    onChange={e => setPOSettings(p => ({ ...p, approvalThreshold: e.target.value }))}
                    onFocus={e => e.target.select()}
                    placeholder="500"
                  />
                  <p className="text-xs text-[var(--theme-text-dim)] mt-1">POs at or above this amount require approval. Below this, they auto-approve.</p>
                </div>
                <div className="space-y-2">
                  <Label>Bill Variance Tolerance (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={poSettings.varianceTolerancePct}
                    onChange={e => setPOSettings(p => ({ ...p, varianceTolerancePct: e.target.value }))}
                    onFocus={e => e.target.select()}
                    placeholder="5"
                  />
                  <p className="text-xs text-[var(--theme-text-dim)] mt-1">If a bill is within this % of the PO total, it links without a variance reason. Over this % requires a reason.</p>
                </div>
              </div>
            </>
          )}

          {/* Per-staff approver overrides */}
          <div className="mt-4 pt-6 border-t border-[var(--theme-border)] space-y-4">
            <div>
              <h4 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-1">Per-Staff Approver Overrides</h4>
              <p className="text-xs text-[var(--theme-text-muted)]">Override the default approver for specific team members. If no override is set, the default approver above is used.</p>
            </div>

            {poMappings.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Their Approver</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poMappings.map(m => (
                    <TableRow key={m.staff_user_id}>
                      <TableCell className="text-[var(--theme-text)]">{m.staff_name}</TableCell>
                      <TableCell className="text-[var(--theme-text-muted)]">{m.approver_name}</TableCell>
                      <TableCell>
                        <Button
                          onClick={async () => {
                            setMappingLoading(true);
                            await fetch(`/api/po/approver-mappings/${m.staff_user_id}`, { method: 'DELETE' });
                            setPOMappings(prev => prev.filter(x => x.staff_user_id !== m.staff_user_id));
                            setMappingLoading(false);
                          }}
                          disabled={mappingLoading}
                          variant="ghost"
                          className="text-[var(--theme-destructive)] uppercase tracking-widest text-[10px] font-black"
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select value={newMappingStaff} onChange={e => setNewMappingStaff(e.target.value)}>
                <option value="">Staff member…</option>
                {poMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
              <Select value={newMappingApprover} onChange={e => setNewMappingApprover(e.target.value)}>
                <option value="">Their approver…</option>
                {poMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
              <Button
                onClick={async () => {
                  if (!newMappingStaff || !newMappingApprover) return;
                  setMappingLoading(true);
                  try {
                    const r = await fetch('/api/po/approver-mappings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ staffUserId: newMappingStaff, approverUserId: newMappingApprover }),
                    });
                    const d = await r.json();
                    if (r.ok && d.mapping) {
                      setPOMappings(prev => {
                        const filtered = prev.filter(x => x.staff_user_id !== newMappingStaff);
                        return [...filtered, d.mapping];
                      });
                      setNewMappingStaff(''); setNewMappingApprover('');
                    }
                  } finally { setMappingLoading(false); }
                }}
                disabled={mappingLoading || !newMappingStaff || !newMappingApprover}
                variant="ghost"
                className="rounded-cinematic uppercase tracking-widest text-sm font-black bg-[var(--theme-background)]"
              >
                {mappingLoading ? 'Adding…' : 'Add Override'}
              </Button>
            </div>
          </div>

          <Button
            onClick={async () => {
              setPOLoading(true); setPOSaved(false);
              try {
                const r = await fetch('/api/po/settings', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(poSettings),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error);
                setPOSaved(true);
                setTimeout(() => setPOSaved(false), 3000);
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Failed to save PO settings');
              } finally { setPOLoading(false); }
            }}
            disabled={poLoading}
            variant="primary"
            className="w-full rounded-cinematic uppercase tracking-widest text-sm font-black"
          >
            {poLoading ? 'Saving...' : 'Save PO Settings'}
          </Button>
        </Card>
      )}

      {activeTab === 'expenses_approval' && (
        <Card variant="default" padding="lg" className="space-y-6">
          <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Expense & Mileage Approvals</h3>

          {expApprovalSaved && <div className="bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/20 text-[var(--theme-accent)] px-4 py-3 rounded-cinematic text-sm font-bold">Approval settings saved</div>}

          <div className="flex items-center gap-4 py-2">
            <Checkbox
              id="exp-approval-enabled"
              checked={expApproval.enabled}
              onCheckedChange={v => setExpApproval(p => ({ ...p, enabled: !!v }))}
            />
            <div>
              <Label htmlFor="exp-approval-enabled" className="text-sm font-medium cursor-pointer normal-case tracking-normal">Require approval for expense & mileage claims</Label>
              <p className="text-xs text-[var(--theme-text-dim)] mt-0.5">When enabled, claims are held in a pending state until an approver reviews them. The GL entry is only posted on approval.</p>
            </div>
          </div>

          {expApproval.enabled && (
            <div className="space-y-2">
              <Label>Approver</Label>
              <Select
                value={expApproval.approverUserId}
                onChange={e => setExpApproval(p => ({ ...p, approverUserId: e.target.value }))}
              >
                <option value="">Select approver…</option>
                {expApprovalMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name} — {m.email}</option>
                ))}
              </Select>
              <p className="text-xs text-[var(--theme-text-dim)] mt-1">Team members must accept their invite to appear here. The approver will be emailed when a new claim is submitted.</p>
            </div>
          )}

          <Button
            onClick={async () => {
              setExpApprovalLoading(true); setExpApprovalSaved(false);
              try {
                const r = await fetch('/api/expense-approval-settings', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ enabled: expApproval.enabled, approverUserId: expApproval.approverUserId || null }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error);
                setExpApprovalSaved(true);
                setTimeout(() => setExpApprovalSaved(false), 3000);
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Failed to save approval settings');
              } finally { setExpApprovalLoading(false); }
            }}
            disabled={expApprovalLoading}
            variant="primary"
            className="w-full rounded-cinematic uppercase tracking-widest text-sm font-black"
          >
            {expApprovalLoading ? 'Saving...' : 'Save Approval Settings'}
          </Button>
        </Card>
      )}

      {activeTab === 'locks' && (
        <div className="space-y-6">
          {lockError && <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic text-sm font-bold">{lockError}</div>}
          {lockSaved && <div className="bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/20 text-[var(--theme-accent)] px-4 py-3 rounded-cinematic text-sm font-bold">{lockSaved}</div>}

          {/* Current lock status */}
          <Card variant="default" padding="lg" className="space-y-6">
            <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Current Lock Status</h3>
            <div className={`flex items-center gap-3 p-4 rounded-cinematic border ${lockData?.lockedThrough ? 'bg-[var(--theme-warning)]/10 border-[var(--theme-warning)]/30' : 'bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/20'}`}>
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${lockData?.lockedThrough ? 'bg-[var(--theme-warning)]' : 'bg-[var(--theme-accent)]'}`}></div>
              <p className="text-sm font-medium text-[var(--theme-text)]">
                {lockData?.lockedThrough
                  ? <>Periods up to and including <strong>{new Date(lockData.lockedThrough + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong> are locked</>
                  : 'No periods are locked'}
              </p>
            </div>
            {lockData?.lockedThrough && (
              <Button
                onClick={async () => {
                  if (!confirm('Unlock all periods? This will allow entries to be posted into previously closed periods.')) return;
                  setLockLoading(true); setLockError(''); setLockSaved('');
                  try {
                    const r = await fetch('/api/period-locks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unlock' }) });
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.error);
                    setLockSaved('Periods unlocked');
                    loadLockData();
                  } catch (e: unknown) { setLockError(e instanceof Error ? e.message : 'Failed'); }
                  finally { setLockLoading(false); }
                }}
                disabled={lockLoading}
                variant="ghost"
                className="text-[var(--theme-destructive)] bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 rounded-cinematic uppercase tracking-widest text-[10px] font-black"
              >
                Unlock All Periods
              </Button>
            )}
          </Card>

          {/* Manual lock */}
          <Card variant="default" padding="lg" className="space-y-4">
            <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Lock a Period (Year-End)</h3>
            <p className="text-[var(--theme-text-muted)] text-sm">Lock all dates up to and including a chosen date. No entries can be posted into locked periods.</p>
            <div className="flex gap-3">
              <DatePicker value={manualLockDate} onChange={setManualLockDate} />
              <Button
                onClick={async () => {
                  if (!manualLockDate) return;
                  if (!confirm(`Lock all periods through ${manualLockDate}? This will prevent new entries being posted before this date.`)) return;
                  setLockLoading(true); setLockError(''); setLockSaved('');
                  try {
                    const r = await fetch('/api/period-locks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'lock', lockDate: manualLockDate }) });
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.error);
                    setLockSaved(`Locked through ${manualLockDate}`);
                    setManualLockDate('');
                    loadLockData();
                  } catch (e: unknown) { setLockError(e instanceof Error ? e.message : 'Failed'); }
                  finally { setLockLoading(false); }
                }}
                disabled={lockLoading || !manualLockDate}
                variant="primary"
                className="shrink-0 rounded-cinematic uppercase tracking-widest text-sm font-black"
              >
                {lockLoading ? 'Locking...' : 'Lock Period →'}
              </Button>
            </div>
          </Card>

          {/* Override management */}
          <Card variant="default" padding="lg" className="space-y-4">
            <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">User Overrides</h3>
            <p className="text-[var(--theme-text-muted)] text-sm">Grant a specific user temporary access to post into locked periods. The override expires automatically.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                value={overrideUserId}
                onChange={e => setOverrideUserId(e.target.value)}
                className="sm:col-span-1"
              >
                <option value="">Select user…</option>
                {lockMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name} — {m.email}</option>
                ))}
              </Select>
              <Input
                type="datetime-local"
                value={overrideUntil}
                onChange={e => setOverrideUntil(e.target.value)}
                className="sm:col-span-1"
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
              />
              <Button
                onClick={async () => {
                  if (!overrideUserId || !overrideUntil) return;
                  setLockLoading(true); setLockError(''); setLockSaved('');
                  try {
                    const r = await fetch('/api/period-locks/overrides', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: overrideUserId, overrideUntil: new Date(overrideUntil).toISOString() }),
                    });
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.error);
                    setLockSaved('Override granted');
                    setOverrideUserId(''); setOverrideUntil('');
                    loadLockData();
                  } catch (e: unknown) { setLockError(e instanceof Error ? e.message : 'Failed'); }
                  finally { setLockLoading(false); }
                }}
                disabled={lockLoading || !overrideUserId || !overrideUntil}
                variant="primary"
                className="rounded-cinematic uppercase tracking-widest text-sm font-black"
              >
                Grant Override
              </Button>
            </div>

            {lockOverrides.length > 0 && (
              <div className="space-y-2 mt-4">
                <Label>Active Overrides</Label>
                {lockOverrides.map((ov: any) => (
                  <div key={ov.user_id} className="flex items-center justify-between gap-4 p-3 bg-[var(--theme-primary)]/3 rounded-cinematic border border-[var(--theme-border)]">
                    <div>
                      <p className="text-sm font-medium text-[var(--theme-text)]">{ov.user_name || ov.user_id}</p>
                      <p className="text-xs text-[var(--theme-text-dim)]">Until {new Date(ov.override_until).toLocaleString('en-GB')}</p>
                    </div>
                    <Button
                      onClick={async () => {
                        setLockError(''); setLockSaved('');
                        try {
                          const r = await fetch(`/api/period-locks/overrides/${ov.user_id}`, { method: 'DELETE' });
                          if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
                          setLockSaved('Override revoked');
                          loadLockData();
                        } catch (e: unknown) { setLockError(e instanceof Error ? e.message : 'Failed'); }
                      }}
                      variant="ghost"
                      className="text-[var(--theme-destructive)] hover:text-[var(--theme-destructive)] uppercase tracking-widest text-[10px] font-black"
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Year-End Close ─────────────────────────────── */}
            <div className="mt-10 pt-8 border-t border-[var(--theme-border)]">
              <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-1">Year-End Close</h3>
              <p className="text-sm text-[var(--theme-text-muted)] mb-6">
                Zero out all P&amp;L accounts into Retained Earnings and lock the financial year.
                {lastFyEndDate && (
                  <span className="ml-2 text-[var(--theme-text-dim)]">Last close: <strong className="text-[var(--theme-text)]">{lastFyEndDate}</strong></span>
                )}
              </p>

              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>Year-End Date</Label>
                  <DatePicker value={yeDate} onChange={v => { setYeDate(v); setYePreview(null); setYeError(''); setYeSuccess(''); }} />
                </div>
                <Button
                  onClick={loadYePreview}
                  disabled={yePreviewLoading || !yeDate}
                  variant="ghost"
                  className="bg-[var(--theme-background)] rounded-cinematic uppercase tracking-widest text-sm font-black"
                >
                  {yePreviewLoading ? 'Loading…' : 'Preview Close'}
                </Button>
              </div>

              {yeError && <p className="mt-4 text-sm text-[var(--theme-destructive)]">{yeError}</p>}
              {yeSuccess && <p className="mt-4 text-sm text-[var(--theme-accent)]">{yeSuccess}</p>}

              {yePreview && !yeSuccess && (
                <div className="mt-6">
                  <Label className="mb-3 block">Closing entries for {yePreview.yearEndDate}</Label>
                  <Card padding="none" className="overflow-hidden border-[var(--theme-border)] mb-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {yePreview.lines.map((ln: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-[var(--theme-text-muted)]">{ln.accountCode} — {ln.accountName}</TableCell>
                            <TableCell className="text-right font-mono text-[var(--theme-text)]">{ln.closingDebit > 0 ? `£${ln.closingDebit.toFixed(2)}` : '—'}</TableCell>
                            <TableCell className="text-right font-mono text-[var(--theme-text)]">{ln.closingCredit > 0 ? `£${ln.closingCredit.toFixed(2)}` : '—'}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-[var(--theme-border)]/[0.05]">
                          <TableCell className="text-[var(--theme-text)]">
                            3001 — Retained Earnings ({yePreview.netProfit >= 0 ? 'profit' : 'loss'})
                          </TableCell>
                          <TableCell className="text-right font-mono text-[var(--theme-text)]">{yePreview.netProfit < 0 ? `£${Math.abs(yePreview.netProfit).toFixed(2)}` : '—'}</TableCell>
                          <TableCell className="text-right font-mono text-[var(--theme-text)]">{yePreview.netProfit >= 0 ? `£${yePreview.netProfit.toFixed(2)}` : '—'}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Card>

                  <div className="flex items-center gap-4">
                    <Button
                      onClick={() => setYeConfirmOpen(true)}
                      variant="primary"
                      className="rounded-cinematic uppercase tracking-widest text-sm font-black"
                    >
                      Run Year-End Close
                    </Button>
                    <Button
                      onClick={() => { setYePreview(null); setYeError(''); }}
                      variant="ghost"
                      className="text-sm text-[var(--theme-text-dim)] hover:text-[var(--theme-text)]"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Confirm modal */}
              {yeConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--theme-primary)]/50 backdrop-blur-sm">
                  <Card variant="default" padding="lg" className="max-w-md w-full mx-4 shadow-2xl space-y-6">
                    <div>
                      <h4 className="text-lg font-black text-[var(--theme-text)] mb-2">Confirm Year-End Close</h4>
                      <p className="text-sm text-[var(--theme-text-muted)]">
                        This will post the closing journal and lock the period through <strong>{yeDate}</strong>. This cannot be undone without manual journal reversal.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={confirmYearEndClose}
                        disabled={yeLoading}
                        variant="primary"
                        className="flex-1 rounded-cinematic uppercase tracking-widest text-sm font-black"
                      >
                        {yeLoading ? 'Processing…' : 'Confirm Close'}
                      </Button>
                      <Button
                        onClick={() => setYeConfirmOpen(false)}
                        disabled={yeLoading}
                        variant="ghost"
                        className="flex-1 rounded-cinematic uppercase tracking-widest text-sm font-black bg-[var(--theme-background)]"
                      >
                        Cancel
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'stripe' && (
        <Card variant="default" padding="lg" className="space-y-6">
          <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Stripe Connect</h3>
          {user.stripe_account_id ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-[var(--theme-accent)] rounded-full"></div>
                <span className="text-[var(--theme-text)] font-medium">Connected</span>
              </div>
              <p className="text-[var(--theme-text-muted)] text-sm">Account ID: {user.stripe_account_id}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[var(--theme-text-muted)]">Connect your Stripe account to accept card payments on invoices you send to clients.</p>
              <Button
                onClick={async () => {
                  setLoading(true); setError('');
                  try {
                    const r = await fetch('/api/stripe/connect', { method: 'POST' });
                    const d = await r.json();
                    if (d.url) window.location.href = d.url;
                    else throw new Error(d.error || 'Failed to get connect URL');
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : 'Failed to start Stripe connect');
                    setLoading(false);
                  }
                }}
                disabled={loading}
                variant="primary"
                className="rounded-cinematic uppercase tracking-widest text-sm font-black"
              >
                {loading ? 'Redirecting…' : 'Connect Stripe →'}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
