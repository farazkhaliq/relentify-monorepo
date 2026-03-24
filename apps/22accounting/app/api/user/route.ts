import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { query } from '@/src/lib/db';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const r = await query(
    'SELECT id, email, full_name, business_name, vat_registered, vat_number, business_structure, hmrc_access_token, registered_address, bank_account_name, sort_code, account_number FROM users WHERE id=$1',
    [auth.userId]
  );
  if (!r.rows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ user: r.rows[0] });
}
