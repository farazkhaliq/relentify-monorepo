import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { canAccess } from '@/src/lib/tiers';
import { deleteAttachment, getAttachmentFile } from '@/src/lib/attachment.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  // Serve file bytes — used by Postgres storage backend
  try {
    const auth = await getAuthUser();
    if (!auth) return new NextResponse('Unauthorized', { status: 401 });

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return new NextResponse('No active entity', { status: 400 });

    const { id } = await params;
    const file = await getAttachmentFile(id, entity.id);
    if (!file) return new NextResponse('Not found', { status: 404 });

    return new NextResponse(file.buffer, {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.fileName)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (e) {
    console.error('GET attachment file error:', e);
    return new NextResponse('Failed', { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'capture_bills_receipts')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const { id } = await params;
    const deleted = await deleteAttachment(id, entity.id, auth.userId);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE attachment error:', e);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}
