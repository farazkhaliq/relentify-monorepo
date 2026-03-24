import { query } from './db';
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

export async function getWorkspaces(userId: string) {
  const { rows } = await query('SELECT * FROM reminders_workspaces WHERE owner_id = $1', [userId]);
  return rows as Workspace[];
}

export async function createWorkspace(name: string, userId: string) {
  const id = uuidv4();
  const { rows } = await query(
    'INSERT INTO reminders_workspaces (id, name, owner_id) VALUES ($1, $2, $3) RETURNING *',
    [id, name, userId]
  );
  
  await createList(id, 'General');
  
  return rows[0] as Workspace;
}

export async function getLists(workspaceId: string) {
  const { rows } = await query('SELECT * FROM reminders_lists WHERE workspace_id = $1', [workspaceId]);
  return rows as List[];
}

export async function createList(workspaceId: string, name: string, description?: string) {
  const id = uuidv4();
  const { rows } = await query(
    'INSERT INTO reminders_lists (id, workspace_id, name, description) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, workspaceId, name, description]
  );
  return rows[0] as List;
}
