'use client'
import { CheckCircle2, XCircle } from 'lucide-react'

interface ComparisonRow {
  feature: string
  us: boolean | string
  them: boolean | string
}

interface ComparisonTableProps {
  title: string
  competitor: string
  rows: ComparisonRow[]
  pricingRow?: { us: string; them: string }
}

export function ComparisonTable({ title, competitor, rows, pricingRow }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--theme-border)]">
            <th className="text-left py-3 px-4 font-medium">{title}</th>
            <th className="text-center py-3 px-4 font-bold text-[var(--theme-primary)]">Relentify</th>
            <th className="text-center py-3 px-4 font-medium text-[var(--theme-text-muted)]">{competitor}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--theme-border)]">
              <td className="py-2.5 px-4">{r.feature}</td>
              <td className="py-2.5 px-4 text-center">
                {typeof r.us === 'boolean' ? (
                  r.us ? <CheckCircle2 size={18} className="inline text-[var(--theme-success)]" /> : <XCircle size={18} className="inline text-[var(--theme-text-dim)]" />
                ) : <span className="text-xs">{r.us}</span>}
              </td>
              <td className="py-2.5 px-4 text-center">
                {typeof r.them === 'boolean' ? (
                  r.them ? <CheckCircle2 size={18} className="inline text-[var(--theme-success)]" /> : <XCircle size={18} className="inline text-[var(--theme-text-dim)]" />
                ) : <span className="text-xs">{r.them}</span>}
              </td>
            </tr>
          ))}
          {pricingRow && (
            <tr className="bg-[var(--theme-card)]">
              <td className="py-3 px-4 font-bold">Price</td>
              <td className="py-3 px-4 text-center font-bold text-[var(--theme-primary)]">{pricingRow.us}</td>
              <td className="py-3 px-4 text-center font-medium text-[var(--theme-text-muted)]">{pricingRow.them}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
