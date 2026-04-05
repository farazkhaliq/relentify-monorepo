'use client'
import { useTheme } from '@relentify/ui'
import { cn } from '@relentify/ui'
import { motion } from 'motion/react'
import { MessageSquare, Users, File, BookOpen, Ticket, Eye, Zap, FileText, Star, StickyNote, Globe, Webhook, ArrowRight, CheckCircle2 } from 'lucide-react'
import { ComparisonTable } from '../components/ComparisonTable'

const FEATURES = [
  { icon: <Users />, title: 'Unlimited Agents', desc: 'No per-seat charges. Ever. Invite your whole team.' },
  { icon: <File />, title: 'File Sharing', desc: 'Images, PDFs, docs up to 10MB directly in chat.' },
  { icon: <MessageSquare />, title: 'Canned Responses', desc: 'One-click reply templates for common questions.' },
  { icon: <BookOpen />, title: 'Knowledge Base', desc: 'Self-service articles + in-widget search.' },
  { icon: <Ticket />, title: 'Ticketing', desc: 'Convert chats to tickets. SLA tracking built in.' },
  { icon: <Eye />, title: 'Visitor Monitoring', desc: 'See who is on your site right now, and where.' },
  { icon: <Zap />, title: 'Automated Triggers', desc: 'Proactive messages based on visitor behaviour.' },
  { icon: <FileText />, title: 'Pre-Chat Forms', desc: 'Collect name, email, and context before chat.' },
  { icon: <Star />, title: 'CSAT Ratings', desc: 'Customer satisfaction scores per conversation.' },
  { icon: <StickyNote />, title: 'Internal Notes', desc: 'Agent-only notes invisible to the visitor.' },
  { icon: <Globe />, title: 'Multi-Language', desc: 'Widget text translates into any language.' },
  { icon: <Webhook />, title: 'Webhooks API', desc: 'Real-time events streamed to your systems.' },
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

export default function ChatPage() {
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
              Relentify Chat
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`text-6xl md:text-8xl font-bold leading-[0.9] mb-8 ${theme.typography.headings}`}
            >
              Free Live Chat <span className={theme.typography.drama}>Forever.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-[var(--theme-text-muted)] max-w-xl mb-10"
            >
              Unlimited agents. Unlimited history. Forever free. Add a beautiful chat widget to your website in two minutes &mdash; and never pay per seat again.
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
                Add to Your Website <ArrowRight size={18} />
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <div className="aspect-square rounded-cinematic bg-[var(--theme-border)] p-8">
              <div className="w-full h-full bg-[var(--theme-card)] rounded-cinematic shadow-cinematic border border-[var(--theme-border)] p-8 flex flex-col gap-6">
                <div className="flex items-center justify-between mb-4 border-b border-[var(--theme-border)] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--theme-accent)] flex items-center justify-center">
                      <MessageSquare size={18} className="text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold">Support Chat</h4>
                      <p className="text-[var(--theme-text-10)] opacity-40 uppercase font-bold">3 agents online</p>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-[var(--theme-success)] animate-pulse" />
                </div>

                <div className="flex-1 space-y-4 overflow-hidden">
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-[var(--theme-border)] flex-shrink-0" />
                    <div className="bg-[var(--theme-border)] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                      <p className="text-sm">Hi! How can we help you today?</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start justify-end">
                    <div className="bg-[var(--theme-accent)] text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                      <p className="text-sm">When will my order ship?</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-[var(--theme-border)] flex-shrink-0" />
                    <div className="bg-[var(--theme-border)] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                      <p className="text-sm">Your order ships tomorrow, tracking will be emailed.</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-[var(--theme-border)] pt-4">
                  <div className="flex-1 h-10 rounded-full bg-[var(--theme-border)] px-4 flex items-center">
                    <span className="text-xs opacity-40">Type a message...</span>
                  </div>
                  <button className="w-10 h-10 rounded-full bg-[var(--theme-accent)] flex items-center justify-center">
                    <ArrowRight size={14} className="text-white" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className={`text-5xl md:text-7xl font-bold mb-6 ${theme.typography.headings}`}>Free, with optional <span className={theme.typography.drama}>add-ons.</span></h2>
          <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto">
            Free forever for unlimited agents. Remove branding or add AI when you need them.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              name: 'Free',
              price: '£0',
              period: 'forever',
              features: ['Unlimited agents', 'Unlimited history', 'File sharing', 'Knowledge base', 'Ticketing', 'Visitor monitoring', 'Pre-chat forms', 'CSAT ratings', 'Public API']
            },
            {
              name: 'Remove Branding',
              price: '£24.99',
              period: '/mo',
              features: ['Everything in Free', 'Hide "Powered by Relentify"', 'Custom widget styling', 'Your brand, not ours'],
              featured: true
            },
            {
              name: 'AI Assist',
              price: '£24.99',
              period: '/mo',
              features: ['Everything in Free', 'AI auto-replies', 'Knowledge base context', 'Escalation keywords', 'Bring your own API key']
            }
          ].map((tier, i) => (
            <div
              key={i}
              className={cn(
                "rounded-cinematic p-10 border flex flex-col justify-between transition-all duration-500",
                tier.featured
                  ? "bg-[var(--theme-dark)] text-white border-[var(--theme-dark)] shadow-cinematic scale-105 z-10"
                  : "bg-[var(--theme-card)] border-[var(--theme-border)]"
              )}
            >
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-8">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-5xl font-bold">{tier.price}</span>
                  <span className="opacity-40">{tier.period}</span>
                </div>
                <ul className="flex flex-col gap-4 mb-12">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm font-bold">
                      <CheckCircle2 size={16} className={tier.featured ? "text-accent" : "text-[var(--theme-text)]/20"} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href="https://auth.relentify.com/register"
                className={cn(
                  "w-full py-4 rounded-full font-bold transition-all text-center block",
                  tier.featured
                    ? "bg-[var(--theme-accent)] text-white"
                    : "bg-[var(--theme-border)] hover:bg-[var(--theme-dark)]/10"
                )}
              >
                {tier.name === 'Free' ? 'Get Started Free' : 'Add to Plan'}
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
            <h2 className={`text-5xl md:text-7xl font-bold mb-6 ${theme.typography.headings}`}>Everything included. <span className={theme.typography.drama}>No gates.</span></h2>
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

      {/* Comparison */}
      <section id="comparison" className="py-32 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-20">
          <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest text-accent mb-4">Comparison</p>
          <h2 className={`text-5xl md:text-7xl font-bold mb-6 ${theme.typography.headings}`}>More than Tawk.to.</h2>
          <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto">
            Everything they offer, plus customer portal, SLA management, and collision detection. Same price. Free.
          </p>
        </div>
        <div className="rounded-cinematic border border-[var(--theme-border)] overflow-hidden shadow-cinematic">
          <ComparisonTable title="Feature" competitor="Tawk.to" rows={TAWKTO_COMPARISON} pricingRow={{ us: 'Free', them: 'Free' }} />
        </div>
      </section>

      {/* CTA + Embed Snippet */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto bg-[var(--theme-dark)] rounded-cinematic p-12 md:p-20 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-[var(--theme-background-blur)]" />
          <div className="relative z-10">
            <h2 className={`text-4xl md:text-6xl font-bold mb-6 ${theme.typography.headings}`}>Add to your site in <span className={theme.typography.drama}>2 minutes.</span></h2>
            <p className="text-xl text-[var(--theme-text-muted)] mb-12 max-w-xl mx-auto">
              Drop this script tag into your HTML. Done.
            </p>
            <div className="rounded-cinematic bg-black/40 border border-white/10 p-6 text-left font-mono text-sm overflow-x-auto mb-10 backdrop-blur">
              <code className="text-white/80">&lt;script src=&quot;https://chat.relentify.com/widget.js&quot; data-entity-id=&quot;YOUR_ID&quot;&gt;&lt;/script&gt;</code>
            </div>
            <a
              href="https://auth.relentify.com/register"
              className="inline-block px-10 py-5 rounded-full font-bold text-white shadow-cinematic hover:scale-105 transition-transform bg-[var(--theme-accent)]"
            >
              Sign Up Free
            </a>
            <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest opacity-40 mt-8">No credit card required • Unlimited agents forever</p>
          </div>
        </div>
      </section>
    </div>
  )
}
