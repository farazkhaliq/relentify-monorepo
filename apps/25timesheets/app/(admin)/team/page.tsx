'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Badge, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@relentify/ui'
import { Plus, UserPlus } from 'lucide-react'

interface Member {
  id: string; invited_email: string; role: string; status: string; full_name: string | null; email: string | null
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('staff')

  const fetchMembers = useCallback(async () => {
    const res = await fetch('/api/team')
    const data = await res.json()
    setMembers(data.members || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const handleInvite = async () => {
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    if (res.ok) {
      setDialogOpen(false)
      setInviteEmail('')
      setInviteRole('staff')
      fetchMembers()
    }
  }

  const handleRoleChange = async (memberId: string, role: string) => {
    await fetch(`/api/team/${memberId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    fetchMembers()
  }

  if (loading) return <div className="animate-pulse p-4">Loading team...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Team</h1>
        <Button onClick={() => setDialogOpen(true)}><UserPlus size={16} className="mr-1" /> Invite</Button>
      </div>

      <div className="grid gap-3">
        {members.map(m => (
          <Card key={m.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{m.full_name || m.invited_email}</p>
                <p className="text-sm text-[var(--theme-text-muted)]">{m.email || m.invited_email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.status === 'active' ? 'default' : 'outline'}>
                  {m.status}
                </Badge>
                <Select value={m.role} onValueChange={v => handleRoleChange(m.id, v)}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        ))}
        {members.length === 0 && <p className="text-[var(--theme-text-muted)]">No team members yet.</p>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>Email</Label><Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" /></div>
            <div><Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleInvite} disabled={!inviteEmail}>Send Invite</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
