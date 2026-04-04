import pool from '../../pool';
import { v4 as uuidv4 } from 'uuid';

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  settings: any;
  created_at: Date;
}

export interface List {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  created_at: Date;
}

export async function getWorkspaces(userId: string, entityId?: string) {
  if (entityId) {
    const { rows } = await pool.query('SELECT * FROM reminders_workspaces WHERE entity_id = $1', [entityId]);
    return rows as Workspace[];
  }
  const { rows } = await pool.query('SELECT * FROM reminders_workspaces WHERE owner_id = $1 AND entity_id IS NULL', [userId]);
  return rows as Workspace[];
}

export async function createWorkspace(name: string, userId: string, entityId?: string) {
  const id = uuidv4();
  const { rows } = await pool.query(
    'INSERT INTO reminders_workspaces (id, name, owner_id, entity_id, workspace_type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [id, name, userId, entityId || null, entityId ? 'entity' : 'personal']
  );

  await createList(id, 'General');

  return rows[0] as Workspace;
}

export async function getOrCreateEntityWorkspace(entityId: string, userId: string) {
  const { rows } = await pool.query('SELECT * FROM reminders_workspaces WHERE entity_id = $1 LIMIT 1', [entityId]);
  if (rows[0]) return rows[0] as Workspace;
  return createWorkspace('Team Tasks', userId, entityId);
}

export async function getLists(workspaceId: string) {
  const { rows } = await pool.query('SELECT * FROM reminders_lists WHERE workspace_id = $1', [workspaceId]);
  return rows as List[];
}

export async function createList(workspaceId: string, name: string, description?: string) {
  const id = uuidv4();
  const { rows } = await pool.query(
    'INSERT INTO reminders_lists (id, workspace_id, name, description) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, workspaceId, name, description]
  );
  return rows[0] as List;
}
