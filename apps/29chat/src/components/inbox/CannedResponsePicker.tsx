'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquareText } from 'lucide-react'

interface CannedResponse {
  title: string
  body: string
}

interface CannedResponsePickerProps {
  responses: CannedResponse[]
  onSelect: (body: string) => void
}

export default function CannedResponsePicker({ responses, onSelect }: CannedResponsePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!responses || responses.length === 0) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded hover:bg-[var(--theme-card)] text-[var(--theme-text-muted)]"
        title="Canned responses"
      >
        <MessageSquareText size={16} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-64 bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
          {responses.map((r, i) => (
            <button
              key={i}
              onClick={() => { onSelect(r.body); setOpen(false) }}
              className="w-full text-left px-3 py-2 hover:bg-[var(--theme-card)] border-b border-[var(--theme-border)] last:border-0"
            >
              <div className="text-xs font-medium">{r.title}</div>
              <div className="text-[11px] text-[var(--theme-text-muted)] truncate">{r.body}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
