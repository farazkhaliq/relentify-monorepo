'use client'
import { useState } from 'react'
import { useRegion, formatPrice } from '@relentify/ui'

const CONNECT_PLANS = [
  { name: 'Starter', gbp: 12 },
  { name: 'Essentials', gbp: 20 },
  { name: 'Growth', gbp: 39 },
  { name: 'Professional', gbp: 75 },
  { name: 'Enterprise', gbp: 119 },
]

const ZENDESK_APPROX: Record<string, number> = {
  'Starter': 19, 'Essentials': 55, 'Growth': 89, 'Professional': 115, 'Enterprise': 169,
}

export function SavingsCalculator() {
  const [agents, setAgents] = useState(5)
  const [planIdx, setPlanIdx] = useState(2)
  const { region } = useRegion()

  const plan = CONNECT_PLANS[planIdx]
  const ourCost = plan.gbp * agents
  const zdCost = (ZENDESK_APPROX[plan.name] || 89) * agents
  const savings = zdCost - ourCost
  const savingsPct = zdCost > 0 ? Math.round((savings / zdCost) * 100) : 0

  return (
    <div className="rounded-2xl border border-[var(--theme-border)] p-6 max-w-xl mx-auto">
      <h3 className="text-lg font-bold mb-4 text-center">How much would you save?</h3>

      <div className="mb-4">
        <label className="text-sm font-medium block mb-2">Number of agents: <strong>{agents}</strong></label>
        <input type="range" min={1} max={50} value={agents} onChange={(e) => setAgents(parseInt(e.target.value))}
          className="w-full accent-[var(--theme-primary)]" />
      </div>

      <div className="mb-6">
        <label className="text-sm font-medium block mb-2">Plan</label>
        <div className="flex flex-wrap gap-2">
          {CONNECT_PLANS.map((p, i) => (
            <button key={p.name} onClick={() => setPlanIdx(i)}
              className={`text-xs px-3 py-1.5 rounded-full ${i === planIdx ? 'bg-[var(--theme-primary)] text-white' : 'bg-[var(--theme-card)] border border-[var(--theme-border)]'}`}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl bg-[var(--theme-primary)]/10 p-4 text-center">
          <div className="text-xs text-[var(--theme-text-muted)] mb-1">Relentify</div>
          <div className="text-2xl font-bold text-[var(--theme-primary)]">{formatPrice(ourCost, region)}<span className="text-sm font-normal">/mo</span></div>
        </div>
        <div className="rounded-xl bg-[var(--theme-card)] border border-[var(--theme-border)] p-4 text-center">
          <div className="text-xs text-[var(--theme-text-muted)] mb-1">Zendesk (comparable)</div>
          <div className="text-2xl font-bold">{formatPrice(zdCost, region)}<span className="text-sm font-normal">/mo</span></div>
        </div>
      </div>

      {savings > 0 && (
        <div className="text-center py-3 rounded-xl bg-[var(--theme-success)]/10">
          <span className="text-lg font-bold text-[var(--theme-success)]">You save {formatPrice(savings, region)}/mo ({savingsPct}%)</span>
        </div>
      )}
    </div>
  )
}
