import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { updateCustomer, deleteCustomer, getCustomerById } from '@/src/lib/customer.service';
import { getInvoicesByCustomer } from '@/src/lib/invoice.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    const { id } = await params;
    const customer = await getCustomerById(id, auth.userId, entity?.id);
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    return NextResponse.json({ customer });
  } catch (e) {
    console.error('Get customer error:', e);
    return NextResponse.json({ error: 'Failed to get customer' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'customers', 'manage');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    const { id } = await params;
    const body = await req.json();
    const { name, email, phone, address, notes } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    const customer = await updateCustomer(id, auth.userId, {
      name: name.trim(),
      email: email?.trim() || undefined,
      phone: phone?.trim() || undefined,
      address: address?.trim() || undefined,
      notes: notes?.trim() || undefined,
    }, entity?.id);

    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    return NextResponse.json({ customer });
  } catch (e) {
    console.error('Update customer error:', e);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'customers', 'manage');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    const { id } = await params;

    const invoices = await getInvoicesByCustomer(auth.userId, id, entity?.id);
    if (invoices.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${invoices.length} invoice${invoices.length !== 1 ? 's' : ''} on record` },
        { status: 409 }
      );
    }

    const success = await deleteCustomer(id, auth.userId, entity?.id);
    if (!success) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Delete customer error:', e);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
