import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { calculateVatReturn } from '@/src/lib/hmrc.service';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 });

  try {
    const boxes = await calculateVatReturn(auth.userId, from, to, entity.id);
    return NextResponse.json(boxes);
  } catch (e) {
    console.error('VAT calculate error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
