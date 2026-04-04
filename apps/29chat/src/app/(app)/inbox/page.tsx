'use client'

import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import SessionList from '@/components/inbox/SessionList'
import ChatThread from '@/components/inbox/ChatThread'
import ReplyInput from '@/components/inbox/ReplyInput'
import VisitorSidebar from '@/components/inbox/VisitorSidebar'
import { useApiDoc } from '@/hooks/use-api'
import { useSSE } from '@/hooks/use-sse'

export default function InboxPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [agentViewing, setAgentViewing] = useState<string | null>(null)
  const { data: config } = useApiDoc<any>('/api/config')

  // Dashboard-level SSE for new sessions
  useSSE({
    url: '/api/events',
    events: {
      new_session: () => {
        // Session list will auto-refresh via SWR
      },
    },
  })

  // Session-level SSE for agent collision detection
  useSSE({
    url: selectedId ? `/api/sessions/${selectedId}/stream` : null,
    events: {
      agent_viewing: (d: any) => {
        setAgentViewing(d.agent_name || null)
        setTimeout(() => setAgentViewing(null), 30000)
      },
    },
  })

  return (
    <div className="flex h-[calc(100vh-64px)] -m-4 sm:-m-6 overflow-hidden">
      {/* Left: Session list */}
      <div className="w-80 flex-shrink-0">
        <SessionList selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* Center: Chat thread */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--theme-border)]">
        {selectedId ? (
          <>
            <ChatThread sessionId={selectedId} agentViewing={agentViewing} />
            <ReplyInput
              sessionId={selectedId}
              cannedResponses={config?.canned_responses || []}
              onSent={() => {}}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--theme-text-muted)]">
            <MessageSquare size={48} className="mb-4 opacity-30" />
            <p className="text-sm">Select a conversation to get started</p>
          </div>
        )}
      </div>

      {/* Right: Visitor sidebar */}
      {selectedId && <VisitorSidebar sessionId={selectedId} />}
    </div>
  )
}
