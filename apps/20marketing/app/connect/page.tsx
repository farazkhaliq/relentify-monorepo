'use client'
import { useTheme } from '@relentify/ui'
import { motion } from 'motion/react'
import { Inbox, Bot, Workflow, BarChart3, Shield, BookOpen, Headphones, FileText, ClipboardCheck, Users, Star, Lock } from 'lucide-react'
import { ChannelIcons } from '../components/ChannelIcons'
import { ComparisonTable } from '../components/ComparisonTable'
import { SavingsCalculator } from '../components/SavingsCalculator'
import { PricingCards } from '../components/PricingCards'

const FEATURES = [
  { icon: Inbox, title: 'Unified Inbox', desc: 'Every channel in one view. No switching tabs.' },
  { icon: Bot, title: 'AI Auto-Reply', desc: 'AI answers from your knowledge base. Escalates when needed.' },
  { icon: Bot, title: 'No-Code Bots', desc: 'Build conversational bots without writing code.' },
  { icon: Workflow, title: 'Workflow Automation', desc: 'If/then rules that route, tag, and prioritise automatically.' },
  { icon: Shield, title: 'SLA Management', desc: 'Set response and resolution targets. Get breach alerts.' },
  { icon: BookOpen, title: 'Knowledge Base', desc: 'Self-service articles with full-text search.' },
  { icon: Headphones, title: 'Voice (VoIP)', desc: 'Inbound + outbound calls in the browser. IVR, voicemail, recording.' },
  { icon: BarChart3, title: 'Custom Reports', desc: 'Cross-channel analytics. Agent leaderboards. Bot performance.' },
  { icon: ClipboardCheck, title: 'QA Scoring', desc: 'Rate conversations on a rubric. AI auto-scoring.' },
  { icon: Users, title: 'Customer Portal', desc: 'Customers submit + track tickets. Magic link login.' },
  { icon: Star, title: 'CSAT Surveys', desc: 'Customer satisfaction after every conversation.' },
  { icon: Lock, title: 'Audit Log', desc: 'Full trail of who did what, when.' },
]

const INTERCOM_COMPARISON = [
  { feature: 'Live chat widget', us: true, them: true },
  { feature: 'Email channel', us: true, them: true },
  { feature: 'AI auto-reply', us: true, them: '$0.99/resolution' },
  { feature: 'No-code bots', us: true, them: true },
  { feature: 'WhatsApp', us: 'Growth+', them: 'Add-on' },
  { feature: 'Voice (VoIP)', us: 'Growth+', them: false },
  { feature: 'SMS', us: 'Professional+', them: 'Add-on' },
  { feature: 'SLA management', us: 'Growth+', them: 'Advanced+' },
  { feature: 'Workflow automation', us: 'Professional+', them: 'Advanced+' },
  { feature: 'Custom reports', us: 'Professional+', them: 'Expert only' },
  { feature: 'QA + AI scoring', us: 'Enterprise', them: false },
  { feature: 'SSO', us: 'Enterprise', them: 'Expert only' },
]

const ZENDESK_COMPARISON = [
  { feature: 'Ticketing', us: true, them: true },
  { feature: 'Live chat', us: 'Essentials+', them: 'Suite Team+' },
  { feature: 'Email', us: true, them: true },
  { feature: 'AI auto-reply', us: true, them: 'Add-on ($50+)' },
  { feature: 'WhatsApp', us: 'Growth+', them: 'Suite Team+' },
  { feature: 'Voice', us: 'Growth+', them: 'Suite Professional+' },
  { feature: 'No-code bots', us: true, them: 'Suite Team+' },
  { feature: 'Workflows', us: 'Professional+', them: 'Suite Professional+' },
  { feature: 'SLA', us: 'Growth+', them: 'Suite Professional+' },
  { feature: 'Custom reports', us: 'Professional+', them: 'Suite Professional+' },
  { feature: 'Sandbox', us: 'Enterprise', them: 'Suite Enterprise' },
]

const CONNECT_PLANS = [
  { name: 'Starter', priceGBP: 12, period: 'seat/mo', description: 'Email support', features: ['Email channel', '1 bot', '100 AI resolutions', 'Ticketing', 'Knowledge base'], cta: 'Start free trial' },
  { name: 'Essentials', priceGBP: 20, period: 'seat/mo', description: 'Add live chat', features: ['Everything in Starter', 'Live chat widget', '3 bots', '500 AI resolutions'], cta: 'Start free trial' },
  { name: 'Growth', priceGBP: 39, period: 'seat/mo', description: 'Multi-channel', features: ['Everything in Essentials', 'WhatsApp', 'Voice (VoIP)', 'SLA management', '10 bots', '2000 AI resolutions'], cta: 'Start free trial', highlight: true },
  { name: 'Professional', priceGBP: 75, period: 'seat/mo', description: 'Full platform', features: ['Everything in Growth', 'SMS', 'Workflows', 'Custom reports', 'Unlimited bots', 'Copilot'], cta: 'Start free trial' },
  { name: 'Enterprise', priceGBP: 119, period: 'seat/mo', description: 'Enterprise features', features: ['Everything in Professional', 'SSO', 'Custom roles', 'Audit log', 'AI QA scoring', 'Sandbox', 'Dedicated support'], cta: 'Contact sales' },
]

export default function ConnectPage() {
  const { theme } = useTheme()

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="py-20 px-6 text-center max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight" style={{ fontFamily: theme.typography?.headings }}>
            Everything Zendesk charges £227/agent for.<br />We charge £119.
          </h1>
          <p className="text-lg text-[var(--theme-text-muted)] mb-8 max-w-2xl mx-auto">
            Multi-channel helpdesk with AI, voice, bots, and workflows. Per seat, no surprises.
          </p>
          <a href="https://auth.relentify.com/register" className="inline-block px-8 py-3 rounded-xl bg-[var(--theme-primary)] text-white font-medium hover:opacity-90 mb-10">
            Start free trial
          </a>
          <ChannelIcons />
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-10">Everything you need in one platform</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-[var(--theme-border)] p-4 hover:bg-[var(--theme-card)] transition-colors">
              <f.icon size={20} className="text-[var(--theme-primary)] mb-2" />
              <h3 className="font-medium text-sm mb-0.5">{f.title}</h3>
              <p className="text-xs text-[var(--theme-text-muted)]">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Intercom Comparison */}
      <section className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-2">vs Intercom</h2>
        <p className="text-center text-[var(--theme-text-muted)] mb-8">Same features, fraction of the price. No per-resolution AI fees.</p>
        <div className="rounded-2xl border border-[var(--theme-border)] overflow-hidden">
          <ComparisonTable title="Feature" competitor="Intercom" rows={INTERCOM_COMPARISON} pricingRow={{ us: 'From £12/seat', them: 'From $29/seat' }} />
        </div>
      </section>

      {/* Zendesk Comparison */}
      <section className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-2">vs Zendesk</h2>
        <p className="text-center text-[var(--theme-text-muted)] mb-8">Zendesk fully loaded: ~£227/agent. Relentify: £119/agent.</p>
        <div className="rounded-2xl border border-[var(--theme-border)] overflow-hidden">
          <ComparisonTable title="Feature" competitor="Zendesk" rows={ZENDESK_COMPARISON} pricingRow={{ us: 'From £12/seat', them: 'From $19/agent' }} />
        </div>
      </section>

      {/* Savings Calculator */}
      <section className="py-16 px-6 max-w-4xl mx-auto">
        <SavingsCalculator />
      </section>

      {/* Pricing */}
      <section className="py-16 px-6 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-2">Plans that scale with you</h2>
        <p className="text-center text-[var(--theme-text-muted)] mb-10">14-day free trial on every plan. No credit card required.</p>
        <PricingCards plans={CONNECT_PLANS} />
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-2xl font-bold mb-3">Switch from Zendesk in a day</h2>
        <p className="text-[var(--theme-text-muted)] mb-6">We&apos;ll help you migrate. Free onboarding for all plans.</p>
        <a href="https://auth.relentify.com/register" className="inline-block px-8 py-3 rounded-xl bg-[var(--theme-primary)] text-white font-medium hover:opacity-90">
          Start free trial
        </a>
      </section>
    </div>
  )
}
