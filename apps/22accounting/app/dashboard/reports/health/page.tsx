'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckStatus = 'ok' | 'warning' | 'error';

interface ReconciliationCheck {
  score: number; maxScore: number; status: CheckStatus;
  unmatchedCount: number; matchedCount: number; totalCount: number; pct: number;
}
interface MissingReceiptsCheck {
  score: number; maxScore: number; status: CheckStatus; count: number;
}
interface OverdueInvoicesCheck {
  score: number; maxScore: number; status: CheckStatus; count: number; totalAmount: number;
}
interface VatComplianceCheck {
  score: number; maxScore: number; status: CheckStatus;
  issueCount: number; detail: string; vatRegistered: boolean;
}

interface HealthData {
  score: number;
  maxScore: number;
  overallStatus: CheckStatus;
  checks: {
    reconciliation: ReconciliationCheck;
    missingReceipts: MissingReceiptsCheck;
    overdueInvoices: OverdueInvoicesCheck;
    vatCompliance: VatComplianceCheck;
  };
  generatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function scoreColor(status: CheckStatus) {
  if (status === 'ok') return 'text-[var(--theme-success)]';
  if (status === 'warning') return 'text-[var(--theme-warning)]';
  return 'text-[var(--theme-destructive)]';
}

function scoreBg(status: CheckStatus) {
  if (status === 'ok') return 'bg-[var(--theme-success)]/10 border-[var(--theme-success)]/20';
  if (status === 'warning') return 'bg-[var(--theme-warning)]/10 border-[var(--theme-warning)]/20';
  return 'bg-[var(--theme-destructive)]/10 border-[var(--theme-destructive)]/20';
}

function statusBadge(status: CheckStatus) {
  const base = 'inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest';
  if (status === 'ok') return `${base} bg-[var(--theme-success)]/15 text-[var(--theme-success)]`;
  if (status === 'warning') return `${base} bg-[var(--theme-warning)]/15 text-[var(--theme-warning)]`;
  return `${base} bg-[var(--theme-destructive)]/15 text-[var(--theme-destructive)]`;
}

function statusLabel(status: CheckStatus) {
  return status === 'ok' ? 'Good' : status === 'warning' ? 'Needs attention' : 'Action required';
}

// Circle arc helpers
function describeArc(pct: number, r = 54) {
  const angle = (pct / 100) * 360;
  const rad = (angle - 90) * (Math.PI / 180);
  const x = 60 + r * Math.cos(rad);
  const y = 60 + r * Math.sin(rad);
  const large = angle > 180 ? 1 : 0;
  if (pct >= 100) {
    return `M 60 ${60 - r} A ${r} ${r} 0 1 1 ${60 - 0.001} ${60 - r}`;
  }
  return `M 60 ${60 - r} A ${r} ${r} 0 ${large} 1 ${x} ${y}`;
}

function ScoreRing({ score, status }: { score: number; status: CheckStatus }) {
  const strokeColor =
    status === 'ok' ? 'var(--theme-success)'
    : status === 'warning' ? 'var(--theme-warning)'
    : 'var(--theme-destructive)';

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" className="mb-2">
        {/* Background track */}
        <circle cx="60" cy="60" r="54" fill="none" stroke="var(--theme-border)" strokeWidth="8" />
        {/* Score arc */}
        <path
          d={describeArc(score)}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center -mt-14">
        <p className={`text-4xl font-black ${scoreColor(status)}`}>{score}</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-dim)]">/ 100</p>
      </div>
    </div>
  );
}

// ── Check cards ───────────────────────────────────────────────────────────────

function CheckCard({
  title,
  score,
  maxScore,
  status,
  detail,
  fixHref,
  fixLabel,
}: {
  title: string;
  score: number;
  maxScore: number;
  status: CheckStatus;
  detail: string;
  fixHref?: string;
  fixLabel?: string;
}) {
  return (
    <div className={`bg-[var(--theme-card)] shadow-cinematic border rounded-cinematic p-6 ${scoreBg(status)}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-1">{title}</p>
          <span className={statusBadge(status)}>{statusLabel(status)}</span>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-black ${scoreColor(status)}`}>{score}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-dim)]">/ {maxScore} pts</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 rounded-full bg-[var(--theme-border)] mb-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${(score / maxScore) * 100}%`,
            background:
              status === 'ok' ? 'var(--theme-success)'
              : status === 'warning' ? 'var(--theme-warning)'
              : 'var(--theme-destructive)',
          }}
        />
      </div>

      <p className="text-sm text-[var(--theme-text-muted)] mb-3">{detail}</p>

      {fixHref && status !== 'ok' && (
        <Link
          href={fixHref}
          className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--theme-accent)] no-underline hover:opacity-70 transition-opacity"
        >
          {fixLabel ?? 'Fix now'}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HealthScorePage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/reports/health')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Failed to load health score'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">
            Bookkeeping Health Score
          </h2>
          {data && (
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-dim)]">
              As of {new Date(data.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic text-sm font-bold mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : data && (
          <>
            {/* Overall score hero */}
            <div className={`bg-[var(--theme-card)] shadow-cinematic border-2 rounded-[2rem] p-8 mb-8 ${scoreBg(data.overallStatus)}`}>
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <ScoreRing score={data.score} status={data.overallStatus} />
                <div className="flex-1 text-center sm:text-left">
                  <h3 className={`text-3xl font-black mb-2 ${scoreColor(data.overallStatus)}`}>
                    {data.score >= 80 ? 'Your books are in great shape' :
                     data.score >= 50 ? 'A few things need attention' :
                     'Your books need some work'}
                  </h3>
                  <p className="text-[var(--theme-text-muted)] text-sm mb-4">
                    {data.score >= 80
                      ? 'Keep it up — your bookkeeping is well maintained.'
                      : 'Addressing the issues below will improve your score and keep your accounts accurate.'}
                  </p>
                  {/* Score breakdown pills */}
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    {[
                      { label: 'Reconciliation', score: data.checks.reconciliation.score, max: 25, status: data.checks.reconciliation.status },
                      { label: 'Receipts', score: data.checks.missingReceipts.score, max: 25, status: data.checks.missingReceipts.status },
                      { label: 'Invoices', score: data.checks.overdueInvoices.score, max: 25, status: data.checks.overdueInvoices.status },
                      { label: 'VAT', score: data.checks.vatCompliance.score, max: 25, status: data.checks.vatCompliance.status },
                    ].map(c => (
                      <span key={c.label} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                        c.status === 'ok' ? 'bg-[var(--theme-success)]/10 border-[var(--theme-success)]/20 text-[var(--theme-success)]' :
                        c.status === 'warning' ? 'bg-[var(--theme-warning)]/10 border-[var(--theme-warning)]/20 text-[var(--theme-warning)]' :
                        'bg-[var(--theme-destructive)]/10 border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)]'
                      }`}>
                        {c.label}: {c.score}/{c.max}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Individual checks */}
            <div className="grid sm:grid-cols-2 gap-4">

              {/* Reconciliation */}
              <CheckCard
                title="Bank Reconciliation"
                score={data.checks.reconciliation.score}
                maxScore={data.checks.reconciliation.maxScore}
                status={data.checks.reconciliation.status}
                detail={
                  data.checks.reconciliation.totalCount === 0
                    ? 'No bank transactions imported in the last 90 days.'
                    : `${data.checks.reconciliation.matchedCount} of ${data.checks.reconciliation.totalCount} bank transactions matched (${data.checks.reconciliation.pct}%). ${data.checks.reconciliation.unmatchedCount > 0 ? `${data.checks.reconciliation.unmatchedCount} unmatched.` : ''}`
                }
                fixHref="/dashboard/banking"
                fixLabel="Go to Banking"
              />

              {/* Missing receipts */}
              <CheckCard
                title="Missing Receipts"
                score={data.checks.missingReceipts.score}
                maxScore={data.checks.missingReceipts.maxScore}
                status={data.checks.missingReceipts.status}
                detail={
                  data.checks.missingReceipts.count === 0
                    ? 'All bills, expenses and mileage claims have receipts attached in the last 90 days.'
                    : `${data.checks.missingReceipts.count} record${data.checks.missingReceipts.count === 1 ? '' : 's'} without an attached receipt in the last 90 days.`
                }
                fixHref="/dashboard/expenses"
                fixLabel="Review Expenses"
              />

              {/* Overdue invoices */}
              <CheckCard
                title="Overdue Invoices"
                score={data.checks.overdueInvoices.score}
                maxScore={data.checks.overdueInvoices.maxScore}
                status={data.checks.overdueInvoices.status}
                detail={
                  data.checks.overdueInvoices.count === 0
                    ? 'No overdue invoices. All sent invoices are within their payment terms.'
                    : `${data.checks.overdueInvoices.count} overdue invoice${data.checks.overdueInvoices.count === 1 ? '' : 's'} totalling ${fmt(data.checks.overdueInvoices.totalAmount)}.`
                }
                fixHref="/dashboard/invoices"
                fixLabel="View Invoices"
              />

              {/* VAT compliance */}
              <CheckCard
                title="VAT Compliance"
                score={data.checks.vatCompliance.score}
                maxScore={data.checks.vatCompliance.maxScore}
                status={data.checks.vatCompliance.status}
                detail={
                  data.checks.vatCompliance.status === 'ok'
                    ? data.checks.vatCompliance.vatRegistered
                      ? 'VAT number is set and VAT registration is in order.'
                      : 'Not VAT registered — nothing to check.'
                    : data.checks.vatCompliance.detail
                }
                fixHref="/dashboard/settings"
                fixLabel="Update Settings"
              />

            </div>

            <p className="text-[10px] text-[var(--theme-text-dim)] mt-6">
              Health score checks are based on the last 90 days of activity. Bank reconciliation and missing receipt checks only apply if you have bank connections or expenses recorded. Score updates each time this page is loaded.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
