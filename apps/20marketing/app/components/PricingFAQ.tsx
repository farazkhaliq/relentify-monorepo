'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQS = [
  { q: 'What happens if I go over my AI resolution limit?', a: 'You\'ll be charged $0.99 per additional AI resolution. No surprises — you can set a hard cap in settings.' },
  { q: 'How does voice billing work?', a: 'Voice minutes are billed based on usage via Twilio. You only pay for what you use, billed monthly.' },
  { q: 'Can I switch plans?', a: 'Yes, upgrade or downgrade any time. Changes are prorated — you only pay the difference.' },
  { q: 'Is there a free trial?', a: 'Yes! Relentify Chat is free forever. Connect plans come with a 14-day free trial.' },
  { q: 'What payment methods do you accept?', a: 'All major credit and debit cards via Stripe. We also support direct debit for annual plans.' },
  { q: 'Do you offer annual billing?', a: 'Yes — save 2 months with annual billing on any Connect plan.' },
  { q: 'Can I use my own AI API key?', a: 'Yes! Bring your own OpenAI or compatible API key. Your key, your data, your costs.' },
  { q: 'Is there a setup fee?', a: 'No. Zero setup fees, zero hidden costs. Your first invoice is your only invoice.' },
]

export function PricingFAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
      <div className="space-y-2">
        {FAQS.map((faq, i) => (
          <div key={i} className="border border-[var(--theme-border)] rounded-xl overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--theme-card)]">
              <span className="font-medium text-sm">{faq.q}</span>
              <ChevronDown size={16} className={`transition-transform flex-shrink-0 ml-2 ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-sm text-[var(--theme-text-muted)]">{faq.a}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
