'use client'
import { useTheme } from '@relentify/ui'
import { cn } from '@relentify/ui'
import { motion } from 'motion/react'
import { Inbox, Bot, Workflow, BarChart3, Shield, BookOpen, Headphones, ClipboardCheck, Users, Star, Lock, ArrowRight, CheckCircle2, MessageSquare, Mail, Phone } from 'lucide-react'
import { ComparisonTable } from '../components/ComparisonTable'
import { SavingsCalculator } from '../components/SavingsCalculator'

const FEATURES = [
  { icon: <Inbox />, title: 'Unified Inbox', desc: 'Every channel in one view. Email, chat, WhatsApp, SMS, voice &mdash; no switching tabs.' },
  { icon: <Bot />, title: 'AI Auto-Reply', desc: 'AI answers from your knowledge base. Escalates to a human when needed.' },
  { icon: <Bot />, title: 'No-Code Bots', desc: 'Visual flow builder. Build conversational bots without writing code.' },
  { icon: <Workflow />, title: 'Workflow Automation', desc: 'If/then rules that route, tag, and prioritise automatically.' },
  { icon: <Shield />, title: 'SLA Management', desc: 'Set response and resolution targets. Get breach alerts in real time.' },
  { icon: <BookOpen />, title: 'Knowledge Base', desc: 'Self-service articles with full-text search and in-widget delivery.' },
  { icon: <Headphones />, title: 'Voice (VoIP)', desc: 'Inbound + outbound calls in the browser. IVR, voicemail, and call recording.' },
  { icon: <BarChart3 />, title: 'Custom Reports', desc: 'Cross-channel analytics. Agent leaderboards. Bot performance dashboards.' },
  { icon: <ClipboardCheck />, title: 'QA Scoring', desc: 'Rate conversations on a rubric. AI auto-scoring on the Enterprise plan.' },
  { icon: <Users />, title: 'Customer Portal', desc: 'Customers submit and track tickets. Magic-link login, no passwords.' },
  { icon: <Star />, title: 'CSAT Surveys', desc: 'Customer satisfaction after every conversation. Public leaderboards.' },
  { icon: <Lock />, title: 'Audit Log', desc: 'Full hash-chained trail of who did what, when. Compliance-ready.' },
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
  { name: 'Starter', price: 12, features: ['Email channel', '1 bot', '100 AI resolutions', 'Ticketing', 'Knowledge base'] },
  { name: 'Essentials', price: 20, features: ['Everything in Starter', 'Live chat widget', '3 bots', '500 AI resolutions'] },
  { name: 'Growth', price: 39, features: ['Everything in Essentials', 'WhatsApp', 'Voice (VoIP)', 'SLA management', '10 bots', '2000 AI resolutions'], featured: true },
  { name: 'Professional', price: 75, features: ['Everything in Growth', 'SMS', 'Workflows', 'Custom reports', 'Unlimited bots', 'Copilot'] },
  { name: 'Enterprise', price: 119, features: ['Everything in Pro', 'SSO', 'Custom roles', 'Audit log', 'AI QA scoring', 'Sandbox'] },
]

export default function ConnectPage() {
  const { theme } = useTheme()

  return (
    <div className="w-full pt-32">
      {/* Product Hero */}
      <section className="px-6 max-w-7xl mx-auto mb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-bold uppercase tracking-widest text-accent mb-6 block"
            >
              Relentify Connect
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`text-6xl md:text-8xl font-bold leading-[0.9] mb-8 ${theme.typography.headings}`}
            >
              One inbox. <span className={theme.typography.drama}>Every channel.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-[var(--theme-text-muted)] max-w-xl mb-10"
            >
              Multi-channel helpdesk with AI, voice, bots, and workflows. Everything Zendesk charges £227/agent for &mdash; we charge £119. Per seat, no surprises.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <a
                href="https://auth.relentify.com/register"
                className="magnetic-btn px-8 py-4 rounded-full font-bold text-white flex items-center gap-2 shadow-cinematic bg-[var(--theme-accent)]"
              >
                Start Free Trial <ArrowRight size={18} />
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <div className="aspect-square rounded-cinematic bg-[var(--theme-border)] p-8">
              <div className="w-full h-full bg-[var(--theme-card)] rounded-cinematic shadow-cinematic border border-[var(--theme-border)] p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-4">
                  <div>
                    <h4 className="font-bold">Unified Inbox</h4>
                    <p className="text-[var(--theme-text-10)] opacity-40 uppercase font-bold">12 Open &middot; 4 Channels</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest opacity-40">Live</span>
                    <div className="w-2 h-2 rounded-full bg-[var(--theme-success)] animate-pulse" />
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { icon: <MessageSquare size={14} />, name: 'Sarah Chen', channel: 'Chat', msg: 'Order #4821 status?', time: '2m', color: 'accent' },
                    { icon: <Mail size={14} />, name: 'James Ford', channel: 'Email', msg: 'Refund request for...', time: '8m', color: 'blue' },
                    { icon: <Phone size={14} />, name: 'Maria Lopez', channel: 'Voice', msg: 'Voicemail 0:34', time: '14m', color: 'emerald' },
                    { icon: <MessageSquare size={14} />, name: '+44 7700 900...', channel: 'WhatsApp', msg: 'Can you reschedule?', time: '21m', color: 'green' },
                    { icon: <Mail size={14} />, name: 'Tom B.', channel: 'Email', msg: 'Invoice query...', time: '38m', color: 'blue' },
                  ].map((c, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--theme-border)] hover:bg-[var(--theme-card)] transition-colors cursor-pointer">
                      <div className="w-8 h-8 rounded-full bg-[var(--theme-card)] flex items-center justify-center text-accent flex-shrink-0">
                        {c.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold truncate">{c.name}</span>
                          <span className="text-[10px] font-bold uppercase opacity-40">{c.channel}</span>
                        </div>
                        <p className="text-[10px] text-[var(--theme-text-muted)] truncate">{c.msg}</p>
                      </div>
                      <span className="text-[10px] font-bold opacity-40 flex-shrink-0">{c.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className={`text-5xl md:text-7xl font-bold mb-6 ${theme.typography.headings}`}>Plans that <span className={theme.typography.drama}>scale.</span></h2>
          <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto">
            14-day free trial on every plan. Per seat, no surprises, no per-resolution AI fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {CONNECT_PLANS.map((tier, i) => (
            <div
              key={i}
              className={cn(
                "rounded-cinematic p-6 border flex flex-col justify-between transition-all duration-500",
                tier.featured
                  ? "bg-[var(--theme-dark)] text-white border-[var(--theme-dark)] shadow-cinematic lg:scale-105 z-10"
                  : "bg-[var(--theme-card)] border-[var(--theme-border)]"
              )}
            >
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-6">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold">£{tier.price}</span>
                  <span className="opacity-40 text-xs">/seat/mo</span>
                </div>
                <ul className="flex flex-col gap-3 mb-8">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs font-bold">
                      <CheckCircle2 size={14} className={cn("flex-shrink-0 mt-0.5", tier.featured ? "text-accent" : "text-[var(--theme-text)]/20")} />
                      <span className="leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href="https://auth.relentify.com/register"
                className={cn(
                  "w-full py-3 rounded-full font-bold transition-all text-xs text-center block",
                  tier.featured
                    ? "bg-[var(--theme-accent)] text-white"
                    : "bg-[var(--theme-border)] hover:bg-[var(--theme-dark)]/10"
                )}
              >
                {tier.name === 'Enterprise' ? 'Contact Sales' : 'Start Trial'}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-6 bg-[var(--theme-background)]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest text-accent mb-4">Capabilities</p>
            <h2 className={`text-5xl md:text-7xl font-bold mb-6 ${theme.typography.headings}`}>Everything you need, <span className={theme.typography.drama}>one platform.</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-[var(--theme-card)] p-10 rounded-cinematic border border-[var(--theme-border)] shadow-sm hover:shadow-cinematic transition-all group">
                <div className="w-14 h-14 rounded-cinematic bg-[var(--theme-border)] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform text-accent">
                  {f.icon}
                </div>
                <h3 className={`text-2xl font-bold mb-4 ${theme.typography.headings}`}>{f.title}</h3>
                <p className="text-sm text-[var(--theme-text-muted)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Savings Calculator */}
      <section className="py-32 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest text-accent mb-4">Calculate Savings</p>
          <h2 className={`text-5xl md:text-7xl font-bold mb-6 ${theme.typography.headings}`}>How much will you <span className={theme.typography.drama}>save?</span></h2>
        </div>
        <SavingsCalculator />
      </section>

      {/* Intercom Comparison */}
      <section className="py-32 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest text-accent mb-4">Comparison</p>
          <h2 className={`text-5xl md:text-7xl font-bold mb-6 ${theme.typography.headings}`}>vs Intercom.</h2>
          <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto">
            Same features, fraction of the price. No per-resolution AI fees.
          </p>
        </div>
        <div className="rounded-cinematic border border-[var(--theme-border)] overflow-hidden shadow-cinematic">
          <ComparisonTable title="Feature" competitor="Intercom" rows={INTERCOM_COMPARISON} pricingRow={{ us: 'From £12/seat', them: 'From $29/seat' }} />
        </div>
      </section>

      {/* Zendesk Comparison */}
      <section className="py-32 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest text-accent mb-4">Comparison</p>
          <h2 className={`text-5xl md:text-7xl font-bold mb-6 ${theme.typography.headings}`}>vs Zendesk.</h2>
          <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto">
            Zendesk fully loaded: ~£227/agent/mo. Relentify Enterprise: £119/agent/mo. Half the price, more features.
          </p>
        </div>
        <div className="rounded-cinematic border border-[var(--theme-border)] overflow-hidden shadow-cinematic">
          <ComparisonTable title="Feature" competitor="Zendesk" rows={ZENDESK_COMPARISON} pricingRow={{ us: 'From £12/seat', them: 'From $19/agent' }} />
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto bg-[var(--theme-dark)] rounded-cinematic p-12 md:p-20 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-[var(--theme-background-blur)]" />
          <div className="relative z-10">
            <h2 className={`text-4xl md:text-6xl font-bold mb-6 ${theme.typography.headings}`}>Switch from Zendesk <span className={theme.typography.drama}>in a day.</span></h2>
            <p className="text-xl text-[var(--theme-text-muted)] mb-12 max-w-xl mx-auto">
              We'll help you migrate. Free onboarding on every plan. No credit card required for the trial.
            </p>
            <a
              href="https://auth.relentify.com/register"
              className="inline-block px-10 py-5 rounded-full font-bold text-white shadow-cinematic hover:scale-105 transition-transform bg-[var(--theme-accent)]"
            >
              Start Free Trial
            </a>
            <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest opacity-40 mt-8">14 days free • Migration help included</p>
          </div>
        </div>
      </section>
    </div>
  )
}
