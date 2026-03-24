'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { DailyBalancePoint, MonthlyCashflowPoint } from '@/src/lib/dashboard.service';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtGBP(n: number) {
  if (Math.abs(n) >= 1000) {
    return `£${(n / 1000).toFixed(1)}k`;
  }
  return `£${n.toFixed(0)}`;
}

function fmtGBPFull(n: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(n);
}

// ─── custom tooltip ───────────────────────────────────────────────────────────

function BalanceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = new Date(label);
  const formatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--theme-text-dim)] mb-1">{formatted}</p>
      <p className="text-sm font-black text-[var(--theme-accent)]">{fmtGBPFull(payload[0].value)}</p>
    </div>
  );
}

function CashflowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const moneyIn = payload.find((p: any) => p.dataKey === 'moneyIn')?.value ?? 0;
  const moneyOut = payload.find((p: any) => p.dataKey === 'moneyOut')?.value ?? 0;
  return (
    <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg px-3 py-2 shadow-lg min-w-[140px]">
      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--theme-text-dim)] mb-2">{label}</p>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold" style={{ color: 'var(--theme-success)' }}>In: {fmtGBPFull(moneyIn)}</p>
        <p className="text-xs font-bold" style={{ color: 'var(--theme-destructive)' }}>Out: {fmtGBPFull(moneyOut)}</p>
      </div>
    </div>
  );
}

// ─── bank balance area chart ──────────────────────────────────────────────────

export function BankBalanceChart({ data }: { data: DailyBalancePoint[] }) {
  // Thin the data to ~90 points for readability (every other day)
  const thinned = data.filter((_, i) => i % 2 === 0 || i === data.length - 1);

  // Tick labels: show first of each month only
  const ticks = thinned
    .filter(d => d.date.endsWith('-01') || d === thinned[0])
    .map(d => d.date);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={thinned} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--theme-accent)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--theme-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          ticks={ticks}
          tickFormatter={v => {
            const d = new Date(v);
            return d.toLocaleDateString('en-GB', { month: 'short' });
          }}
          tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'var(--theme-text-dim)', fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtGBP}
          tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'var(--theme-text-dim)', fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<BalanceTooltip />} cursor={{ stroke: 'var(--theme-border)', strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="balance"
          stroke="var(--theme-accent)"
          strokeWidth={2}
          fill="url(#balanceGradient)"
          dot={false}
          activeDot={{ r: 3, fill: 'var(--theme-accent)', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── monthly cashflow bar chart ───────────────────────────────────────────────

export function CashflowChart({ data }: { data: MonthlyCashflowPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} barCategoryGap="30%" barGap={2} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="month"
          tick={({ x, y, payload, index }: any) => {
            const item = data[index];
            const isForecast = item?.isForecast;
            return (
              <text
                x={x}
                y={y + 10}
                textAnchor="middle"
                fontSize={9}
                fontFamily="monospace"
                fontWeight={700}
                fill={isForecast ? 'var(--theme-accent)' : 'var(--theme-text-dim)'}
              >
                {payload.value}
              </text>
            );
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtGBP}
          tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'var(--theme-text-dim)', fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<CashflowTooltip />} cursor={{ fill: 'var(--theme-border)', fillOpacity: 0.3 }} />
        <Bar dataKey="moneyIn" name="Money In" radius={[2, 2, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.isForecast ? 'var(--theme-success)' : 'var(--theme-success)'}
              fillOpacity={entry.isForecast ? 0.35 : entry.isPartial ? 0.7 : 1}
              stroke={entry.isForecast ? 'var(--theme-success)' : 'none'}
              strokeWidth={entry.isForecast ? 1 : 0}
              strokeDasharray={entry.isForecast ? '3 2' : undefined}
            />
          ))}
        </Bar>
        <Bar dataKey="moneyOut" name="Money Out" radius={[2, 2, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill="var(--theme-destructive)"
              fillOpacity={entry.isForecast ? 0.35 : entry.isPartial ? 0.7 : 1}
              stroke={entry.isForecast ? 'var(--theme-destructive)' : 'none'}
              strokeWidth={entry.isForecast ? 1 : 0}
              strokeDasharray={entry.isForecast ? '3 2' : undefined}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
