import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/lib/auth';
import { getAllCustomers } from '@/src/lib/customer.service';
import Link from 'next/link';
import { 
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell, 
  Card, Button, PageHeader 
} from '@relentify/ui';

export default async function CustomersPage() {
  const auth = await getAuthUser();
  if (!auth) redirect('/login');
  const customers = await getAllCustomers(auth.userId);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <PageHeader
        title="Customers"
        actions={
          <Button asChild variant="primary" className="rounded-cinematic text-[10px] uppercase tracking-widest font-black">
            <Link href="/dashboard/customers/new">+ New Customer</Link>
          </Button>
        }
      />

      {customers.length === 0 ? (
        <Card variant="default" padding="lg" className="text-center py-16">
          <div className="w-16 h-16 bg-[var(--theme-accent)]/10 rounded-cinematic flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[var(--theme-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-[var(--theme-text)] font-black text-lg mb-2">No customers yet</p>
          <p className="text-[var(--theme-text-muted)] text-sm mb-8">Add customers to speed up invoice creation</p>
          <Button asChild variant="primary" className="rounded-cinematic text-[10px] uppercase tracking-widest font-black px-8">
            <Link href="/dashboard/customers/new">Add First Customer</Link>
          </Button>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="md:hidden divide-y divide-[var(--theme-border)]">
            {customers.map(customer => (
              <Link key={customer.id} href={`/dashboard/customers/${customer.id}`} className="block p-4 no-underline hover:bg-[var(--theme-border)]/30 transition-colors">
                <p className="text-[var(--theme-text)] font-black text-sm mb-1">{customer.name}</p>
                {customer.email && <p className="text-[var(--theme-text-muted)] text-xs mb-0.5">{customer.email}</p>}
                {customer.phone && <p className="text-[var(--theme-text-dim)] text-xs">{customer.phone}</p>}
              </Link>
            ))}
          </div>
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Company</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map(customer => (
                <TableRow key={customer.id} className="cursor-pointer group">
                  <TableCell>
                    <Link href={`/dashboard/customers/${customer.id}`} className="block w-full h-full text-[var(--theme-text)] font-black no-underline">
                      {customer.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[var(--theme-text-muted)]">{customer.email || '—'}</TableCell>
                  <TableCell className="text-[var(--theme-text-muted)]">{customer.phone || '—'}</TableCell>
                  <TableCell className="text-[var(--theme-text-muted)]">{(customer as any).company || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </main>
  );
}
