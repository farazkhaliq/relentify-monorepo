import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess, TIER_CONFIG, type Tier } from '@/src/lib/tiers';
import { getDashboardData } from '@/src/lib/dashboard.service';
import { PageHeader, Card, CardContent, Button } from '@relentify/ui';
import UpgradeBanner from '@/src/components/UpgradeBanner';
import { BankBalanceChart, CashflowChart } from '@/src/components/DashboardCharts';
import { ForecastCard } from '@/src/components/ForecastModal';
import { ArrowRight, Landmark, FileX, CreditCard, AlertTriangle } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(n);
}

function pct(current: number, prior: number): string | null {
  if (prior === 0) return null;
  const p = ((current - prior) / Math.abs(prior)) * 100;
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function AlertPill({
  count,
  label,
  href,
  icon: Icon,
}: {
  count: number;
  label: string;
  href: string;
  icon: React.ElementType;
}) {
  if (count === 0) return null;
  return (
    <Link
      href={href}
      className="no-underline inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] hover:border-[var(--theme-accent)]/50 hover:bg-[var(--theme-accent)]/5 transition-all group"
    >
      <Icon size={13} className="text-[var(--theme-destructive)] shrink-0" />
      <span className="text-[11px] font-black text-[var(--theme-text)] tabular-nums">
        {count}
      </span>
      <span className="text-[11px] font-bold text-[var(--theme-text-muted)] uppercase tracking-wider">
        {count === 1 ? label : `${label}s`}
      </span>
      <ArrowRight
        size={11}
        className="text-[var(--theme-text-dim)] group-hover:text-[var(--theme-accent)] transition-colors shrink-0"
      />
    </Link>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const _sp = await searchParams;
  const auth = await getAuthUser();
  if (!auth) redirect('/login');

  const [entity, user] = await Promise.all([
    getActiveEntity(auth.userId),
    getUserById(auth.userId),
  ]);

  if (!entity) redirect('/onboarding');

  const tier = (user?.tier as Tier) || 'invoicing';
  const hasReports = canAccess(tier, 'real_time_reports');

  const data = await getDashboardData(auth.userId, entity.id, {
    hasReports,
    lastFYEndDate: entity.last_fy_end_date,
  });

  const netPosition = data.bankBalance + data.totalReceivables - data.totalPayables;
  const netClass = netPosition >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]';

  const profitClass = data.profitYTD >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]';

  const changeLabel = pct(data.profitYTD, data.profitSamePeriodLastYear);
  const changePositive = data.profitYTD >= data.profitSamePeriodLastYear;

  const showAlerts =
    data.overdueInvoiceCount > 0 ||
    data.billsDueSoonCount > 0 ||
    (data.hasBankConnection && data.unmatchedTxCount > 0);

  const tierLabel = TIER_CONFIG[tier]?.label || tier;

  return (
    <main className="space-y-8">
      {_sp.upgraded === 'true' && <UpgradeBanner tierLabel={tierLabel} />}

      <PageHeader title="Dashboard" />

      {/* ── 1. Net Position Hero ──────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardContent className="p-8 sm:p-10">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-3">
            Net Position
          </p>
          <p className={`text-5xl sm:text-6xl font-black tracking-tight mb-10 tabular-nums ${netClass}`}>
            {fmt(netPosition)}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 sm:divide-x sm:divide-[var(--theme-border)]">
            {/* Bank */}
            <div className="sm:pr-8">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-2 flex items-center gap-1.5">
                <Landmark size={10} className="opacity-60" /> Bank
              </p>
              {data.hasBankConnection ? (
                <Link href="/dashboard/banking" className="no-underline group block">
                  <p className="text-2xl font-black text-[var(--theme-text)] group-hover:text-[var(--theme-accent)] transition-colors tabular-nums">
                    {fmt(data.bankBalance)}
                  </p>
                </Link>
              ) : (
                <div>
                  <p className="text-2xl font-black text-[var(--theme-text-dim)] mb-1">—</p>
                  <Link
                    href="/dashboard/banking"
                    className="no-underline text-[10px] font-bold text-[var(--theme-accent)] uppercase tracking-wider hover:underline"
                  >
                    Connect bank →
                  </Link>
                </div>
              )}
            </div>

            {/* Owed To You */}
            <div className="sm:px-8">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-2">
                Owed To You
              </p>
              <Link href="/dashboard/invoices?filter=outstanding" className="no-underline group block">
                <p className="text-2xl font-black text-[var(--theme-text)] group-hover:text-[var(--theme-accent)] transition-colors tabular-nums">
                  {fmt(data.totalReceivables)}
                </p>
              </Link>
            </div>

            {/* You Owe */}
            <div className="sm:pl-8">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-2">
                You Owe
              </p>
              <Link href="/dashboard/bills" className="no-underline group block">
                <p className="text-2xl font-black text-[var(--theme-text)] group-hover:text-[var(--theme-accent)] transition-colors tabular-nums">
                  {fmt(data.totalPayables)}
                </p>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Charts (bank connection required) ─────────────────────────── */}
      {data.hasBankConnection ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bank balance area chart */}
          <Card>
            <CardContent className="p-8">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-6">
                Bank Balance — Last 6 Months
              </p>
              <BankBalanceChart data={data.dailyBalance} />
            </CardContent>
          </Card>

          {/* Cashflow bar chart */}
          <Card>
            <CardContent className="p-8">
              <div className="flex items-start justify-between mb-6">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)]">
                  Cash Flow
                </p>
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-[var(--theme-text-dim)] uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-sm" style={{ background: 'var(--theme-success)' }} /> In
                  </span>
                  <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-[var(--theme-text-dim)] uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-sm" style={{ background: 'var(--theme-destructive)' }} /> Out
                  </span>
                  <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-[var(--theme-accent)] uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-sm border border-[var(--theme-accent)] opacity-60" /> Forecast
                  </span>
                </div>
              </div>
              <CashflowChart data={data.monthlyCashflow} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-dashed border-2 bg-transparent">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <p className="text-sm font-bold text-[var(--theme-text-muted)]">
              Connect your bank to see balance history and cashflow charts.
            </p>
            <Link href="/dashboard/banking" className="no-underline shrink-0">
              <Button variant="outline" size="sm" className="uppercase tracking-widest text-[10px] font-black whitespace-nowrap">
                Connect bank →
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── 3. Profit + Forecast Row ──────────────────────────────────────── */}
      {hasReports ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profit */}
          <Card>
            <CardContent className="p-8">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-3">
                Profit — {data.profitPeriodLabel}
              </p>
              <p className={`text-4xl font-black tracking-tight mb-4 tabular-nums ${profitClass}`}>
                {fmt(data.profitYTD)}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-[11px] text-[var(--theme-text-muted)]">
                  vs {fmt(data.profitSamePeriodLastYear)} last year
                </p>
                {changeLabel && (
                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                      changePositive
                        ? 'text-[var(--theme-accent)] border-[var(--theme-accent)]/30 bg-[var(--theme-accent)]/5'
                        : 'text-[var(--theme-destructive)] border-[var(--theme-destructive)]/30 bg-[var(--theme-destructive)]/5'
                    }`}
                  >
                    {changeLabel}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 30-day Forecast — client component for drill-down */}
          <Card>
            <CardContent className="p-8">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-6">
                30-day Forecast
              </p>
              <ForecastCard
                bankBalance={data.bankBalance}
                forecastIncome={data.forecastIncome}
                forecastSpend={data.forecastSpend}
                forecastInvoices={data.forecastInvoices}
                forecastBills={data.forecastBills}
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-dashed border-2 bg-transparent">
          <CardContent className="p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-1">
                Profit & Forecast
              </p>
              <p className="text-sm font-bold text-[var(--theme-text-muted)]">
                Upgrade to Sole Trader to unlock profit tracking and 30-day cash forecasting.
              </p>
            </div>
            <Link href="/dashboard/settings?tab=billing" className="no-underline shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="uppercase tracking-widest text-[10px] font-black whitespace-nowrap"
              >
                Upgrade →
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── 4. Alerts ─────────────────────────────────────────────────────── */}
      {showAlerts && (
        <div className="flex flex-wrap gap-3">
          <AlertPill
            count={data.overdueInvoiceCount}
            label="overdue invoice"
            href="/dashboard/invoices?filter=overdue"
            icon={FileX}
          />
          <AlertPill
            count={data.billsDueSoonCount}
            label="bill due soon"
            href="/dashboard/bills"
            icon={CreditCard}
          />
          {data.hasBankConnection && (
            <AlertPill
              count={data.unmatchedTxCount}
              label="unmatched transaction"
              href="/dashboard/banking"
              icon={AlertTriangle}
            />
          )}
        </div>
      )}
    </main>
  );
}
