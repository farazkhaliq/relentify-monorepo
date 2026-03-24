import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/lib/auth';
import { getSupplierById } from '@/src/lib/supplier.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { query } from '@/src/lib/db';
import SupplierDetailView from '@/src/components/SupplierDetailView';

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth) redirect('/login');

  const { id } = await params;
  const entity = await getActiveEntity(auth.userId);
  const supplier = await getSupplierById(id, auth.userId, entity?.id);
  if (!supplier) redirect('/dashboard/suppliers');

  const billsResult = await query(
    `SELECT id, supplier_name, amount, currency, status, invoice_date, due_date, reference
     FROM bills WHERE user_id = $1 AND supplier_name = $2 ORDER BY invoice_date DESC`,
    [auth.userId, supplier.name]
  );
  const bills = billsResult.rows;

  const totalBilled = bills.reduce((s: number, b: any) => s + parseFloat(b.amount || 0), 0);
  const totalPaid = bills.filter((b: any) => b.status === 'paid').reduce((s: number, b: any) => s + parseFloat(b.amount || 0), 0);
  const outstanding = totalBilled - totalPaid;

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 py-10">
        <SupplierDetailView supplier={supplier} bills={bills} stats={{ totalBilled, totalPaid, outstanding }} />
      </main>
    </div>
  );
}
