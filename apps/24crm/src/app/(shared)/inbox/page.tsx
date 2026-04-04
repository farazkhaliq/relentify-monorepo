'use client'

import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { useApiDoc } from '@/hooks/use-api'
import { useSSE } from '@/hooks/use-sse'

// Chat components
import SessionList from '@/components/inbox/SessionList'
import ChatThread from '@/components/inbox/ChatThread'
import ReplyInput from '@/components/inbox/ReplyInput'
import VisitorSidebar from '@/components/inbox/VisitorSidebar'

// Connect components
import ConversationList from '@/components/inbox/ConversationList'
import ConversationThread from '@/components/inbox/ConversationThread'
import ComposeMessage from '@/components/inbox/ComposeMessage'
import ContactSidebar from '@/components/inbox/ContactSidebar'

function ChatInbox() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [agentViewing, setAgentViewing] = useState<string | null>(null)
  const { data: config } = useApiDoc<any>('/api/config')

  useSSE({ url: '/api/events', events: { new_session: () => {} } })
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
      <div className="w-80 flex-shrink-0">
        <SessionList selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--theme-border)]">
        {selectedId ? (
          <>
            <ChatThread sessionId={selectedId} agentViewing={agentViewing} />
            <ReplyInput sessionId={selectedId} cannedResponses={config?.canned_responses || []} onSent={() => {}} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--theme-text-muted)]">
            <MessageSquare size={48} className="mb-4 opacity-30" />
            <p className="text-sm">Select a conversation to get started</p>
          </div>
        )}
      </div>
      {selectedId && <VisitorSidebar sessionId={selectedId} />}
    </div>
  )
}

function ConnectInbox() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: conv } = useApiDoc<any>(selectedId ? `/api/conversations/${selectedId}` : null)

  useSSE({ url: '/api/events', events: { new_conversation: () => {} } })

  return (
    <div className="flex h-[calc(100vh-64px)] -m-4 sm:-m-6 overflow-hidden">
      <div className="w-80 flex-shrink-0">
        <ConversationList selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--theme-border)]">
        {selectedId && conv ? (
          <>
            <ConversationThread conversationId={selectedId} />
            <ComposeMessage conversationId={selectedId} channel={conv.channel} onSent={() => {}} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--theme-text-muted)]">
            <MessageSquare size={48} className="mb-4 opacity-30" />
            <p className="text-sm">Select a conversation to get started</p>
          </div>
        )}
      </div>
      {selectedId && <ContactSidebar conversationId={selectedId} />}
    </div>
  )
}

export default function InboxPage() {
  // Detect product from hostname
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  const isChat = host.includes('chat.')

  return isChat ? <ChatInbox /> : <ConnectInbox />
}
