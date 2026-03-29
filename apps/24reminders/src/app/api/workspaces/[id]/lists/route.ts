import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getLists, createList } from '@/lib/workspace.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const lists = await getLists(id);
  return NextResponse.json(lists);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { name, description } = await req.json();
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

  const list = await createList(id, name, description);
  return NextResponse.json(list);
}
