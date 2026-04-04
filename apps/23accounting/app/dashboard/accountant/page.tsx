'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Badge, Button, Input, PageHeader } from '@relentify/ui'
import { Users, Mail } from 'lucide-react'

interface ClientHealth {
  overdueInvoices: number
  unmatchedTransactions: number
  missingReceipts: number
}

interface Client {
  id: string
  client_user_id: string | null
  invite_email: string
  status: 'pending' | 'active'
  full_name: string | null
  email: string | null
  business_name: string | null
  tier: string | null
  health: ClientHealth | null
  invited_at: string
  accepted_at: string | null
}

function HealthBadge({ count, label, variant }: { count: number; label: string; variant: 'danger' | 'warning' }) {
  if (count === 0) return null
  return (
    <Badge variant={variant} className="text-[9px] uppercase tracking-widest font-black px-2">
      {count} {label}
    </Badge>
  )
}

export default function AccountantPortalPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteError, setInviteError] = useState('')

  useEffect(() => {
    fetch('/api/accountant/clients', { credentials: 'include' })
      .then(r => r.json())
      .then(setClients)
      .finally(() => setLoading(false))
  }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteMsg('')
    setInviteError('')
    const r = await fetch('/api/accountant/invite', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    const data = await r.json()
    if (r.ok) {
      setInviteMsg(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      const updated = await fetch('/api/accountant/clients', { credentials: 'include' }).then(r => r.json())
      setClients(updated)
    } else {
      setInviteError(data.error || 'Failed to send invite')
    }
    setInviting(false)
  }

  async function handleEnterClient(clientUserId: string) {
    const r = await fetch('/api/accountant/switch', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientUserId }),
    })
    if (r.ok) router.push('/dashboard')
  }

  async function handleRevoke(clientUserId: string) {
    if (!confirm('Remove this client? Their data will be unaffected.')) return
    await fetch(`/api/accountant/clients/${clientUserId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    setClients(prev => prev.filter(c => c.client_user_id !== clientUserId))
  }

  const activeClients = clients.filter(c => c.status === 'active')
  const pendingClients = clients.filter(c => c.status === 'pending')

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          supertitle="ACCOUNTANT"
          title="Client Portal"
          className="mb-0"
        />
      </div>

      {/* Invite form */}
      <Card variant="default" padding="lg" className="space-y-4">
        <h3 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Invite a new client</h3>
        <form onSubmit={handleInvite} className="flex gap-3">
          <Input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="client@example.com"
            required
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={inviting || !inviteEmail}
            variant="primary"
            className="shrink-0 rounded-cinematic uppercase tracking-widest text-sm font-black"
          >
            {inviting ? 'Sending…' : 'Send Invite'}
          </Button>
        </form>
        {inviteMsg && <p className="text-sm text-[var(--theme-accent)] font-medium">{inviteMsg}</p>}
        {inviteError && <p className="text-sm text-[var(--theme-destructive)] font-medium">{inviteError}</p>}
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-[var(--theme-accent)]/20 border-t-[var(--theme-accent)] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Active clients */}
          {activeClients.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">
                Active clients ({activeClients.length})
              </h2>
              <div className="space-y-2">
                {activeClients.map(client => (
                  <Card key={client.id} variant="default" padding="md" className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-[var(--theme-text)] truncate">
                        {client.full_name || client.email}
                      </p>
                      {client.business_name && (
                        <p className="text-xs text-[var(--theme-text-muted)] truncate">{client.business_name}</p>
                      )}
                      {client.health && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <HealthBadge count={client.health.overdueInvoices} label="overdue" variant="danger" />
                          <HealthBadge count={client.health.unmatchedTransactions} label="unmatched" variant="warning" />
                          <HealthBadge count={client.health.missingReceipts} label="no receipt" variant="warning" />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        onClick={() => handleEnterClient(client.client_user_id!)}
                        variant="primary"
                        className="rounded-cinematic uppercase tracking-widest text-xs font-black"
                      >
                        Enter account
                      </Button>
                      <Button
                        onClick={() => handleRevoke(client.client_user_id!)}
                        variant="ghost"
                        className="text-[var(--theme-destructive)] hover:text-[var(--theme-destructive)] uppercase tracking-widest text-[10px] font-black"
                      >
                        Remove
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Pending invitations */}
          {pendingClients.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">
                Pending invitations ({pendingClients.length})
              </h2>
              <div className="space-y-2">
                {pendingClients.map(client => (
                  <Card key={client.id} variant="default" padding="md" className="flex items-center justify-between gap-4 opacity-60">
                    <div className="flex items-center gap-3">
                      <Mail size={16} className="text-[var(--theme-text-dim)] shrink-0" />
                      <div>
                        <p className="text-sm text-[var(--theme-text)] font-medium">{client.invite_email}</p>
                        <p className="text-xs text-[var(--theme-text-dim)]">
                          Invited {new Date(client.invited_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="neutral" className="uppercase tracking-widest text-[9px] font-black">Awaiting signup</Badge>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {clients.length === 0 && (
            <Card className="p-12 text-center bg-transparent border-dashed border-2">
              <div className="w-16 h-16 bg-[var(--theme-accent)]/10 rounded-cinematic flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-[var(--theme-accent)]" />
              </div>
              <h4 className="text-[var(--theme-text)] font-black text-lg mb-2 uppercase tracking-wider">No clients yet</h4>
              <p className="text-[var(--theme-text-dim)] text-sm max-w-sm mx-auto">
                Send an invite above to get started. Your client will receive an email with a link to connect their account.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
