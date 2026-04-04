import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { query } from '@/src/lib/db';
import { getUserById } from '@/src/lib/user.service';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.userType !== 'accountant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const user = await getUserById(auth.userId);
  return NextResponse.json({
    accountant_bank_account_name: user?.accountant_bank_account_name ?? null,
    accountant_sort_code: user?.accountant_sort_code ?? null,
    accountant_account_number: user?.accountant_account_number ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.userType !== 'accountant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { accountant_bank_account_name, accountant_sort_code, accountant_account_number } = await req.json();

  await query(
    `UPDATE users SET
       accountant_bank_account_name = $1,
       accountant_sort_code = $2,
       accountant_account_number = $3
     WHERE id = $4`,
    [accountant_bank_account_name || null, accountant_sort_code || null, accountant_account_number || null, auth.userId]
  );

  return NextResponse.json({ ok: true });
}
