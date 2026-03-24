import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { createSupplier, getAllSuppliers } from '@/src/lib/supplier.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ suppliers: [] });
    const suppliers = await getAllSuppliers(auth.userId, entity.id);
    return NextResponse.json({ suppliers });
  } catch (e) {
    console.error('Get suppliers error:', e);
    return NextResponse.json({ error: 'Failed to get suppliers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'bills', 'manage');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const { name, email, phone, address, notes } = await req.json();
    if (!name || !name.trim()) return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });

    const supplier = await createSupplier({
      userId: auth.userId,
      entityId: entity.id,
      name: name.trim(),
      email: email?.trim() || undefined,
      phone: phone?.trim() || undefined,
      address: address?.trim() || undefined,
      notes: notes?.trim() || undefined,
    });
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (e) {
    console.error('Create supplier error:', e);
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}
