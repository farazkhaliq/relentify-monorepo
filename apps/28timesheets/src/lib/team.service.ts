import { query } from './db'
import { v4 as uuid } from 'uuid'
import { TimesheetPermissions } from './auth'

export interface WorkspaceMember {
  id: string
  owner_user_id: string
  member_user_id: string | null
  invited_email: string
  role: string
  permissions: TimesheetPermissions | null
  status: string
  invite_token: string | null
  full_name?: string
  email?: string
}

const DEFAULT_STAFF_PERMISSIONS: TimesheetPermissions = {
  timesheets: { view: true, create: true, approve: false },
  scheduling: { view: true, create: false, assign: false },
  reports:    { view: false, export: false },
  settings:   { view: false, manage: false },
  team:       { view: false, manage: false },
  sites:      { view: true, manage: false },
}

export async function inviteMember(
  ownerUserId: string, email: string, role: string, permissions?: TimesheetPermissions
): Promise<{ inviteToken: string }> {
  const existing = await query(
    `SELECT id FROM acc_workspace_members WHERE owner_user_id = $1 AND invited_email = $2`,
    [ownerUserId, email]
  )
  if (existing.rows[0]) throw new Error('Already invited')

  const inviteToken = uuid()
  const perms = permissions || DEFAULT_STAFF_PERMISSIONS

  await query(
    `INSERT INTO acc_workspace_members (owner_user_id, invited_email, permissions, role, invite_token, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')`,
    [ownerUserId, email, JSON.stringify(perms), role, inviteToken]
  )

  return { inviteToken }
}

export async function acceptInvite(token: string, memberUserId: string): Promise<void> {
  await query(
    `UPDATE acc_workspace_members SET member_user_id = $1, status = 'active', accepted_at = NOW()
     WHERE invite_token = $2 AND status = 'pending'`,
    [memberUserId, token]
  )
}

export async function listMembers(ownerUserId: string): Promise<WorkspaceMember[]> {
  const r = await query(
    `SELECT wm.*, u.full_name, u.email
     FROM acc_workspace_members wm
     LEFT JOIN users u ON wm.member_user_id = u.id
     WHERE wm.owner_user_id = $1
     ORDER BY wm.invited_at DESC`,
    [ownerUserId]
  )
  return r.rows
}

export async function updateMemberRole(memberId: string, ownerUserId: string, role: string): Promise<void> {
  await query(
    `UPDATE acc_workspace_members SET role = $1 WHERE id = $2 AND owner_user_id = $3`,
    [role, memberId, ownerUserId]
  )
}

export async function updateMemberPermissions(
  memberId: string, ownerUserId: string, permissions: TimesheetPermissions
): Promise<void> {
  await query(
    `UPDATE acc_workspace_members SET permissions = $1 WHERE id = $2 AND owner_user_id = $3`,
    [JSON.stringify(permissions), memberId, ownerUserId]
  )
}

export async function getMemberRole(ownerUserId: string, memberUserId: string): Promise<string | null> {
  if (ownerUserId === memberUserId) return 'owner'
  const r = await query(
    `SELECT role FROM acc_workspace_members WHERE owner_user_id = $1 AND member_user_id = $2 AND status = 'active'`,
    [ownerUserId, memberUserId]
  )
  return r.rows[0]?.role || null
}
