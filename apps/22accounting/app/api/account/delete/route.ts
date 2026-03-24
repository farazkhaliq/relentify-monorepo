import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { query } from '@/src/lib/db';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { password } = await req.json();
  if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 });

  // Verify password before deleting
  const result = await query(`SELECT password_hash FROM users WHERE id = $1`, [auth.userId]);
  if (!result.rows.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const valid = await bcrypt.compare(password, result.rows[0].password_hash);
  if (!valid) return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });

  // Delete user data (cascades handle most relations, explicit order for safety)
  await query(`DELETE FROM accountant_clients WHERE client_user_id = $1 OR accountant_user_id = $1`, [auth.userId]);
  await query(`DELETE FROM entities WHERE user_id = $1`, [auth.userId]);
  await query(`DELETE FROM users WHERE id = $1`, [auth.userId]);

  // Clear auth cookie
  const cookieStore = await cookies();
  cookieStore.delete('relentify_token');

  return NextResponse.json({ ok: true });
}
