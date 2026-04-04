import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { createCustomer, getAllCustomers } from '@/src/lib/customer.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    const customers = await getAllCustomers(auth.userId, entity?.id);
    return NextResponse.json({ customers });
  } catch (e) {
    console.error('Get customers error:', e);
    return NextResponse.json({ error: 'Failed to get customers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'customers', 'manage');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const body = await req.json();
    const { name, email, phone, address, notes } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    const customer = await createCustomer({
      userId: auth.userId,
      entityId: entity.id,
      name: name.trim(),
      email: email?.trim() || undefined,
      phone: phone?.trim() || undefined,
      address: address?.trim() || undefined,
      notes: notes?.trim() || undefined,
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (e) {
    console.error('Create customer error:', e);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}
