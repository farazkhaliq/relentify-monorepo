'use client'
import { useTheme } from '@relentify/ui'
import { motion } from 'motion/react'
import { MessageSquare, Users, File, BookOpen, Ticket, Eye, Zap, FileText, Star, StickyNote, Globe, Webhook, Shield, CheckCircle2 } from 'lucide-react'
import { ComparisonTable } from '../components/ComparisonTable'
import { PricingCards } from '../components/PricingCards'
import type { Metadata } from 'next'

const FEATURES = [
  { icon: Users, title: 'Unlimited Agents', desc: 'No per-seat charges. Ever.' },
  { icon: File, title: 'File Sharing', desc: 'Images, PDFs, docs up to 10MB.' },
  { icon: MessageSquare, title: 'Canned Responses', desc: 'One-click reply templates.' },
  { icon: BookOpen, title: 'Knowledge Base', desc: 'Self-service articles + in-widget search.' },
  { icon: Ticket, title: 'Ticketing', desc: 'Convert chats to tickets. SLA tracking.' },
  { icon: Eye, title: 'Visitor Monitoring', desc: 'See who is on your site right now.' },
  { icon: Zap, title: 'Automated Triggers', desc: 'Proactive messages based on behaviour.' },
  { icon: FileText, title: 'Pre-Chat Forms', desc: 'Collect name + email before chat.' },
  { icon: Star, title: 'CSAT Ratings', desc: 'Customer satisfaction scores per chat.' },
  { icon: StickyNote, title: 'Internal Notes', desc: 'Notes visible only to your team.' },
  { icon: Globe, title: 'Multi-Language', desc: 'Widget text in any language.' },
  { icon: Webhook, title: 'Webhooks API', desc: 'Real-time events to your systems.' },
]

const TAWKTO_COMPARISON = [
  { feature: 'Unlimited agents', us: true, them: true },
  { feature: 'Unlimited chat history', us: true, them: true },
  { feature: 'File sharing', us: true, them: true },
  { feature: 'Canned responses', us: true, them: true },
  { feature: 'Ticketing system', us: true, them: true },
  { feature: 'Knowledge base', us: true, them: true },
  { feature: 'Visitor monitoring', us: true, them: true },
  { feature: 'Pre-chat forms', us: true, them: true },
  { feature: 'Customer portal', us: true, them: false },
  { feature: 'SLA management', us: true, them: false },
  { feature: 'Agent collision detection', us: true, them: false },
  { feature: 'SSE real-time (no polling)', us: true, them: false },
  { feature: 'Public REST API', us: true, them: true },
  { feature: 'Remove branding add-on', us: '£24.99/mo', them: '$29/mo' },
  { feature: 'AI auto-reply add-on', us: '£24.99/mo', them: '$29/mo (AI Assist)' },
]

const CHAT_PLANS = [
  { name: 'Free', priceGBP: null, description: 'Everything you need', features: ['Unlimited agents', 'Unlimited history', 'File sharing', 'Knowledge base', 'Ticketing', 'Visitor monitoring', 'Pre-chat forms', 'CSAT ratings', 'Public API'], cta: 'Get started free', highlight: true },
  { name: 'Remove Branding', priceGBP: 24.99, description: 'Your brand, not ours', features: ['Everything in Free', 'Hide "Powered by Relentify"', 'Custom widget styling'], cta: 'Add branding removal' },
  { name: 'AI Assist', priceGBP: 24.99, description: 'AI answers from your KB', features: ['Everything in Free', 'AI auto-replies', 'Knowledge base context', 'Escalation keywords', 'Bring your own API key'], cta: 'Add AI auto-reply' },
]

export default function ChatPage() {
  const { theme } = useTheme()

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="py-20 px-6 text-center max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] text-sm font-medium mb-6">
            <MessageSquare size={16} /> Free forever
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight" style={{ fontFamily: theme.typography?.headings }}>
            Free live chat for your website
          </h1>
          <p className="text-lg text-[var(--theme-text-muted)] mb-8 max-w-2xl mx-auto">
            Unlimited agents. Unlimited history. Forever free. Add a chat widget to your website in 2 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="https://auth.relentify.com/register" className="px-8 py-3 rounded-xl bg-[var(--theme-primary)] text-white font-medium hover:opacity-90 transition-opacity">
              Add to your website — it&apos;s free
            </a>
            <a href="#comparison" className="px-8 py-3 rounded-xl border border-[var(--theme-border)] hover:bg-[var(--theme-card)] transition-colors">
              See how we compare
            </a>
          </div>
        </motion.div>
      </section>

      {/* Feature Grid */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-2">Everything included. Free.</h2>
        <p className="text-center text-[var(--theme-text-muted)] mb-10">No feature gates. No per-seat pricing. No catch.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-[var(--theme-border)] p-4 hover:bg-[var(--theme-card)] transition-colors">
              <f.icon size={20} className="text-[var(--theme-primary)] mb-2" />
              <h3 className="font-medium text-sm mb-0.5">{f.title}</h3>
              <p className="text-xs text-[var(--theme-text-muted)]">{f.desc}</p>
              <span className="inline-block mt-2 text-[10px] px-1.5 py-0.5 rounded bg-[var(--theme-success)]/10 text-[var(--theme-success)] font-medium">FREE</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section id="comparison" className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-2">More than Tawk.to — for the same price</h2>
        <p className="text-center text-[var(--theme-text-muted)] mb-8">We give you everything they do, plus customer portal, SLA management, and collision detection. Free.</p>
        <div className="rounded-2xl border border-[var(--theme-border)] overflow-hidden">
          <ComparisonTable title="Feature" competitor="Tawk.to" rows={TAWKTO_COMPARISON} pricingRow={{ us: 'Free', them: 'Free' }} />
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-2">Simple pricing</h2>
        <p className="text-center text-[var(--theme-text-muted)] mb-10">Free forever. Optional add-ons if you need them.</p>
        <PricingCards plans={CHAT_PLANS} />
      </section>

      {/* Widget embed snippet */}
      <section className="py-16 px-6 max-w-3xl mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4">Add to your website in 2 minutes</h2>
        <div className="rounded-xl bg-[var(--theme-card)] border border-[var(--theme-border)] p-4 text-left font-mono text-sm overflow-x-auto mb-6">
          <code className="text-[var(--theme-text-muted)]">&lt;script src=&quot;https://chat.relentify.com/widget.js&quot; data-entity-id=&quot;YOUR_ID&quot;&gt;&lt;/script&gt;</code>
        </div>
        <a href="https://auth.relentify.com/register" className="inline-block px-8 py-3 rounded-xl bg-[var(--theme-primary)] text-white font-medium hover:opacity-90">
          Sign up free
        </a>
      </section>
    </div>
  )
}
