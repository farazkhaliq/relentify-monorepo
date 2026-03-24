import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import {
  getChartOfAccounts,
  createAccount,
} from '@/src/lib/chart_of_accounts.service';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const accounts = await getChartOfAccounts(entity.id);
    return NextResponse.json({ accounts });
  } catch (e) {
    console.error('GET accounts error:', e);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const body = await req.json();
    const { code, name, accountType, description } = body;

    if (!code || !name || !accountType) {
      return NextResponse.json({ error: 'code, name, and accountType are required' }, { status: 400 });
    }

    const account = await createAccount(entity.id, {
      code: parseInt(code),
      name,
      accountType,
      description,
    });
    return NextResponse.json({ account }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create account';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
