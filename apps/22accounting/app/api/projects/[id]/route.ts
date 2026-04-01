import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getProjectById, updateProject, deleteProject, getProjectInvoices, getProjectBills } from '@/src/lib/project.service';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const { id } = await params;
    const [project, invoices, bills] = await Promise.all([
      getProjectById(id, auth.userId, entity.id),
      getProjectInvoices(id, auth.userId),
      getProjectBills(id, auth.userId),
    ]);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ project, invoices, bills });
  } catch (e) {
    console.error('GET project error:', e);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const denied = checkPermission(auth, 'projects', 'manage');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const { id } = await params;
    const body = await req.json();
    const project = await updateProject(id, auth.userId, entity.id, body);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ project });
  } catch (e) {
    console.error('PATCH project error:', e);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const { id } = await params;
    const deleted = await deleteProject(id, auth.userId, entity.id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE project error:', e);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
