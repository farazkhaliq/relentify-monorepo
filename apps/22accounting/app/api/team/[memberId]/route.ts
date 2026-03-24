import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { updateMemberPermissions, revokeMember, getMember } from '@/src/lib/team.service';
import { WorkspacePermissions } from '@/src/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const { memberId } = await params;
    const { permissions } = await req.json() as { permissions: WorkspacePermissions };
    if (!permissions) return NextResponse.json({ error: 'permissions required' }, { status: 400 });
    const updated = await updateMemberPermissions(memberId, auth.userId, permissions);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ member: updated });
  } catch (e) {
    console.error('PATCH /api/team/[memberId] error:', e);
    return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const { memberId } = await params;
    const member = await getMember(memberId, auth.userId);
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await revokeMember(memberId, auth.userId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/team/[memberId] error:', e);
    return NextResponse.json({ error: 'Failed to revoke member' }, { status: 500 });
  }
}
