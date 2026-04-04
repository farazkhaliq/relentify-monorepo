import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/lib/auth';
import { getAllSuppliers } from '@/src/lib/supplier.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import Link from 'next/link';
import { 
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell, 
  Card, Button, PageHeader 
} from '@relentify/ui';

export default async function SuppliersPage() {
  const auth = await getAuthUser();
  if (!auth) redirect('/login');
  const entity = await getActiveEntity(auth.userId);
  const suppliers = entity ? await getAllSuppliers(auth.userId, entity.id) : [];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <PageHeader
        title="Suppliers"
        actions={
          <Button asChild variant="primary" className="rounded-cinematic text-[10px] uppercase tracking-widest font-black">
            <Link href="/dashboard/suppliers/new">+ New Supplier</Link>
          </Button>
        }
      />

      {suppliers.length === 0 ? (
        <Card variant="default" padding="lg" className="text-center py-16">
          <div className="w-16 h-16 bg-[var(--theme-accent)]/10 rounded-cinematic flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[var(--theme-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-[var(--theme-text)] font-black text-lg mb-2">No suppliers yet</p>
          <p className="text-[var(--theme-text-muted)] text-sm mb-8">Add suppliers to speed up bill entry</p>
          <Button asChild variant="primary" className="rounded-cinematic text-[10px] uppercase tracking-widest font-black px-8">
            <Link href="/dashboard/suppliers/new">Add First Supplier</Link>
          </Button>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="md:hidden divide-y divide-[var(--theme-border)]">
            {suppliers.map(s => (
              <Link key={s.id} href={`/dashboard/suppliers/${s.id}`} className="block p-4 no-underline hover:bg-[var(--theme-border)]/30 transition-colors">
                <p className="text-[var(--theme-text)] font-black text-sm mb-1">{s.name}</p>
                {s.email && <p className="text-[var(--theme-text-muted)] text-xs mb-0.5">{s.email}</p>}
                {s.phone && <p className="text-[var(--theme-text-dim)] text-xs">{s.phone}</p>}
              </Link>
            ))}
          </div>
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map(s => (
                <TableRow key={s.id} className="cursor-pointer group">
                  <TableCell>
                    <Link href={`/dashboard/suppliers/${s.id}`} className="block w-full h-full text-[var(--theme-text)] font-black no-underline">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[var(--theme-text-muted)]">{s.email || '—'}</TableCell>
                  <TableCell className="text-[var(--theme-text-muted)]">{s.phone || '—'}</TableCell>
                  <TableCell className="text-[var(--theme-text-muted)]">{s.address || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </main>
  );
}
