'use client'

import { useState, useRef } from 'react'
import { Send, StickyNote } from 'lucide-react'
import { apiCreate } from '@/hooks/use-api'

interface ComposeMessageProps {
  conversationId: string
  channel: string
  onSent: () => void
}

export default function ComposeMessage({ conversationId, channel, onSent }: ComposeMessageProps) {
  const [text, setText] = useState('')
  const [isNote, setIsNote] = useState(false)
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSend() {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await apiCreate(`/api/conversations/${conversationId}/messages`, {
        body: text.trim(),
        sender_type: isNote ? 'note' : 'agent',
      })
      setText('')
      setIsNote(false)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      onSent()
    } catch (err) {
      console.error('Send error:', err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`border-t p-3 ${isNote ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10' : 'border-[var(--theme-border)]'}`}>
      {isNote && (
        <div className="text-[11px] font-medium text-yellow-600 dark:text-yellow-400 mb-1">Internal note — not visible to contact</div>
      )}
      <div className="flex items-end gap-2">
        <button onClick={() => setIsNote(!isNote)} title={isNote ? 'Switch to reply' : 'Switch to note'}
          className={`p-1.5 rounded ${isNote ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-700' : 'hover:bg-[var(--theme-card)] text-[var(--theme-text-muted)]'}`}>
          <StickyNote size={16} />
        </button>
        <textarea ref={textareaRef} value={text}
          onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder={isNote ? 'Write an internal note...' : `Reply via ${channel}...`}
          rows={1} className="flex-1 resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none max-h-[120px]" />
        <button onClick={handleSend} disabled={!text.trim() || sending}
          className="p-2 rounded-lg bg-[var(--theme-primary)] text-white disabled:opacity-50 flex-shrink-0">
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
