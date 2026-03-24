import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getProjectsByEntity, createProject } from '@/src/lib/project.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const projects = await getProjectsByEntity(auth.userId, entity.id);
    return NextResponse.json({ projects });
  } catch (e) {
    console.error('GET projects error:', e);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'project_tracking')) {
      return NextResponse.json({ error: 'Upgrade to Small Business to use project tracking' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const body = await req.json();
    const { name, description, customerId, budget, currency, startDate, endDate } = body;

    if (!name?.trim()) return NextResponse.json({ error: 'Project name is required' }, { status: 400 });

    const project = await createProject(auth.userId, entity.id, {
      name: name.trim(),
      description,
      customerId,
      budget: budget ? parseFloat(budget) : undefined,
      currency,
      startDate,
      endDate,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    console.error('POST projects error:', e);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
