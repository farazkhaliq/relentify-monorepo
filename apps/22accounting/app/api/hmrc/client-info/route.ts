import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { query } from '@/src/lib/db';

// Called from the VAT page to capture real browser data for HMRC fraud prevention headers.
// Stores device ID (stable per-browser) and screen/window/timezone info per user.
export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { deviceId, screens, windowSize, timezone } = await req.json();

  await query(
    `UPDATE users
     SET hmrc_device_id = COALESCE($1, hmrc_device_id),
         hmrc_client_info = $2
     WHERE id = $3`,
    [
      deviceId || null,
      JSON.stringify({ screens, windowSize, timezone }),
      auth.userId,
    ]
  );

  return NextResponse.json({ ok: true });
}
