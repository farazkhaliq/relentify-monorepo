'use client'
import { CheckCircle2 } from 'lucide-react'
import { useRegion, formatPrice } from '@relentify/ui'

interface Plan {
  name: string
  priceGBP: number | null
  period?: string
  description: string
  features: string[]
  cta: string
  highlight?: boolean
}

interface PricingCardsProps {
  plans: Plan[]
  ctaUrl?: string
}

export function PricingCards({ plans, ctaUrl = 'https://auth.relentify.com/register' }: PricingCardsProps) {
  const { region } = useRegion()

  return (
    <div className={`grid gap-6 ${plans.length <= 3 ? 'md:grid-cols-3' : plans.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-5'}`}>
      {plans.map((plan, i) => (
        <div key={i} className={`relative rounded-2xl border p-6 flex flex-col ${
          plan.highlight
            ? 'border-[var(--theme-primary)] shadow-lg scale-[1.02]'
            : 'border-[var(--theme-border)]'
        }`}>
          {plan.highlight && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[var(--theme-primary)] text-white text-xs rounded-full font-medium">
              Most Popular
            </div>
          )}
          <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
          <p className="text-xs text-[var(--theme-text-muted)] mb-4">{plan.description}</p>
          <div className="mb-4">
            {plan.priceGBP !== null ? (
              <>
                <span className="text-3xl font-bold">{formatPrice(plan.priceGBP, region)}</span>
                <span className="text-sm text-[var(--theme-text-muted)]">/{plan.period || 'mo'}</span>
              </>
            ) : (
              <span className="text-3xl font-bold">Free</span>
            )}
          </div>
          <ul className="space-y-2 mb-6 flex-1">
            {plan.features.map((f, j) => (
              <li key={j} className="flex items-start gap-2 text-sm">
                <CheckCircle2 size={16} className="text-[var(--theme-success)] flex-shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <a href={ctaUrl} className={`block text-center py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90 ${
            plan.highlight || plan.priceGBP === null
              ? 'bg-[var(--theme-primary)] text-white'
              : 'border border-[var(--theme-border)] hover:bg-[var(--theme-card)]'
          }`}>
            {plan.cta}
          </a>
        </div>
      ))}
    </div>
  )
}
