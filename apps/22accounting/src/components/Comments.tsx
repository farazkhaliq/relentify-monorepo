'use client'
import { useEffect, useState } from 'react'
import { toast } from '@relentify/ui'

type CommentRecordType = 'bill' | 'invoice' | 'expense' | 'bank_transaction' | 'journal'

interface Comment {
  id: string
  user_id: string
  actor_id: string | null
  target_user_id: string | null
  body: string
  status: 'open' | 'resolved'
  waiting_on: 'client' | 'accountant' | null
  read_at: string | null
  created_at: string
  sender_name: string
  replies: Comment[]
}

interface Props {
  recordType: CommentRecordType
  recordId: string
  currentUserId: string
  targetUserId?: string | null  // who to direct new comments to (the other party)
  isAccountant?: boolean
}

const REQUEST_RECEIPT_TYPES: CommentRecordType[] = ['bill', 'expense', 'bank_transaction']

function CommentNode({
  comment,
  depth,
  currentUserId,
  onReply,
  onResolve,
}: {
  comment: Comment
  depth: number
  currentUserId: string
  onReply: (parentId: string, body: string) => Promise<void>
  onResolve: (id: string) => Promise<void>
}) {
  const [replying, setReplying] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const indent = Math.min(depth, 6) * 16  // cap visual indent at 96px

  async function submitReply() {
    if (!replyBody.trim()) return
    setSubmitting(true)
    await onReply(comment.id, replyBody.trim())
    setReplyBody('')
    setReplying(false)
    setSubmitting(false)
  }

  const isOwn = comment.user_id === currentUserId
  const isUnread = !comment.read_at && comment.target_user_id === currentUserId

  return (
    <div style={{ marginLeft: `${indent}px` }} className="group">
      <div className={`p-3 rounded-xl border mb-1 ${isUnread ? 'border-[var(--theme-accent)]/40 bg-[var(--theme-accent)]/5' : 'border-[var(--theme-border)] bg-[var(--theme-card)]'} ${comment.status === 'resolved' ? 'opacity-50' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-[var(--theme-text)]">{comment.sender_name}</span>
              {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent)] shrink-0" />}
              <span className="text-xs text-[var(--theme-text-muted)]">{new Date(comment.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              {comment.waiting_on && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--theme-warning)]/10 text-[var(--theme-warning)] font-medium">
                  Waiting: {comment.waiting_on}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--theme-text)] whitespace-pre-wrap">{comment.body}</p>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => setReplying(r => !r)}
              className="text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] px-2 py-1 rounded"
            >
              Reply
            </button>
            {comment.status === 'open' && (
              <button
                onClick={() => onResolve(comment.id)}
                className="text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] px-2 py-1 rounded"
              >
                Resolve
              </button>
            )}
          </div>
        </div>

        {replying && (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitReply()}
              placeholder="Reply…"
              className="flex-1 border border-[var(--theme-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--theme-background)] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              autoFocus
            />
            <button
              onClick={submitReply}
              disabled={submitting || !replyBody.trim()}
              className="px-3 py-1.5 bg-[var(--theme-text)] text-[var(--theme-background)] text-xs rounded-lg disabled:opacity-40"
            >
              Send
            </button>
          </div>
        )}
      </div>

      {comment.replies.map(reply => (
        <CommentNode
          key={reply.id}
          comment={reply}
          depth={depth + 1}
          currentUserId={currentUserId}
          onReply={onReply}
          onResolve={onResolve}
        />
      ))}
    </div>
  )
}

export default function Comments({
  recordType, recordId, currentUserId, targetUserId, isAccountant
}: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { loadComments() }, [recordType, recordId])

  async function loadComments() {
    setLoading(true)
    try {
      const r = await fetch(
        `/api/comments?recordType=${recordType}&recordId=${recordId}`,
        { credentials: 'include' }
      )
      const d = await r.json()
      if (d.comments) setComments(d.comments)
    } finally {
      setLoading(false)
    }
  }

  async function submitComment(opts?: { parentId?: string; prefill?: string; waitingOn?: string }) {
    const text = opts?.prefill ?? body.trim()
    if (!text) return
    setSubmitting(true)
    try {
      const r = await fetch('/api/comments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordType, recordId,
          body: text,
          parentId: opts?.parentId ?? null,
          targetUserId: targetUserId ?? null,
          waitingOn: opts?.waitingOn ?? (isAccountant ? 'client' : 'accountant'),
        }),
      })
      if (!r.ok) throw new Error('Failed')
      setBody('')
      await loadComments()
    } catch {
      toast('Failed to post comment', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReply(parentId: string, replyBody: string) {
    await submitComment({ parentId, prefill: replyBody })
  }

  async function handleResolve(commentId: string) {
    await fetch(`/api/comments/${commentId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve' }),
    })
    await loadComments()
  }

  function requestReceipt() {
    submitComment({
      prefill: 'Please upload the receipt for this transaction.',
      waitingOn: 'client',
    })
  }

  const openCount = comments.filter(c => c.status === 'open').length

  return (
    <div className="mt-6 border-t border-[var(--theme-border)] pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-[var(--theme-text)]">
          Comments {openCount > 0 && <span className="ml-1 text-xs bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] px-1.5 py-0.5 rounded-full">{openCount}</span>}
        </h3>
        {REQUEST_RECEIPT_TYPES.includes(recordType) && (
          <button
            onClick={requestReceipt}
            disabled={submitting}
            className="text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border border-[var(--theme-border)] rounded-lg px-3 py-1.5 disabled:opacity-40"
          >
            Request receipt
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-[var(--theme-text-dim)]">Loading…</p>
      ) : (
        <div className="space-y-1 mb-4">
          {comments.length === 0 && (
            <p className="text-xs text-[var(--theme-text-dim)]">No comments yet.</p>
          )}
          {comments.map(comment => (
            <CommentNode
              key={comment.id}
              comment={comment}
              depth={0}
              currentUserId={currentUserId}
              onReply={handleReply}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submitComment())}
          placeholder="Add a comment… (Enter to send, Shift+Enter for new line)"
          rows={2}
          className="flex-1 border border-[var(--theme-border)] rounded-xl px-3 py-2 text-sm bg-[var(--theme-background)] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)] resize-none"
        />
        <button
          onClick={() => submitComment()}
          disabled={submitting || !body.trim()}
          className="px-4 py-2 bg-[var(--theme-text)] text-[var(--theme-background)] text-sm rounded-xl self-end disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  )
}
