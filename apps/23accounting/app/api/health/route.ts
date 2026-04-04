import { NextResponse } from 'next/server';
import pool from '@/src/lib/db';
export async function GET() {
  try { await pool.query('SELECT 1'); return NextResponse.json({ status:'healthy', database:'connected', ts: new Date().toISOString() }); }
  catch { return NextResponse.json({ status:'unhealthy', database:'disconnected' }, { status: 503 }); }
}
