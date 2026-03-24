import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { canAccess } from '@/src/lib/tiers';
import { createAttachment, getAttachments, type RecordType } from '@/src/lib/attachment.service';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB upload cap (compressed result will be much smaller)

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'capture_bills_receipts')) {
      return NextResponse.json({ error: 'Upgrade to Small Business to use file attachments' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const recordType = searchParams.get('recordType') as RecordType | null;
    const recordId = searchParams.get('recordId');
    if (!recordType || !recordId) {
      return NextResponse.json({ error: 'recordType and recordId are required' }, { status: 400 });
    }

    const attachments = await getAttachments(entity.id, recordType, recordId);
    return NextResponse.json({ attachments });
  } catch (e) {
    console.error('GET attachments error:', e);
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'capture_bills_receipts')) {
      return NextResponse.json({ error: 'Upgrade to Small Business to use file attachments' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const recordType = formData.get('recordType') as RecordType | null;
    const recordId = formData.get('recordId') as string | null;

    if (!file || !recordType || !recordId) {
      return NextResponse.json({ error: 'file, recordType, and recordId are required' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only PDF, JPEG, PNG, or WEBP files are allowed' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File must be under 20MB' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const attachment = await createAttachment({
      entityId: entity.id,
      recordType,
      recordId,
      fileBuffer,
      fileName: file.name,
      originalMimeType: file.type,
      uploadedBy: auth.userId,
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (e) {
    console.error('POST attachment error:', e);
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
  }
}
