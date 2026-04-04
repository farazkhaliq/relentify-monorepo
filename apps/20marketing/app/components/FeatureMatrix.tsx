'use client'
import { useState } from 'react'
import { ChevronDown, CheckCircle2, XCircle, Minus } from 'lucide-react'

interface FeatureRow {
  name: string
  tiers: (boolean | string)[]
}

interface FeatureGroup {
  category: string
  features: FeatureRow[]
}

interface FeatureMatrixProps {
  tierNames: string[]
  groups: FeatureGroup[]
}

export function FeatureMatrix({ tierNames, groups }: FeatureMatrixProps) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set([groups[0]?.category]))

  function toggle(cat: string) {
    const next = new Set(openGroups)
    next.has(cat) ? next.delete(cat) : next.add(cat)
    setOpenGroups(next)
  }

  return (
    <div className="border border-[var(--theme-border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="grid border-b border-[var(--theme-border)] bg-[var(--theme-card)]" style={{ gridTemplateColumns: `2fr ${tierNames.map(() => '1fr').join(' ')}` }}>
        <div className="py-3 px-4 font-medium text-sm">Feature</div>
        {tierNames.map(t => <div key={t} className="py-3 px-2 text-center font-bold text-xs">{t}</div>)}
      </div>

      {groups.map(g => (
        <div key={g.category}>
          <button onClick={() => toggle(g.category)}
            className="w-full flex items-center gap-2 py-3 px-4 bg-[var(--theme-background)] hover:bg-[var(--theme-card)] border-b border-[var(--theme-border)] text-left">
            <ChevronDown size={14} className={`transition-transform ${openGroups.has(g.category) ? 'rotate-0' : '-rotate-90'}`} />
            <span className="text-sm font-bold">{g.category}</span>
            <span className="text-xs text-[var(--theme-text-muted)]">({g.features.length})</span>
          </button>

          {openGroups.has(g.category) && g.features.map((f, i) => (
            <div key={i} className="grid border-b border-[var(--theme-border)]" style={{ gridTemplateColumns: `2fr ${tierNames.map(() => '1fr').join(' ')}` }}>
              <div className="py-2 px-4 text-sm">{f.name}</div>
              {f.tiers.map((val, j) => (
                <div key={j} className="py-2 px-2 text-center">
                  {val === true ? <CheckCircle2 size={16} className="inline text-[var(--theme-success)]" />
                    : val === false ? <XCircle size={16} className="inline text-[var(--theme-text-dim)]" />
                    : <span className="text-xs text-[var(--theme-text-muted)]">{val}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
