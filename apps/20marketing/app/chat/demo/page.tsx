'use client'
import { useTheme } from '@relentify/ui'
import { motion } from 'motion/react'
import { MessageSquare, ArrowRight } from 'lucide-react'
import Script from 'next/script'

export default function ChatDemoPage() {
  const { theme } = useTheme()

  return (
    <div className="min-h-screen">
      <section className="py-16 px-6 text-center max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] text-sm font-medium mb-6">
            <MessageSquare size={16} /> Live Demo
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: theme.typography?.headings }}>
            Try Relentify Chat right now
          </h1>
          <p className="text-lg text-[var(--theme-text-muted)] mb-4 max-w-2xl mx-auto">
            This is a live widget — click the chat bubble in the bottom right to start a conversation. AI will respond from our knowledge base.
          </p>
        </motion.div>
      </section>

      <section className="px-6 max-w-5xl mx-auto mb-16">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: what the visitor sees */}
          <div>
            <h2 className="text-lg font-bold mb-4">What your customers see</h2>
            <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 min-h-[400px] flex flex-col items-center justify-center text-center">
              <MessageSquare size={48} className="text-[var(--theme-primary)] mb-4 opacity-50" />
              <p className="text-sm text-[var(--theme-text-muted)] mb-2">
                A floating chat bubble appears on your website.
              </p>
              <p className="text-sm text-[var(--theme-text-muted)] mb-4">
                Click the bubble in the <strong>bottom right</strong> of this page to try it.
              </p>
              <div className="space-y-3 text-left w-full max-w-xs">
                <div className="rounded-xl bg-[var(--theme-background)] border border-[var(--theme-border)] p-3 text-xs">
                  <strong>Visitor:</strong> &quot;How much does it cost?&quot;
                </div>
                <div className="rounded-xl bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/20 p-3 text-xs">
                  <strong>AI:</strong> &quot;Relentify Chat is completely free — unlimited agents, unlimited history. Optional add-ons start at £24.99/mo.&quot;
                </div>
              </div>
            </div>
          </div>

          {/* Right: what the agent sees */}
          <div>
            <h2 className="text-lg font-bold mb-4">What your agents see</h2>
            <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 min-h-[400px]">
              <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-background)] overflow-hidden">
                <div className="px-4 py-2 bg-[var(--theme-primary)] text-white text-sm font-medium">Agent Inbox</div>
                <div className="p-4 space-y-3 text-xs">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--theme-card)] border border-[var(--theme-border)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--theme-success)]" />
                    <span className="font-medium">Anonymous Visitor</span>
                    <span className="ml-auto text-[var(--theme-text-muted)]">just now</span>
                  </div>
                  <div className="p-3 border-l-2 border-[var(--theme-primary)]">
                    <p className="text-[var(--theme-text-muted)] mb-1">Visitor info: Chrome, London, UK</p>
                    <p className="text-[var(--theme-text-muted)]">Page: /pricing</p>
                  </div>
                  <p className="text-[var(--theme-text-muted)]">Agents see real-time messages, visitor info, page URL, and can reply or let AI handle it.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Callouts */}
      <section className="py-16 px-6 max-w-3xl mx-auto text-center">
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="rounded-xl border border-[var(--theme-border)] p-4">
            <p className="font-medium text-sm mb-1">AI-Powered</p>
            <p className="text-xs text-[var(--theme-text-muted)]">AI answers from your knowledge base articles</p>
          </div>
          <div className="rounded-xl border border-[var(--theme-border)] p-4">
            <p className="font-medium text-sm mb-1">Real-Time</p>
            <p className="text-xs text-[var(--theme-text-muted)]">SSE streaming — no polling, instant delivery</p>
          </div>
          <div className="rounded-xl border border-[var(--theme-border)] p-4">
            <p className="font-medium text-sm mb-1">2-Minute Setup</p>
            <p className="text-xs text-[var(--theme-text-muted)]">One script tag. That is it.</p>
          </div>
        </div>

        <a href="https://auth.relentify.com/register" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[var(--theme-primary)] text-white font-medium hover:opacity-90">
          Add to your website — free <ArrowRight size={16} />
        </a>
      </section>

      {/* Embed the actual widget */}
      <Script src="https://chat.relentify.com/widget.js" data-entity-id="demo" strategy="lazyOnload" />
    </div>
  )
}
