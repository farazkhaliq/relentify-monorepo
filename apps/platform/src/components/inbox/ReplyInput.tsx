'use client'

import { useState, useRef } from 'react'
import { Send, StickyNote, Paperclip } from 'lucide-react'
import CannedResponsePicker from './CannedResponsePicker'
import { apiCreate } from '@/hooks/use-api'

interface ReplyInputProps {
  sessionId: string
  cannedResponses: any[]
  onSent: () => void
}

export default function ReplyInput({ sessionId, cannedResponses, onSent }: ReplyInputProps) {
  const [text, setText] = useState('')
  const [isNote, setIsNote] = useState(false)
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSend() {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await apiCreate(`/api/sessions/${sessionId}/messages`, {
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleTyping() {
    try { await fetch(`/api/sessions/${sessionId}/typing`, { method: 'POST' }) } catch {}
  }

  return (
    <div className={`border-t p-3 ${isNote ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10' : 'border-[var(--theme-border)]'}`}>
      {isNote && (
        <div className="text-[11px] font-medium text-yellow-600 dark:text-yellow-400 mb-1">
          📝 Internal note — not visible to visitor
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsNote(!isNote)}
            className={`p-1.5 rounded transition-colors ${isNote ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300' : 'hover:bg-[var(--theme-card)] text-[var(--theme-text-muted)]'}`}
            title={isNote ? 'Switch to reply' : 'Switch to note'}
          >
            <StickyNote size={16} />
          </button>
          <CannedResponsePicker
            responses={cannedResponses}
            onSelect={(body) => setText(body)}
          />
        </div>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
          onKeyDown={handleKeyDown}
          onInput={handleTyping}
          placeholder={isNote ? 'Write an internal note...' : 'Type a reply...'}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] max-h-[120px]"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="p-2 rounded-lg bg-[var(--theme-primary)] text-white disabled:opacity-50 hover:opacity-90 flex-shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
