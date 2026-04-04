'use client';
import { useState, useEffect } from 'react';
import { Toaster, toast, DatePicker } from '@relentify/ui';

interface EntityPnL {
  entityId: string;
  entityName: string;
  revenue: number;
  costs: number;
  grossProfit: number;
  intercompanyEliminated: number;
}

interface EntityBS {
  entityId: string;
  entityName: string;
  receivables: number;
  payables: number;
  netPosition: number;
}

interface ConsolidatedData {
  pnl: {
    from: string;
    to: string;
    totalRevenue: number;
    totalCosts: number;
    grossProfit: number;
    netProfit: number;
    intercompanyElimination: number;
    entityBreakdown: EntityPnL[];
  };
  balanceSheet: {
    totalReceivables: number;
    totalPayables: number;
    netPosition: number;
    entityBreakdown: EntityBS[];
  };
}

const fmt = (n: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n);

export default function ConsolidatedReportsPage() {
  const [data, setData] = useState<ConsolidatedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setMonth(0); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/consolidated?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { toast(d.error, 'error'); return; }
        setData(d);
      })
      .catch(() => toast('Failed to load report', 'error'))
      .finally(() => setLoading(false));
  }, [from, to]);

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Consolidated Report</h1>
            <p className="text-sm text-[var(--theme-text-muted)] mt-1">Across all entities, intercompany eliminated</p>
          </div>
          <div className="flex items-center gap-2">
            <DatePicker value={from} onChange={setFrom} className="w-44" />
            <span className="text-[var(--theme-text-muted)] text-sm">to</span>
            <DatePicker value={to} onChange={setTo} className="w-44" />
          </div>
        </div>

        {loading && <div className="text-[var(--theme-text-muted)] text-sm">Loading...</div>}

        {!loading && data && (
          <div className="space-y-6">
            {/* P&L Summary */}
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6">
              <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Profit & Loss</h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-[var(--theme-border)]">
                  <span className="text-sm text-[var(--theme-text-muted)]">Revenue</span>
                  <span className="font-black text-[var(--theme-text)]">{fmt(data.pnl.totalRevenue)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--theme-border)]">
                  <span className="text-sm text-[var(--theme-text-muted)]">Costs</span>
                  <span className="font-black text-[var(--theme-text)]">{fmt(data.pnl.totalCosts)}</span>
                </div>
                {data.pnl.intercompanyElimination > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-[var(--theme-border)]">
                    <span className="text-sm text-[var(--theme-text-muted)]">Intercompany Eliminated</span>
                    <span className="text-[var(--theme-text-muted)] text-sm">({fmt(data.pnl.intercompanyElimination)})</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-3">
                  <span className="font-black text-[var(--theme-text)]">Net Profit</span>
                  <span className={`text-xl font-black ${data.pnl.netProfit >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'}`}>{fmt(data.pnl.netProfit)}</span>
                </div>
              </div>
            </div>

            {/* Balance Sheet */}
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6">
              <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Balance Sheet (Outstanding)</h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-[var(--theme-border)]">
                  <span className="text-sm text-[var(--theme-text-muted)]">Receivables (invoices outstanding)</span>
                  <span className="font-black text-[var(--theme-text)]">{fmt(data.balanceSheet.totalReceivables)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--theme-border)]">
                  <span className="text-sm text-[var(--theme-text-muted)]">Payables (bills outstanding)</span>
                  <span className="font-black text-[var(--theme-text)]">{fmt(data.balanceSheet.totalPayables)}</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="font-black text-[var(--theme-text)]">Net Position</span>
                  <span className={`text-xl font-black ${data.balanceSheet.netPosition >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'}`}>{fmt(data.balanceSheet.netPosition)}</span>
                </div>
              </div>
            </div>

            {/* Entity Breakdown toggle */}
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6">
              <button onClick={() => setShowBreakdown(o => !o)} className="w-full flex items-center justify-between text-left">
                <span className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Entity Breakdown</span>
                <svg className={`w-4 h-4 text-[var(--theme-text-muted)] transition-transform ${showBreakdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showBreakdown && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">
                        <th className="text-left pb-2">Entity</th>
                        <th className="text-right pb-2">Revenue</th>
                        <th className="text-right pb-2">Costs</th>
                        <th className="text-right pb-2">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pnl.entityBreakdown.map(e => (
                        <tr key={e.entityId} className="border-t border-[var(--theme-border)]">
                          <td className="py-2 text-[var(--theme-text-muted)] font-bold">{e.entityName}</td>
                          <td className="py-2 text-right text-[var(--theme-text)]">{fmt(e.revenue)}</td>
                          <td className="py-2 text-right text-[var(--theme-text)]">{fmt(e.costs)}</td>
                          <td className={`py-2 text-right font-black ${e.grossProfit >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'}`}>{fmt(e.grossProfit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
