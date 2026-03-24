'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  PageHeader, 
  Card, 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow, 
  Badge, 
  Button, 
  FilterGroup 
} from '@relentify/ui';
import { FileText, Plus } from 'lucide-react';

const SC: Record<string, any> = {
  draft:     'neutral',
  sent:      'warning',
  paid:      'success',
  overdue:   'danger',
  cancelled: 'neutral',
};

const FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'Outstanding', value: 'outstanding' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Overdue', value: 'overdue' },
];

type Invoice = { id: string; invoice_number: string; client_name: string; due_date: string; total: string | number; status: string; };

function InvoicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') || 'all';
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/invoices')
      .then(r => r.json())
      .then(d => { if (d.invoices) setInvoices(d.invoices); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = invoices.filter(inv => {
    if (filter === 'all') return true;
    if (filter === 'outstanding') return ['sent', 'draft', 'overdue'].includes(inv.status);
    return inv.status === filter;
  });

  return (
    <main className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader 
          supertitle="SALES" 
          title="Invoices" 
          className="mb-0"
        />
        <Link href="/dashboard/invoices/new" className="no-underline">
          <Button className="uppercase tracking-widest text-xs font-black px-8 h-12">
            <Plus size={16} className="mr-2" /> New Invoice
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <FilterGroup 
          options={FILTER_OPTIONS}
          selectedValue={filter}
          onValueChange={(val) => router.push(`/dashboard/invoices${val === 'all' ? '' : `?filter=${val}`}`)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-[var(--theme-accent)]/20 border-t-[var(--theme-accent)] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 sm:p-20 text-center bg-transparent border-dashed border-2">
          <div className="w-20 h-20 bg-[var(--theme-accent)]/10 rounded-cinematic flex items-center justify-center mx-auto mb-8">
            <FileText className="w-10 h-10 text-[var(--theme-accent)]" />
          </div>
          <h4 className="text-[var(--theme-text)] font-black text-xl mb-3 uppercase tracking-wider">
            {filter === 'all' ? 'No invoices found' : `No ${filter} invoices`}
          </h4>
          <p className="text-[var(--theme-text-dim)] text-sm mb-10 max-w-sm mx-auto">
            {filter === 'all' 
              ? 'Start by creating your first invoice to get paid.' 
              : 'Try changing your filters or create a new invoice.'}
          </p>
          {filter === 'all' ? (
            <Link href="/dashboard/invoices/new" className="no-underline">
              <Button className="px-10 h-12 uppercase tracking-[0.2em] font-black">Create Your First Invoice</Button>
            </Link>
          ) : (
            <Button variant="outline" onClick={() => router.push('/dashboard/invoices')} className="px-10 h-12 uppercase tracking-[0.2em] font-black">
              Clear Filter
            </Button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--theme-border)]/[0.05] border-none">
                <TableHead className="uppercase tracking-widest font-black text-[10px] py-5 px-8">Invoice</TableHead>
                <TableHead className="uppercase tracking-widest font-black text-[10px] py-5">Client</TableHead>
                <TableHead className="uppercase tracking-widest font-black text-[10px] py-5">Due Date</TableHead>
                <TableHead className="uppercase tracking-widest font-black text-[10px] py-5 text-right">Amount</TableHead>
                <TableHead className="uppercase tracking-widest font-black text-[10px] py-5 text-center px-8">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => (
                <TableRow 
                  key={inv.id} 
                  className="group border-b border-[var(--theme-border)]/50 last:border-none cursor-pointer hover:bg-[var(--theme-border)]/20 transition-colors"
                  onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                >
                  <TableCell className="py-5 px-8 font-black text-[var(--theme-accent)]">
                    {inv.invoice_number}
                  </TableCell>
                  <TableCell className="py-5 font-bold text-[var(--theme-text)]">{inv.client_name}</TableCell>
                  <TableCell className="py-5 text-[var(--theme-text-dim)] font-mono text-xs">
                    {new Date(inv.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="py-5 text-right font-black text-[var(--theme-text)]">
                    £{Number(inv.total).toFixed(2)}
                  </TableCell>
                  <TableCell className="py-5 text-center px-8">
                    <Badge variant={SC[inv.status] || 'neutral'} className="uppercase tracking-widest text-[9px] font-black px-3">
                      {inv.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </main>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-[var(--theme-accent)]/20 border-t-[var(--theme-accent)] rounded-full animate-spin" /></div>}>
      <InvoicesContent />
    </Suspense>
  );
}
