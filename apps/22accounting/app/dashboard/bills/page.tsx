'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { 
  Button, 
  PageHeader, 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow, 
  Badge, 
  Card,
  cn 
} from '@relentify/ui';
import { Receipt, Plus } from 'lucide-react';

const SC: Record<string, any> = {
  unpaid:  'warning',
  paid:    'success',
  overdue: 'danger',
};

const FILTER_LABELS: Record<string, string> = { all: 'All', unpaid: 'Unpaid', paid: 'Paid', overdue: 'Overdue' };

type Bill = { id: string; supplier_name: string; amount: string; currency: string; due_date: string; category: string; status: string; };

function BillsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') || 'all';
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/bills').then(r => r.json()).then(d => { if (d.bills) setBills(d.bills); }).finally(() => setLoading(false));
  }, []);

  const filtered = bills.filter(b => filter === 'all' || b.status === filter);

  const currencySymbol: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$' };

  return (
    <main className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader 
          supertitle="ACCOUNTING" 
          title="Bills" 
          className="mb-0" 
        />
        <Button onClick={() => router.push('/dashboard/bills/new')} className="uppercase tracking-widest text-xs font-black px-8 h-12">
          <Plus size={16} className="mr-2" /> New Bill
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {Object.keys(FILTER_LABELS).map(f => (
          <button 
            key={f} 
            onClick={() => router.push(`/dashboard/bills${f === 'all' ? '' : `?filter=${f}`}`)}
            className={cn(
              "shrink-0 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
              filter === f 
                ? "bg-[var(--theme-accent)] text-[var(--theme-text)] border-[var(--theme-accent)]"
                : "bg-[var(--theme-card)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:text-[var(--theme-text)] hover:border-[var(--theme-accent)]/50"
            )}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-[var(--theme-accent)]/20 border-t-[var(--theme-accent)] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 sm:p-20 text-center bg-transparent border-dashed border-2">
          <div className="w-20 h-20 bg-[var(--theme-accent)]/10 rounded-cinematic flex items-center justify-center mx-auto mb-8">
            <Receipt className="w-10 h-10 text-[var(--theme-accent)]" />
          </div>
          <h4 className="text-[var(--theme-text)] font-black text-xl mb-3 uppercase tracking-wider">
            {filter === 'all' ? 'No bills yet' : `No ${filter} bills`}
          </h4>
          <p className="text-[var(--theme-text-dim)] text-sm mb-10 max-w-sm mx-auto">
            {filter === 'all' 
              ? 'Add your first supplier bill to track expenses.' 
              : 'Try changing your filters or add a new bill.'}
          </p>
          <Button onClick={() => router.push('/dashboard/bills/new')} className="px-10 h-12 uppercase tracking-[0.2em] font-black">
            Add Your First Bill
          </Button>
        </Card>
      ) : (
        <>
          <div className="md:hidden space-y-4">
            {filtered.map(bill => (
              <Link key={bill.id} href={`/dashboard/bills/${bill.id}`} className="block bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6 no-underline hover:bg-[var(--theme-accent)]/[0.02] transition-colors active:scale-[0.99] shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[var(--theme-text)] font-black text-sm uppercase tracking-tight">{bill.supplier_name}</span>
                  <Badge variant={SC[bill.status] || 'neutral'} className="uppercase tracking-widest text-[9px] font-black px-3">
                    {bill.status}
                  </Badge>
                </div>
                <p className="text-[var(--theme-text-muted)] text-xs mb-3 capitalize">{bill.category}</p>
                <div className="flex items-center justify-between pt-3 border-t border-[var(--theme-border)]">
                  <span className="text-[var(--theme-text-dim)] text-[10px] font-mono uppercase">Due {new Date(bill.due_date).toLocaleDateString('en-GB')}</span>
                  <span className="text-[var(--theme-text)] font-black text-base">{currencySymbol[bill.currency] || '£'}{Number(bill.amount).toFixed(2)}</span>
                </div>
              </Link>
            ))}
          </div>
          <Card className="hidden md:block overflow-hidden shadow-cinematic">
            <Table>
              <TableHeader>
                <TableRow className="bg-[var(--theme-border)]/[0.05] border-none">
                  <TableHead className="uppercase tracking-widest font-black text-[10px] py-5 px-8">Supplier</TableHead>
                  <TableHead className="uppercase tracking-widest font-black text-[10px] py-5">Category</TableHead>
                  <TableHead className="uppercase tracking-widest font-black text-[10px] py-5">Due Date</TableHead>
                  <TableHead className="uppercase tracking-widest font-black text-[10px] py-5 text-right">Amount</TableHead>
                  <TableHead className="uppercase tracking-widest font-black text-[10px] py-5 text-center px-8">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(bill => (
                  <TableRow 
                    key={bill.id} 
                    onClick={() => router.push(`/dashboard/bills/${bill.id}`)} 
                    className="group border-b border-[var(--theme-border)]/50 last:border-none cursor-pointer hover:bg-[var(--theme-border)]/20 transition-colors"
                  >
                    <TableCell className="px-8 py-5 text-[var(--theme-accent)] font-black text-sm uppercase tracking-tight">
                      {bill.supplier_name}
                    </TableCell>
                    <TableCell className="py-5 text-[var(--theme-text-muted)] text-sm capitalize">
                      {bill.category}
                    </TableCell>
                    <TableCell className="py-5 text-[var(--theme-text-muted)] text-sm font-mono font-bold uppercase tracking-tight">
                      {new Date(bill.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="py-5 text-right text-[var(--theme-text)] font-black text-sm">
                      {currencySymbol[bill.currency] || '£'}{Number(bill.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="py-5 text-center px-8">
                      <Badge variant={SC[bill.status] || 'neutral'} className="uppercase tracking-widest text-[9px] font-black px-3">
                        {bill.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </main>
  );
}

export default function BillsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-[var(--theme-accent)]/20 border-t-[var(--theme-accent)] rounded-full animate-spin" /></div>}>
      <BillsContent />
    </Suspense>
  );
}
