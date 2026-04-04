'use client'
import { useState } from 'react'
import { useTheme } from '@relentify/ui'
import { motion } from 'motion/react'
import { PricingCards } from '../components/PricingCards'
import { FeatureMatrix } from '../components/FeatureMatrix'
import { PricingFAQ } from '../components/PricingFAQ'

const CHAT_PLANS = [
  { name: 'Free', priceGBP: null, description: 'Everything you need', features: ['Unlimited agents', 'Unlimited history', 'File sharing', 'Knowledge base', 'Ticketing', 'Visitor monitoring', 'Webhooks API'], cta: 'Get started free', highlight: true },
  { name: 'Remove Branding', priceGBP: 24.99, description: 'Your brand, not ours', features: ['Everything in Free', 'Hide "Powered by Relentify"'], cta: 'Add branding removal' },
  { name: 'AI Assist', priceGBP: 24.99, description: 'AI auto-replies', features: ['Everything in Free', 'AI auto-replies from KB', 'Bring your own API key'], cta: 'Add AI auto-reply' },
]

const CONNECT_PLANS = [
  { name: 'Starter', priceGBP: 12, period: 'seat/mo', description: 'Email support', features: ['Email', '1 bot', '100 AI resolutions', 'Ticketing', 'KB'], cta: 'Start free trial' },
  { name: 'Essentials', priceGBP: 20, period: 'seat/mo', description: 'Add live chat', features: ['+ Live chat', '3 bots', '500 AI resolutions'], cta: 'Start free trial' },
  { name: 'Growth', priceGBP: 39, period: 'seat/mo', description: 'Multi-channel', features: ['+ WhatsApp, Voice', 'SLA', '10 bots', '2000 AI resolutions'], cta: 'Start free trial', highlight: true },
  { name: 'Professional', priceGBP: 75, period: 'seat/mo', description: 'Full platform', features: ['+ SMS, Workflows', 'Custom reports', 'Unlimited bots', 'Copilot'], cta: 'Start free trial' },
  { name: 'Enterprise', priceGBP: 119, period: 'seat/mo', description: 'Enterprise', features: ['+ SSO, Audit log', 'Custom roles', 'AI QA', 'Sandbox'], cta: 'Contact sales' },
]

const FEATURE_GROUPS = [
  { category: 'Channels', features: [
    { name: 'Email', tiers: [true, true, true, true, true] },
    { name: 'Live chat widget', tiers: [false, true, true, true, true] },
    { name: 'WhatsApp', tiers: [false, false, true, true, true] },
    { name: 'Voice (VoIP)', tiers: [false, false, true, true, true] },
    { name: 'SMS', tiers: [false, false, false, true, true] },
    { name: 'Facebook Messenger', tiers: [false, false, true, true, true] },
    { name: 'Instagram DMs', tiers: [false, false, true, true, true] },
  ]},
  { category: 'AI & Bots', features: [
    { name: 'AI auto-reply', tiers: ['100', '500', '2000', 'Unlimited', 'Unlimited'] },
    { name: 'No-code chatbots', tiers: ['1', '3', '10', 'Unlimited', 'Unlimited'] },
    { name: 'AI QA scoring', tiers: [false, false, false, false, true] },
    { name: 'Copilot (agent assist)', tiers: [false, false, false, true, true] },
  ]},
  { category: 'Automation', features: [
    { name: 'Workflow automation', tiers: [false, false, false, true, true] },
    { name: 'SLA management', tiers: [false, false, true, true, true] },
    { name: 'Triggers', tiers: [true, true, true, true, true] },
  ]},
  { category: 'Analytics & QA', features: [
    { name: 'Standard analytics', tiers: [true, true, true, true, true] },
    { name: 'Custom reports', tiers: [false, false, false, true, true] },
    { name: 'QA scoring', tiers: [false, false, false, false, true] },
  ]},
  { category: 'Admin', features: [
    { name: 'Custom roles', tiers: [false, false, false, false, true] },
    { name: 'Audit log', tiers: [false, false, false, false, true] },
    { name: 'SSO (SAML)', tiers: [false, false, false, false, true] },
    { name: 'Sandbox', tiers: [false, false, false, false, true] },
  ]},
]

export default function PricingPage() {
  const { theme } = useTheme()
  const [tab, setTab] = useState<'chat' | 'connect'>('connect')

  return (
    <div className="min-h-screen">
      <section className="py-20 px-6 text-center max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: theme.typography?.headings }}>
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-[var(--theme-text-muted)] mb-8">No hidden fees. No per-resolution charges. No surprises.</p>

          <div className="inline-flex rounded-xl border border-[var(--theme-border)] p-1 mb-10">
            <button onClick={() => setTab('chat')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'chat' ? 'bg-[var(--theme-primary)] text-white' : ''}`}>
              Chat (Free)
            </button>
            <button onClick={() => setTab('connect')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'connect' ? 'bg-[var(--theme-primary)] text-white' : ''}`}>
              Connect (Helpdesk)
            </button>
          </div>
        </motion.div>
      </section>

      <section className="px-6 max-w-7xl mx-auto mb-16">
        {tab === 'chat' ? (
          <PricingCards plans={CHAT_PLANS} />
        ) : (
          <PricingCards plans={CONNECT_PLANS} />
        )}
      </section>

      {tab === 'connect' && (
        <section className="py-16 px-6 max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Full feature comparison</h2>
          <FeatureMatrix tierNames={['Starter', 'Essentials', 'Growth', 'Professional', 'Enterprise']} groups={FEATURE_GROUPS} />
        </section>
      )}

      <section className="py-16 px-6">
        <PricingFAQ />
      </section>

      <section className="py-16 px-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="https://auth.relentify.com/register" className="px-8 py-3 rounded-xl bg-[var(--theme-primary)] text-white font-medium hover:opacity-90">
            {tab === 'chat' ? 'Start free' : 'Start free trial'}
          </a>
          <a href={tab === 'chat' ? '/chat' : '/connect'} className="px-8 py-3 rounded-xl border border-[var(--theme-border)] hover:bg-[var(--theme-card)]">
            Learn more
          </a>
        </div>
      </section>
    </div>
  )
}
