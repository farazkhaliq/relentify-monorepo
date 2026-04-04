import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { updateTask } from '@/lib/services/reminders/task.service';
import { logAudit } from '@/lib/services/reminders/audit.service';
import pool from '@/lib/pool';

async function getTaskWithWorkspace(id: string) {
  const { rows } = await pool.query(
    `SELECT t.*, l.workspace_id FROM reminders_tasks t
     JOIN reminders_lists l ON t.list_id = l.id
     WHERE t.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const task = await getTaskWithWorkspace(id);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await getTaskWithWorkspace(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const updateFields = Object.keys(body).filter(k => k !== 'id' && k !== 'workspace_id');
  const oldValue: Record<string, any> = {};
  updateFields.forEach(k => { oldValue[k] = existing[k]; });

  const updated = await updateTask(id, body);

  await logAudit(existing.workspace_id, user.userId, 'update', id, oldValue, body);

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await getTaskWithWorkspace(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await pool.query('DELETE FROM reminders_tasks WHERE id = $1', [id]);
  await logAudit(existing.workspace_id, user.userId, 'delete', id, { title: existing.title }, null);

  return NextResponse.json({ ok: true });
}
