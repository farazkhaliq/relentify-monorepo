'use client'

import { useEffect, useRef, useState } from 'react'
import { useApiDoc } from '@/hooks/use-api'
import { useSSE } from '@/hooks/use-sse'
import { format } from 'date-fns'
import { getChannelIcon } from './ChannelFilter'

const SENDER_STYLES: Record<string, string> = {
  contact: 'bg-[var(--theme-primary)] text-white ml-auto rounded-br-sm',
  agent: 'bg-[var(--theme-card)] border border-[var(--theme-border)] mr-auto rounded-bl-sm',
  ai: 'bg-[var(--theme-card)] border border-[var(--theme-border)] mr-auto rounded-bl-sm',
  system: 'bg-[var(--theme-warning)]/20 text-[var(--theme-text)] mx-auto text-center text-xs italic',
  bot: 'bg-[var(--theme-card)] border border-dashed border-[var(--theme-border)] mr-auto rounded-bl-sm',
  note: 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 mr-auto rounded-bl-sm',
}

const SENDER_LABELS: Record<string, string> = {
  contact: 'Contact', agent: 'Agent', ai: 'AI', system: 'System', bot: 'Bot', note: 'Note',
}

interface ConversationThreadProps {
  conversationId: string
}

export default function ConversationThread({ conversationId }: ConversationThreadProps) {
  const { data, mutate } = useApiDoc<any[]>(`/api/conversations/${conversationId}/messages`)
  const messages = data || []
  const bottomRef = useRef<HTMLDivElement>(null)
  const [typing, setTyping] = useState(false)

  useSSE({
    url: `/api/conversations/${conversationId}/stream`,
    events: {
      new_message: () => mutate(),
      typing: (d: any) => {
        if (d.sender_type === 'contact') { setTyping(true); setTimeout(() => setTyping(false), 3000) }
      },
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((m: any) => {
        const ChannelIcon = getChannelIcon(m.channel)
        return (
          <div key={m.id} className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${SENDER_STYLES[m.sender_type] || SENDER_STYLES.agent}`}>
            <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--theme-text-muted)] mb-0.5">
              <ChannelIcon size={10} />
              {SENDER_LABELS[m.sender_type] || m.sender_type}
            </div>
            <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
            {m.attachment_url && (
              <a href={m.attachment_url} target="_blank" rel="noopener" className="text-xs underline mt-1 block">Attachment</a>
            )}
            <div className="text-[10px] text-[var(--theme-text-dim)] mt-1">{format(new Date(m.created_at), 'HH:mm')}</div>
          </div>
        )
      })}
      {typing && (
        <div className="flex items-center gap-1 text-[var(--theme-text-muted)] text-xs">
          <span className="animate-pulse">●</span><span className="animate-pulse">●</span><span className="animate-pulse">●</span>
          <span className="ml-1">Contact is typing...</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
