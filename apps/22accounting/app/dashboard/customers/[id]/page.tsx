import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/lib/auth';
import { getCustomerById } from '@/src/lib/customer.service';
import { getInvoicesByCustomer } from '@/src/lib/invoice.service';
import CustomerDetailView from '@/src/components/CustomerDetailView';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth) redirect('/login');

  const { id } = await params;
  const customer = await getCustomerById(id, auth.userId);
  if (!customer) redirect('/dashboard/customers');

  // fetch invoices using explicit customer ID instead of name
  const invoices = await getInvoicesByCustomer(auth.userId, customer.id);

  const stats = {
    totalInvoiced: invoices.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0),
    totalPaid: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0),
    outstanding: invoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0),
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 py-10">
        <CustomerDetailView customer={customer} invoices={invoices} stats={stats} />
      </main>
    </div>
  );
}
