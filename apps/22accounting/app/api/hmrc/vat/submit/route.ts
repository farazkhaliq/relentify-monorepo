import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getValidHmrcToken, calculateVatReturn, submitVatReturn } from '@/src/lib/hmrc.service';
import { lockPeriod } from '@/src/lib/period_lock.service';

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await getUserById(auth.userId);
  if (!user?.vat_number) return NextResponse.json({ error: 'VAT number not set' }, { status: 400 });

  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

  const { periodKey, from, to } = await req.json();
  if (!periodKey || !from || !to) return NextResponse.json({ error: 'periodKey, from, to required' }, { status: 400 });

  try {
    const token = await getValidHmrcToken(auth.userId);
    const boxes = await calculateVatReturn(auth.userId, from, to, entity.id);
    const result = await submitVatReturn(user.vat_number, token, req, auth.userId, periodKey, boxes);

    // Auto-lock the filed period
    try {
      await lockPeriod(entity.id, auth.userId, 'vat_filing', from, to,
        `VAT return submitted for period ${from} to ${to}`);
    } catch (lockErr) {
      console.error('Failed to auto-lock period after VAT submission:', lockErr);
      // Non-blocking — submission already succeeded
    }

    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    console.error('VAT submit error:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
