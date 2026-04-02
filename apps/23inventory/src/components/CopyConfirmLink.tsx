'use client'
import { useState } from 'react'
import { Link2, Check, Mail, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@relentify/ui'
import { useCopyConfirmLink } from '@/hooks/useCopyConfirmLink'

export default function CopyConfirmLink({ 
  url, 
  inventoryId, 
  tenantEmail, 
  emailSentAt 
}: { 
  url: string; 
  inventoryId: string; 
  tenantEmail: string | null; 
  emailSentAt: string | null 
}) {
  const [copied, setCopied] = useState(false)
  const { loading, sentAt, error, sendEmail } = useCopyConfirmLink(inventoryId, emailSentAt)

  const copy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 p-1.5 bg-[var(--theme-border)] rounded-cinematic border border-[var(--theme-border)] animate-in slide-in-from-right-4 duration-500">
        <div className="px-3 py-1.5 text-[var(--theme-text-10)] font-mono text-[var(--theme-text-dim)] uppercase tracking-wider truncate max-w-[var(--theme-size-140)]">
          {url.replace(/^https?:\/\//, '')}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          className={`h-8 rounded-lg font-mono text-[var(--theme-text-10)] uppercase tracking-widest px-4 ${
            copied ? 'bg-[var(--theme-success)] text-[var(--theme-text)] shadow-lg shadow-[var(--theme-success)]/20' : 'bg-[var(--theme-border)] border border-[var(--theme-border)]'
          }`}
        >
          {copied ? <Check size={14} className="mr-2" /> : <Link2 size={14} className="mr-2" />}
          {copied ? 'Copied' : 'Link'}
        </Button>
      </div>

      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          disabled={loading || !tenantEmail}
          onClick={() => sendEmail()}
          className={`h-11 rounded-xl font-mono text-[var(--theme-text-10)] uppercase tracking-widest px-6 transition-all duration-500 ${
            sentAt 
              ? 'border-[var(--theme-success)]/30 bg-[var(--theme-success)]/10 text-[var(--theme-success)]' 
              : 'border-[var(--theme-border)] bg-[var(--theme-border)]'
          }`}
        >
          {loading ? (
            <Loader2 size={14} className="mr-2 animate-spin" />
          ) : sentAt ? (
            <Sparkles size={14} className="mr-2 animate-pulse" />
          ) : (
            <Mail size={14} className="mr-2" />
          )}
          {loading ? 'Transmitting...' : sentAt ? 'Signal Sent' : 'Email Stakeholder'}
        </Button>
        
        {error && (
          <div className="absolute top-full right-0 mt-2 text-[var(--theme-text-10)] font-mono text-[var(--theme-destructive)] uppercase tracking-widest bg-[var(--theme-destructive)]/10 px-2 py-1 rounded-md border border-[var(--theme-destructive)]/20">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
