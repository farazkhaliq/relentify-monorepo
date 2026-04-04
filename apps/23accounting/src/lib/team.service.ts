import { query } from './db';
import { WorkspacePermissions } from './auth';
import { DEFAULT_PERMISSIONS } from './team-defaults';
export { DEFAULT_PERMISSIONS } from './team-defaults';

export async function inviteMember(
  ownerUserId: string,
  email: string,
  permissions: WorkspacePermissions = DEFAULT_PERMISSIONS
) {
  const token = crypto.randomUUID();
  const r = await query(
    `INSERT INTO acc_workspace_members (owner_user_id, invited_email, permissions, invite_token)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (owner_user_id, invited_email)
     DO UPDATE SET permissions=$3, invite_token=$4, status='pending', invited_at=NOW()
     RETURNING *`,
    [ownerUserId, email.toLowerCase(), JSON.stringify(permissions), token]
  );
  return r.rows[0];
}

export async function getMembersByOwner(ownerUserId: string) {
  const r = await query(
    `SELECT wm.*, u.full_name as member_name
     FROM acc_workspace_members wm
     LEFT JOIN users u ON u.id = wm.member_user_id
     WHERE wm.owner_user_id = $1 AND wm.status != 'revoked'
     ORDER BY wm.invited_at DESC`,
    [ownerUserId]
  );
  return r.rows;
}

export async function getMember(memberId: string, ownerUserId: string) {
  const r = await query(
    `SELECT * FROM acc_workspace_members WHERE id=$1 AND owner_user_id=$2`,
    [memberId, ownerUserId]
  );
  return r.rows[0] || null;
}

export async function updateMemberPermissions(
  memberId: string,
  ownerUserId: string,
  permissions: WorkspacePermissions
) {
  const r = await query(
    `UPDATE acc_workspace_members SET permissions=$1
     WHERE id=$2 AND owner_user_id=$3
     RETURNING *`,
    [JSON.stringify(permissions), memberId, ownerUserId]
  );
  return r.rows[0] || null;
}

export async function revokeMember(memberId: string, ownerUserId: string) {
  await query(
    `UPDATE acc_workspace_members SET status='revoked'
     WHERE id=$1 AND owner_user_id=$2`,
    [memberId, ownerUserId]
  );
}

export async function acceptInvite(token: string, memberUserId: string, memberEmail: string) {
  const r = await query(
    `SELECT * FROM acc_workspace_members WHERE invite_token=$1 AND status='pending'`,
    [token]
  );
  const row = r.rows[0];
  if (!row) return null;
  if (row.invited_email.toLowerCase() !== memberEmail.toLowerCase()) return null;

  const updated = await query(
    `UPDATE acc_workspace_members
     SET member_user_id=$1, status='active', accepted_at=NOW(), invite_token=NULL
     WHERE id=$2
     RETURNING *`,
    [memberUserId, row.id]
  );
  return updated.rows[0];
}

export async function getWorkspacesForMember(memberUserId: string) {
  const r = await query(
    `SELECT wm.id, wm.owner_user_id, wm.permissions, wm.status,
            u.full_name as owner_name, u.email as owner_email, u.business_name as owner_business_name
     FROM acc_workspace_members wm
     JOIN users u ON u.id = wm.owner_user_id
     WHERE wm.member_user_id=$1 AND wm.status='active'`,
    [memberUserId]
  );
  return r.rows;
}

export async function getMemberByToken(token: string) {
  const r = await query(
    `SELECT wm.*, u.full_name as owner_name, u.business_name as owner_business_name
     FROM acc_workspace_members wm
     JOIN users u ON u.id = wm.owner_user_id
     WHERE wm.invite_token=$1 AND wm.status='pending'`,
    [token]
  );
  return r.rows[0] || null;
}

export async function getActiveMembership(ownerUserId: string, memberUserId: string) {
  const r = await query(
    `SELECT * FROM acc_workspace_members
     WHERE owner_user_id=$1 AND member_user_id=$2 AND status='active'`,
    [ownerUserId, memberUserId]
  );
  return r.rows[0] || null;
}

export async function getMemberRole(
  ownerUserId: string,
  memberUserId: string
): Promise<'admin' | 'accountant' | 'staff' | null> {
  // Owner is always admin
  if (ownerUserId === memberUserId) return 'admin'

  const r = await query(
    `SELECT role FROM acc_workspace_members
     WHERE owner_user_id=$1 AND member_user_id=$2 AND status='accepted'`,
    [ownerUserId, memberUserId]
  )
  return r.rows.length > 0 ? (r.rows[0].role as 'admin' | 'accountant' | 'staff') : null
}

export async function requireGLRole(
  ownerUserId: string,
  actingUserId: string,
  allowedRoles: Array<'admin' | 'accountant' | 'staff'>
): Promise<void> {
  const role = await getMemberRole(ownerUserId, actingUserId)
  if (!role || !allowedRoles.includes(role)) {
    throw new Error(`PERMISSION_DENIED: This action requires one of: ${allowedRoles.join(', ')}`)
  }
}
