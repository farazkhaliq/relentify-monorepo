import { query } from './db';

export interface Comment {
  id: string
  user_id: string
  actor_id: string | null
  target_user_id: string | null
  record_type: string
  record_id: string
  parent_id: string | null
  body: string
  status: 'open' | 'resolved'
  waiting_on: 'client' | 'accountant' | null
  read_at: string | null
  created_at: string
  sender_name: string      // from JOIN users
  replies: Comment[]       // populated in JS
}

// Get all comments for a record, returned as a tree
export async function getComments(
  recordType: string,
  recordId: string
): Promise<Comment[]> {
  const r = await query(
    `SELECT tc.*,
            COALESCE(u.full_name, u.email) as sender_name
     FROM transaction_comments tc
     JOIN users u ON u.id = tc.user_id
     WHERE tc.record_type = $1 AND tc.record_id = $2
     ORDER BY tc.created_at ASC`,
    [recordType, recordId]
  );
  return buildTree(r.rows);
}

// Build nested tree from flat list
function buildTree(rows: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  for (const row of rows) {
    map.set(row.id, { ...row, replies: [] });
  }
  for (const row of rows) {
    const node = map.get(row.id)!;
    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function createComment(params: {
  userId: string
  actorId?: string
  targetUserId?: string | null
  recordType: string
  recordId: string
  parentId?: string | null
  body: string
  waitingOn?: 'client' | 'accountant' | null
}): Promise<Comment> {
  const r = await query(
    `INSERT INTO transaction_comments
       (user_id, actor_id, target_user_id, record_type, record_id, parent_id, body, waiting_on)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      params.userId,
      params.actorId || null,
      params.targetUserId || null,
      params.recordType,
      params.recordId,
      params.parentId || null,
      params.body,
      params.waitingOn || null,
    ]
  );
  return { ...r.rows[0], replies: [] };
}

export async function resolveComment(commentId: string): Promise<void> {
  await query(
    `UPDATE transaction_comments
     SET status = 'resolved', waiting_on = NULL
     WHERE id = $1`,
    [commentId]
  );
}

// Mark all unread comments on a record as read for a specific user
export async function markRecordRead(
  recordType: string,
  recordId: string,
  userId: string
): Promise<void> {
  await query(
    `UPDATE transaction_comments
     SET read_at = NOW()
     WHERE record_type = $1 AND record_id = $2
       AND target_user_id = $3 AND read_at IS NULL`,
    [recordType, recordId, userId]
  );
}

// Check if we should send a notification email
// Returns false if target already has unread comments on this record (they already know)
export async function shouldSendNotification(
  targetUserId: string,
  recordType: string,
  recordId: string
): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM transaction_comments
     WHERE target_user_id = $1 AND record_type = $2 AND record_id = $3
       AND read_at IS NULL
     LIMIT 1`,
    [targetUserId, recordType, recordId]
  );
  return r.rows.length === 0; // true = no unread = should notify
}

// Get all conversations for a user (for the conversations page)
export async function getConversations(userId: string) {
  const r = await query(
    `SELECT
       record_type,
       record_id::text,
       MAX(created_at) as last_at,
       (array_agg(body ORDER BY created_at DESC))[1] as last_body,
       (array_agg(status ORDER BY created_at DESC))[1] as status,
       (array_agg(waiting_on ORDER BY created_at DESC))[1] as waiting_on,
       COUNT(*) FILTER (WHERE target_user_id = $1 AND read_at IS NULL) as unread_count
     FROM transaction_comments
     WHERE user_id = $1 OR target_user_id = $1
     GROUP BY record_type, record_id
     ORDER BY MAX(created_at) DESC
     LIMIT 100`,
    [userId]
  );
  return r.rows;
}
