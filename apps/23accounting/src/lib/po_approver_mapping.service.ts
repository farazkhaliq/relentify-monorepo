import { query } from './db';

export interface POApproverMapping {
  id: string;
  entity_id: string;
  staff_user_id: string;
  approver_user_id: string;
  created_at: string;
  staff_name?: string;
  approver_name?: string;
  staff_email?: string;
  approver_email?: string;
}

/**
 * Resolve the approver for a given staff member.
 * Checks per-staff mapping first, falls back to entity-wide PO settings approver.
 */
export async function getApproverForStaff(
  entityId: string,
  staffUserId: string
): Promise<{ approverId: string; approverEmail: string; approverName: string } | null> {
  // Per-staff mapping takes priority
  const mapping = await query(
    `SELECT pam.approver_user_id, u.email, u.full_name
     FROM acc_po_approver_mappings pam
     JOIN users u ON pam.approver_user_id = u.id
     WHERE pam.entity_id = $1 AND pam.staff_user_id = $2`,
    [entityId, staffUserId]
  );
  if (mapping.rows[0]) {
    return {
      approverId: mapping.rows[0].approver_user_id,
      approverEmail: mapping.rows[0].email,
      approverName: mapping.rows[0].full_name,
    };
  }

  // Fall back to entity-wide PO settings approver
  const settings = await query(
    `SELECT pos.approver_user_id, u.email, u.full_name
     FROM acc_po_settings pos
     JOIN users u ON pos.approver_user_id = u.id
     WHERE pos.entity_id = $1 AND pos.enabled = TRUE AND pos.approver_user_id IS NOT NULL`,
    [entityId]
  );
  if (settings.rows[0]) {
    return {
      approverId: settings.rows[0].approver_user_id,
      approverEmail: settings.rows[0].email,
      approverName: settings.rows[0].full_name,
    };
  }

  return null;
}

export async function setPOApproverMapping(
  entityId: string,
  staffUserId: string,
  approverUserId: string
): Promise<POApproverMapping> {
  const r = await query(
    `INSERT INTO acc_po_approver_mappings (entity_id, staff_user_id, approver_user_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (entity_id, staff_user_id) DO UPDATE SET approver_user_id = EXCLUDED.approver_user_id
     RETURNING *`,
    [entityId, staffUserId, approverUserId]
  );
  return r.rows[0] as POApproverMapping;
}

export async function deletePOApproverMapping(entityId: string, staffUserId: string): Promise<void> {
  await query(
    `DELETE FROM acc_po_approver_mappings WHERE entity_id = $1 AND staff_user_id = $2`,
    [entityId, staffUserId]
  );
}

export async function getPOApproverMappings(entityId: string): Promise<POApproverMapping[]> {
  const r = await query(
    `SELECT pam.*,
       staff.full_name AS staff_name, staff.email AS staff_email,
       approver.full_name AS approver_name, approver.email AS approver_email
     FROM acc_po_approver_mappings pam
     JOIN users staff ON pam.staff_user_id = staff.id
     JOIN users approver ON pam.approver_user_id = approver.id
     WHERE pam.entity_id = $1
     ORDER BY staff.full_name`,
    [entityId]
  );
  return r.rows as POApproverMapping[];
}
