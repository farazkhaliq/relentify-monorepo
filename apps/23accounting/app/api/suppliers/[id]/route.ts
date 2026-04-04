import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getSupplierById, updateSupplier, deleteSupplier } from '@/src/lib/supplier.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { checkPermission } from '@/src/lib/workspace-auth';
import { query } from '@/src/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    const { id } = await params;
    const supplier = await getSupplierById(id, auth.userId, entity?.id);
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    return NextResponse.json({ supplier });
  } catch (e) {
    console.error('Get supplier error:', e);
    return NextResponse.json({ error: 'Failed to get supplier' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'suppliers', 'manage');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    const { id } = await params;
    const { name, email, phone, address, notes } = await req.json();
    if (!name || !name.trim()) return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });

    const supplier = await updateSupplier(id, auth.userId, {
      name: name.trim(),
      email: email?.trim() || undefined,
      phone: phone?.trim() || undefined,
      address: address?.trim() || undefined,
      notes: notes?.trim() || undefined,
    }, entity?.id);

    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    return NextResponse.json({ supplier });
  } catch (e) {
    console.error('Update supplier error:', e);
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'suppliers', 'manage');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    const { id } = await params;

    // Check for bills linked by name
    const supplier = await getSupplierById(id, auth.userId, entity?.id);
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    const bills = await query(
      `SELECT id FROM acc_bills WHERE user_id = $1 AND supplier_name = $2 LIMIT 1`,
      [auth.userId, supplier.name]
    );
    if (bills.rowCount && bills.rowCount > 0) {
      return NextResponse.json({ error: 'Cannot delete — acc_bills exist for this supplier' }, { status: 409 });
    }

    const success = await deleteSupplier(id, auth.userId, entity?.id ?? '');
    if (!success) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Delete supplier error:', e);
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 });
  }
}
