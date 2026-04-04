'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, ArrowRight } from 'lucide-react';
import type { ForecastInvoice, ForecastBill } from '@/src/lib/dashboard.service';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── modal shell ──────────────────────────────────────────────────────────────

function Modal({
  title,
  total,
  onClose,
  children,
}: {
  title: string;
  total: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[var(--theme-background)]/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--theme-border)]">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-0.5">
              30-day Forecast
            </p>
            <h3 className="text-base font-black text-[var(--theme-text)] uppercase tracking-wide">
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xl font-black text-[var(--theme-accent)] tabular-nums">
              {fmt(total)}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--theme-border)]/50 text-[var(--theme-text-dim)] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── invoice drill-down ───────────────────────────────────────────────────────

function InvoiceList({ invoices }: { invoices: ForecastInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <p className="px-6 py-8 text-center text-[var(--theme-text-dim)] text-sm">
        No invoices due in the next 30 days.
      </p>
    );
  }
  return (
    <div className="divide-y divide-[var(--theme-border)]/50">
      {invoices.map(inv => (
        <Link
          key={inv.id}
          href={`/dashboard/invoices/${inv.id}`}
          className="no-underline flex items-center justify-between px-6 py-4 hover:bg-[var(--theme-accent)]/5 transition-colors group"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-bold text-[var(--theme-accent)] mb-0.5">
              {inv.invoice_number}
            </p>
            <p className="text-sm font-bold text-[var(--theme-text)] truncate">
              {inv.client_name}
            </p>
            <p className="text-[10px] text-[var(--theme-text-dim)] mt-0.5">
              Due {fmtDate(inv.due_date)}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <span className="text-base font-black text-[var(--theme-text)] tabular-nums">
              {fmt(inv.total)}
            </span>
            <ArrowRight
              size={12}
              className="text-[var(--theme-text-dim)] group-hover:text-[var(--theme-accent)] transition-colors"
            />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── bill drill-down ──────────────────────────────────────────────────────────

function BillList({ bills }: { bills: ForecastBill[] }) {
  if (bills.length === 0) {
    return (
      <p className="px-6 py-8 text-center text-[var(--theme-text-dim)] text-sm">
        No bills due in the next 30 days.
      </p>
    );
  }
  return (
    <div className="divide-y divide-[var(--theme-border)]/50">
      {bills.map(bill => (
        <Link
          key={bill.id}
          href={`/dashboard/bills/${bill.id}`}
          className="no-underline flex items-center justify-between px-6 py-4 hover:bg-[var(--theme-accent)]/5 transition-colors group"
        >
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--theme-text)] truncate">
              {bill.supplier_name || bill.description || 'Bill'}
            </p>
            <p className="text-[10px] text-[var(--theme-text-dim)] mt-0.5">
              Due {fmtDate(bill.due_date)}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <span className="text-base font-black text-[var(--theme-text)] tabular-nums">
              {fmt(bill.amount)}
            </span>
            <ArrowRight
              size={12}
              className="text-[var(--theme-text-dim)] group-hover:text-[var(--theme-accent)] transition-colors"
            />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── exported component ───────────────────────────────────────────────────────

export function ForecastCard({
  bankBalance,
  forecastIncome,
  forecastSpend,
  forecastInvoices,
  forecastBills,
}: {
  bankBalance: number;
  forecastIncome: number;
  forecastSpend: number;
  forecastInvoices: ForecastInvoice[];
  forecastBills: ForecastBill[];
}) {
  const [open, setOpen] = useState<'income' | 'spend' | null>(null);
  const forecastEnd = bankBalance + forecastIncome - forecastSpend;
  const forecastEndClass =
    forecastEnd >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]';

  function fmt(n: number) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(n);
  }

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        {/* Start */}
        <div>
          <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--theme-text-dim)] mb-1.5">
            Start
          </p>
          <p className="text-lg font-black text-[var(--theme-text)] tabular-nums">
            {fmt(bankBalance)}
          </p>
        </div>

        <ArrowRight size={14} className="text-[var(--theme-text-dim)] shrink-0 self-end mb-1" />

        {/* Income — clickable */}
        <button
          onClick={() => setOpen('income')}
          className="text-left group cursor-pointer"
        >
          <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--theme-text-dim)] mb-1.5">
            + Income
          </p>
          <p className="text-lg font-black text-[var(--theme-accent)] tabular-nums group-hover:underline underline-offset-4 decoration-dotted">
            +{fmt(forecastIncome)}
          </p>
        </button>

        <ArrowRight size={14} className="text-[var(--theme-text-dim)] shrink-0 self-end mb-1" />

        {/* Spend — clickable */}
        <button
          onClick={() => setOpen('spend')}
          className="text-left group cursor-pointer"
        >
          <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--theme-text-dim)] mb-1.5">
            − Spend
          </p>
          <p className="text-lg font-black text-[var(--theme-destructive)] tabular-nums group-hover:underline underline-offset-4 decoration-dotted">
            -{fmt(forecastSpend)}
          </p>
        </button>

        <ArrowRight size={14} className="text-[var(--theme-text-dim)] shrink-0 self-end mb-1" />

        {/* End */}
        <div>
          <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--theme-text-dim)] mb-1.5">
            End
          </p>
          <p className={`text-2xl font-black tabular-nums ${forecastEndClass}`}>
            {fmt(forecastEnd)}
          </p>
        </div>
      </div>

      {/* Modals */}
      {open === 'income' && (
        <Modal title="Expected Income" total={forecastIncome} onClose={() => setOpen(null)}>
          <InvoiceList invoices={forecastInvoices} />
        </Modal>
      )}
      {open === 'spend' && (
        <Modal title="Expected Spend" total={forecastSpend} onClose={() => setOpen(null)}>
          <BillList bills={forecastBills} />
        </Modal>
      )}
    </>
  );
}
