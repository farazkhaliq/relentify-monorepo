import { query } from './db';

export interface Project {
  id: string;
  entity_id: string;
  user_id: string;
  name: string;
  description: string | null;
  customer_id: string | null;
  status: string;
  budget: string | null;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  // aggregated
  income?: number;
  costs?: number;
  profit?: number;
  customer_name?: string | null;
}

export async function getProjectsByEntity(userId: string, entityId: string): Promise<Project[]> {
  const r = await query(
    `SELECT p.*,
       c.name as customer_name,
       COALESCE(SUM(i.total) FILTER (WHERE i.status = 'paid'), 0) as income,
       COALESCE(SUM(b.amount), 0) as costs
     FROM projects p
     LEFT JOIN customers c ON c.id = p.customer_id
     LEFT JOIN invoices i ON i.project_id = p.id
     LEFT JOIN bills b ON b.project_id = p.id
     WHERE p.entity_id = $1 AND p.user_id = $2
     GROUP BY p.id, c.name
     ORDER BY p.created_at DESC`,
    [entityId, userId]
  );
  return r.rows.map(row => ({
    ...row,
    income: parseFloat(row.income),
    costs: parseFloat(row.costs),
    profit: parseFloat(row.income) - parseFloat(row.costs),
  })) as Project[];
}

export async function getProjectById(projectId: string, userId: string, entityId: string): Promise<Project | null> {
  const r = await query(
    `SELECT p.*,
       c.name as customer_name,
       COALESCE(SUM(i.total) FILTER (WHERE i.status = 'paid'), 0) as income,
       COALESCE(SUM(b.amount), 0) as costs
     FROM projects p
     LEFT JOIN customers c ON c.id = p.customer_id
     LEFT JOIN invoices i ON i.project_id = p.id
     LEFT JOIN bills b ON b.project_id = p.id
     WHERE p.id = $1 AND p.entity_id = $2 AND p.user_id = $3
     GROUP BY p.id, c.name`,
    [projectId, entityId, userId]
  );
  if (!r.rows[0]) return null;
  const row = r.rows[0];
  return {
    ...row,
    income: parseFloat(row.income),
    costs: parseFloat(row.costs),
    profit: parseFloat(row.income) - parseFloat(row.costs),
  } as Project;
}

export async function getProjectInvoices(projectId: string, userId: string) {
  const r = await query(
    `SELECT invoice_number, client_name, due_date, total, status, currency
     FROM invoices WHERE project_id = $1 AND user_id = $2 ORDER BY due_date DESC`,
    [projectId, userId]
  );
  return r.rows;
}

export async function getProjectBills(projectId: string, userId: string) {
  const r = await query(
    `SELECT supplier_name, category, due_date, amount, currency, status
     FROM bills WHERE project_id = $1 AND user_id = $2 ORDER BY due_date DESC`,
    [projectId, userId]
  );
  return r.rows;
}

export async function createProject(userId: string, entityId: string, data: {
  name: string;
  description?: string;
  customerId?: string;
  budget?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Project> {
  const r = await query(
    `INSERT INTO projects (entity_id, user_id, name, description, customer_id, budget, currency, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      entityId,
      userId,
      data.name,
      data.description || null,
      data.customerId || null,
      data.budget || null,
      data.currency || 'GBP',
      data.startDate || null,
      data.endDate || null,
    ]
  );
  return r.rows[0] as Project;
}

export async function updateProject(projectId: string, userId: string, entityId: string, data: {
  name?: string;
  description?: string;
  customerId?: string;
  budget?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<Project | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let p = 1;

  if (data.name !== undefined) { fields.push(`name = $${p++}`); values.push(data.name); }
  if (data.description !== undefined) { fields.push(`description = $${p++}`); values.push(data.description); }
  if (data.customerId !== undefined) { fields.push(`customer_id = $${p++}`); values.push(data.customerId || null); }
  if (data.budget !== undefined) { fields.push(`budget = $${p++}`); values.push(data.budget || null); }
  if (data.currency !== undefined) { fields.push(`currency = $${p++}`); values.push(data.currency); }
  if (data.startDate !== undefined) { fields.push(`start_date = $${p++}`); values.push(data.startDate || null); }
  if (data.endDate !== undefined) { fields.push(`end_date = $${p++}`); values.push(data.endDate || null); }
  if (data.status !== undefined) { fields.push(`status = $${p++}`); values.push(data.status); }

  if (fields.length === 0) return getProjectById(projectId, userId, entityId);

  fields.push(`updated_at = NOW()`);
  values.push(projectId, entityId, userId);

  const r = await query(
    `UPDATE projects SET ${fields.join(', ')}
     WHERE id = $${p} AND entity_id = $${p + 1} AND user_id = $${p + 2} RETURNING *`,
    values
  );
  return r.rows[0] as Project || null;
}

export async function archiveProject(projectId: string, userId: string, entityId: string): Promise<Project | null> {
  return updateProject(projectId, userId, entityId, { status: 'archived' });
}
