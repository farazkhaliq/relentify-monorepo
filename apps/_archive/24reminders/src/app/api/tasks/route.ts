import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getTasks, createTask } from '@/lib/task.service';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const listId = searchParams.get('listId');
  if (!listId) return NextResponse.json({ error: 'Missing listId' }, { status: 400 });

  const tasks = await getTasks(listId, user.userId);
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const task = await createTask(body, user.userId);
  return NextResponse.json(task);
}
