// app/api/migration/server-parse/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { XeroParser } from '@/src/lib/migration/xero.parser';
import { QuickBooksParser } from '@/src/lib/migration/quickbooks.parser';

export const runtime = 'nodejs';

const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const VALID_MIME = new Set(['text/csv', 'text/plain', 'application/octet-stream']);

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'platform_migration')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const formData = await req.formData();
    const sourceId = formData.get('sourceId') as string;
    const cutoffDate = formData.get('cutoffDate') as string;

    if (!['xero', 'quickbooks'].includes(sourceId)) {
      return NextResponse.json({ error: 'Invalid sourceId' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate ?? '')) {
      return NextResponse.json({ error: 'Invalid cutoffDate' }, { status: 400 });
    }

    const files: File[] = [];
    let totalBytes = 0;
    for (const [, value] of formData.entries()) {
      if (value instanceof File) {
        const mime = value.type || 'application/octet-stream';
        const ext = value.name.split('.').pop()?.toLowerCase() ?? '';
        if (!VALID_MIME.has(mime) && !['csv', 'iif'].includes(ext)) {
          return NextResponse.json({ error: `File "${value.name}" is not a valid CSV or IIF file` }, { status: 400 });
        }
        totalBytes += value.size;
        if (totalBytes > MAX_TOTAL_BYTES) {
          return NextResponse.json({ error: 'Total file size exceeds 25MB limit' }, { status: 413 });
        }
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const parser = sourceId === 'xero' ? new XeroParser() : new QuickBooksParser();
    const data = await parser.parse(files, cutoffDate);

    return NextResponse.json({ data });

  } catch (err: any) {
    console.error('[migration/server-parse]', err);
    return NextResponse.json({ error: err.message || 'Parse failed' }, { status: 500 });
  }
}
