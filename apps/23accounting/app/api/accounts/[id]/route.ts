import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import {
  updateAccount,
  deactivateAccount,
} from '@/src/lib/chart_of_accounts.service';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'coa', 'manage');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const body = await req.json();
    const account = await updateAccount(id, entity.id, {
      name: body.name,
      description: body.description,
    });
    return NextResponse.json({ account });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update account';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied2 = checkPermission(auth, 'coa', 'manage');
    if (denied2) return denied2;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    await deactivateAccount(id, entity.id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to deactivate account';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
