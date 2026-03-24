# Comments & Threads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add threaded comments to bills, invoices, expenses, bank transactions, and journals — with a central Conversations view and email notifications.

**Architecture:** Single `transaction_comments` table with self-referencing `parent_id` for unlimited nesting. Shared `Comments` React component dropped into each record detail page. Central conversations page aggregates all activity. Notification emails sent immediately on first unread comment, suppressed while unread already exists.

**Tech Stack:** Next.js 15 App Router, TypeScript, PostgreSQL (raw queries via `query()`), Resend email, `@relentify/ui` components

---

## Task 1: Fix /api/auth/me + Migration 023

**Files:**
- Modify: `app/api/auth/me/route.ts`
- Create: `database/migrations/023_comments_threads.sql`

**Steps:**

- [ ] **Step 1: Fix /api/auth/me to return isAccountantAccess**

Read `app/api/auth/me/route.ts`. The `getAuthUser()` call returns a JWTPayload with `isAccountantAccess`. Add it to the JSON response:
```typescript
import { getAuthUser, isWorkspaceMember } from '@/src/lib/auth';
// ...
return NextResponse.json({
  user,
  isWorkspaceMember: auth.actorId !== auth.userId,
  workspacePermissions: auth.workspacePermissions ?? null,
  actorId: auth.actorId,
  isAccountantAccess: auth.isAccountantAccess ?? false,  // ADD THIS
});
```

- [ ] **Step 2: Create migration 023**

```sql
-- 023_comments_threads.sql

CREATE TABLE IF NOT EXISTS transaction_comments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id),
  actor_id        UUID        REFERENCES users(id),
  target_user_id  UUID        REFERENCES users(id),
  record_type     TEXT        NOT NULL
                              CHECK (record_type IN ('bill','invoice','expense','bank_transaction','journal')),
  record_id       UUID        NOT NULL,
  parent_id       UUID        REFERENCES transaction_comments(id),
  body            TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','resolved')),
  waiting_on      TEXT        CHECK (waiting_on IN ('client','accountant')),
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tc_record  ON transaction_comments (record_type, record_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tc_target  ON transaction_comments (target_user_id, created_at DESC) WHERE target_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tc_sender  ON transaction_comments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tc_parent  ON transaction_comments (parent_id) WHERE parent_id IS NOT NULL;
```

- [ ] **Step 3: Run migration**
```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify < /opt/relentify-monorepo/apps/22accounting/database/migrations/023_comments_threads.sql
```

- [ ] **Step 4: Verify**
```bash
docker exec infra-postgres psql -U relentify_user -d relentify -c "\d transaction_comments"
```
Expected: table with 12 columns, 4 indexes.

---

## Task 2: comment.service.ts

**Files:**
- Create: `src/lib/comment.service.ts`

- [ ] **Step 1: Create the service**

```typescript
import { query } from './db';

export interface Comment {
  id: string
  user_id: string
  actor_id: string | null
  target_user_id: string | null
  record_type: string
  record_id: string
  parent_id: string | null
  body: string
  status: 'open' | 'resolved'
  waiting_on: 'client' | 'accountant' | null
  read_at: string | null
  created_at: string
  sender_name: string      // from JOIN users
  replies: Comment[]       // populated in JS
}

// Get all comments for a record, returned as a tree
export async function getComments(
  recordType: string,
  recordId: string
): Promise<Comment[]> {
  const r = await query(
    `SELECT tc.*,
            COALESCE(u.full_name, u.email) as sender_name
     FROM transaction_comments tc
     JOIN users u ON u.id = tc.user_id
     WHERE tc.record_type = $1 AND tc.record_id = $2
     ORDER BY tc.created_at ASC`,
    [recordType, recordId]
  );
  return buildTree(r.rows);
}

// Build nested tree from flat list
function buildTree(rows: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  for (const row of rows) {
    map.set(row.id, { ...row, replies: [] });
  }
  for (const row of rows) {
    const node = map.get(row.id)!;
    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function createComment(params: {
  userId: string
  actorId?: string
  targetUserId?: string | null
  recordType: string
  recordId: string
  parentId?: string | null
  body: string
  waitingOn?: 'client' | 'accountant' | null
}): Promise<Comment> {
  const r = await query(
    `INSERT INTO transaction_comments
       (user_id, actor_id, target_user_id, record_type, record_id, parent_id, body, waiting_on)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      params.userId,
      params.actorId || null,
      params.targetUserId || null,
      params.recordType,
      params.recordId,
      params.parentId || null,
      params.body,
      params.waitingOn || null,
    ]
  );
  return { ...r.rows[0], replies: [] };
}

export async function resolveComment(commentId: string): Promise<void> {
  await query(
    `UPDATE transaction_comments
     SET status = 'resolved', waiting_on = NULL
     WHERE id = $1`,
    [commentId]
  );
}

// Mark all unread comments on a record as read for a specific user
export async function markRecordRead(
  recordType: string,
  recordId: string,
  userId: string
): Promise<void> {
  await query(
    `UPDATE transaction_comments
     SET read_at = NOW()
     WHERE record_type = $1 AND record_id = $2
       AND target_user_id = $3 AND read_at IS NULL`,
    [recordType, recordId, userId]
  );
}

// Check if we should send a notification email
// Returns false if target already has unread comments on this record (they already know)
export async function shouldSendNotification(
  targetUserId: string,
  recordType: string,
  recordId: string
): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM transaction_comments
     WHERE target_user_id = $1 AND record_type = $2 AND record_id = $3
       AND read_at IS NULL
     LIMIT 1`,
    [targetUserId, recordType, recordId]
  );
  return r.rows.length === 0; // true = no unread = should notify
}

// Get all conversations for a user (for the conversations page)
export async function getConversations(userId: string) {
  const r = await query(
    `SELECT
       record_type,
       record_id::text,
       MAX(created_at) as last_at,
       (array_agg(body ORDER BY created_at DESC))[1] as last_body,
       (array_agg(status ORDER BY created_at DESC))[1] as status,
       (array_agg(waiting_on ORDER BY created_at DESC))[1] as waiting_on,
       COUNT(*) FILTER (WHERE target_user_id = $1 AND read_at IS NULL) as unread_count
     FROM transaction_comments
     WHERE user_id = $1 OR target_user_id = $1
     GROUP BY record_type, record_id
     ORDER BY MAX(created_at) DESC
     LIMIT 100`,
    [userId]
  );
  return r.rows;
}
```

- [ ] **Step 2: Verify the file was created correctly**
```bash
head -20 /opt/relentify-monorepo/apps/22accounting/src/lib/comment.service.ts
```

---

## Task 3: Email notification function

**Files:**
- Modify: `src/lib/email.ts` (append at end of file)

- [ ] **Step 1: Append sendCommentNotification to email.ts**

Read the file to find the end, then append:

```typescript
// ── Comment notification ──────────────────────────────────────────────────────

export async function sendCommentNotification(params: {
  to: string
  senderName: string
  body: string
  recordType: string
  recordLabel: string   // e.g. "Bill REF-001", "Invoice #42"
  recordUrl: string     // full URL to the record page
}) {
  const { to, senderName, body, recordType, recordLabel, recordUrl } = params;
  const typeLabel = {
    bill: 'bill', invoice: 'invoice', expense: 'expense',
    bank_transaction: 'bank transaction', journal: 'journal',
  }[recordType] ?? recordType;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Relentify <invoices@relentify.com>',
      to: [to],
      subject: `New comment on ${typeLabel}: ${recordLabel}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="margin-top: 0;">New comment</h2>
          <p><strong>${senderName}</strong> commented on <strong>${recordLabel}</strong>:</p>
          <blockquote style="border-left: 3px solid #e5e7eb; margin: 16px 0; padding: 12px 16px; background: #f9fafb; border-radius: 4px;">
            <p style="margin: 0;">${body.replace(/\n/g, '<br>')}</p>
          </blockquote>
          <p style="margin: 32px 0;">
            <a href="${recordUrl}" style="background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">View comment</a>
          </p>
        </div>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false }; }
    return { success: true, emailId: data?.id };
  } catch (e) {
    console.error('Comment notification failed:', e);
    return { success: false };
  }
}
```

---

## Task 4: API routes

**Files:**
- Create: `app/api/comments/route.ts`
- Create: `app/api/comments/[id]/route.ts`

- [ ] **Step 1: Create GET + POST route**

```typescript
// app/api/comments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import {
  getComments, createComment, shouldSendNotification, markRecordRead
} from '@/src/lib/comment.service';
import { sendCommentNotification } from '@/src/lib/email';
import { getUserById } from '@/src/lib/user.service';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const recordType = searchParams.get('recordType');
  const recordId = searchParams.get('recordId');
  if (!recordType || !recordId) {
    return NextResponse.json({ error: 'recordType and recordId required' }, { status: 400 });
  }

  const comments = await getComments(recordType, recordId);

  // Mark as read for current user
  await markRecordRead(recordType, recordId, auth.userId);

  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    recordType, recordId, body, parentId,
    targetUserId, waitingOn
  } = await req.json();

  if (!recordType || !recordId || !body?.trim()) {
    return NextResponse.json({ error: 'recordType, recordId and body required' }, { status: 400 });
  }

  const comment = await createComment({
    userId: auth.userId,
    actorId: auth.isAccountantAccess ? auth.actorId : undefined,
    targetUserId: targetUserId || null,
    recordType,
    recordId,
    parentId: parentId || null,
    body: body.trim(),
    waitingOn: waitingOn || null,
  });

  // Send notification if target exists and has no unread already
  if (targetUserId) {
    const shouldNotify = await shouldSendNotification(targetUserId, recordType, recordId);
    if (shouldNotify) {
      const targetUser = await getUserById(targetUserId);
      if (targetUser?.email) {
        const senderUser = await getUserById(auth.userId);
        const recordTypeLabels: Record<string, string> = {
          bill: 'Bill', invoice: 'Invoice', expense: 'Expense',
          bank_transaction: 'Bank Transaction', journal: 'Journal',
        };
        const appBase = 'https://accounts.relentify.com';
        const recordPaths: Record<string, string> = {
          bill: `${appBase}/dashboard/bills/${recordId}`,
          invoice: `${appBase}/dashboard/invoices/${recordId}`,
          expense: `${appBase}/dashboard/expenses`,
          bank_transaction: `${appBase}/dashboard/banking`,
          journal: `${appBase}/dashboard/journals`,
        };
        await sendCommentNotification({
          to: targetUser.email,
          senderName: senderUser?.full_name || senderUser?.email || 'Someone',
          body: body.trim(),
          recordType,
          recordLabel: `${recordTypeLabels[recordType] ?? recordType} ${recordId.slice(0, 8)}`,
          recordUrl: recordPaths[recordType] ?? appBase,
        });
      }
    }
  }

  return NextResponse.json({ comment }, { status: 201 });
}
```

- [ ] **Step 2: Create PATCH route for resolving**

```typescript
// app/api/comments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { resolveComment } from '@/src/lib/comment.service';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { action } = await req.json();

  if (action === 'resolve') {
    await resolveComment(id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
```

---

## Task 5: Comments component

**Files:**
- Create: `src/components/Comments.tsx`
- Modify: `src/lib/attachment.service.ts` (add 'comment' to RecordType)

- [ ] **Step 1: Add 'comment' to RecordType in attachment.service.ts**

Read the file, find:
```typescript
export type RecordType = 'bill' | 'expense' | 'mileage' | 'bank_transaction';
```
Change to:
```typescript
export type RecordType = 'bill' | 'expense' | 'mileage' | 'bank_transaction' | 'comment';
```

- [ ] **Step 2: Create Comments component**

```typescript
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
```

---

## Task 6: Wire Comments into record pages

**Files to read first, then modify:**
- `app/dashboard/bills/[id]/page.tsx`
- `app/dashboard/invoices/[id]/page.tsx`
- `app/dashboard/expenses/` — read directory structure first
- `app/dashboard/banking/page.tsx`
- `app/dashboard/journals/` — read directory structure first

**For each page, the pattern is the same:**

1. Add import: `import Comments from '@/src/components/Comments'`
2. Add state for currentUserId (from `/api/auth/me` response) OR pass it from an existing user fetch
3. Add `<Comments recordType="X" recordId={id} currentUserId={currentUserId} targetUserId={ownerId} />` at the bottom of the page content, after Attachments if present

**Step-by-step for each page:**

- [ ] **Step 1: Wire into bills/[id]/page.tsx**

Read the file. It already fetches `/api/bills/${id}` and has `bill` state. The user is the owner — for comments `targetUserId` should be the accountant if one exists (from `/api/auth/me`'s `actorId`). Add:
- State: `const [currentUserId, setCurrentUserId] = useState('')`
- State: `const [targetUserId, setTargetUserId] = useState<string | null>(null)`
- In useEffect or separate fetch: call `/api/auth/me` to get `userId` and `actorId`/`isAccountantAccess`
- Render: `<Comments recordType="bill" recordId={id} currentUserId={currentUserId} targetUserId={targetUserId} />` after `<Attachments ... />`

- [ ] **Step 2: Wire into invoices/[id]/page.tsx** — same pattern, `recordType="invoice"`

- [ ] **Step 3: Wire into expenses page**

Read `app/dashboard/expenses/` structure first. If expenses are inline on a list page (no [id] detail page), add Comments in the expanded row/modal. If there is an expenses/[id]/page.tsx, wire in there. Use `recordType="expense"`.

- [ ] **Step 4: Wire into banking/page.tsx**

Read the file. Bank transactions are likely shown in a list. Find the per-transaction expand/detail section (or add one) and mount `<Comments recordType="bank_transaction" recordId={transaction.id} ... />` there. If transactions open a modal/side panel, add Comments inside it.

- [ ] **Step 5: Wire into journals page**

Read `app/dashboard/journals/` structure. Wire in with `recordType="journal"`.

---

## Task 7: Conversations page + nav link

**Files:**
- Create: `app/dashboard/conversations/page.tsx`
- Create: `app/api/comments/conversations/route.ts`
- Modify: `app/dashboard/layout.tsx`

- [ ] **Step 1: Create conversations page**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Conversation {
  record_type: string
  record_id: string
  last_at: string
  last_body: string
  status: 'open' | 'resolved'
  waiting_on: 'client' | 'accountant' | null
  unread_count: string  // comes as string from pg COUNT
}

const RECORD_PATHS: Record<string, (id: string) => string> = {
  bill: id => `/dashboard/bills/${id}`,
  invoice: id => `/dashboard/invoices/${id}`,
  expense: () => `/dashboard/expenses`,
  bank_transaction: () => `/dashboard/banking`,
  journal: () => `/dashboard/journals`,
}

const RECORD_LABELS: Record<string, string> = {
  bill: 'Bill', invoice: 'Invoice', expense: 'Expense',
  bank_transaction: 'Bank Transaction', journal: 'Journal',
}

export default function ConversationsPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/comments/conversations', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.conversations) setConversations(d.conversations) })
      .finally(() => setLoading(false))
  }, [])

  const openConvs = conversations.filter(c => c.status === 'open')
  const resolvedConvs = conversations.filter(c => c.status === 'resolved')

  function ConvItem({ conv }: { conv: Conversation }) {
    const unread = parseInt(conv.unread_count) > 0
    return (
      <button
        onClick={() => router.push(RECORD_PATHS[conv.record_type]?.(conv.record_id) ?? '/dashboard')}
        className="w-full text-left p-4 border border-[var(--theme-border)] rounded-xl hover:bg-[var(--theme-card)] transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {unread && <span className="w-2 h-2 rounded-full bg-[var(--theme-accent)] shrink-0" />}
              <span className="text-xs font-semibold text-[var(--theme-text)]">
                {RECORD_LABELS[conv.record_type] ?? conv.record_type}
              </span>
              {conv.waiting_on && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--theme-warning)]/10 text-[var(--theme-warning)] font-medium">
                  Waiting: {conv.waiting_on}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--theme-text-muted)] truncate">{conv.last_body}</p>
          </div>
          <span className="text-xs text-[var(--theme-text-dim)] shrink-0">
            {new Date(conv.last_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-[var(--theme-text)]">Conversations</h1>

      {loading ? (
        <p className="text-sm text-[var(--theme-text-dim)]">Loading…</p>
      ) : conversations.length === 0 ? (
        <p className="text-sm text-[var(--theme-text-muted)]">No conversations yet.</p>
      ) : (
        <>
          {openConvs.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-[var(--theme-text-muted)]">Open ({openConvs.length})</h2>
              {openConvs.map(c => <ConvItem key={`${c.record_type}-${c.record_id}`} conv={c} />)}
            </div>
          )}
          {resolvedConvs.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-[var(--theme-text-muted)]">Resolved ({resolvedConvs.length})</h2>
              {resolvedConvs.map(c => <ConvItem key={`${c.record_type}-${c.record_id}`} conv={c} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add /api/comments/conversations route**

Create `app/api/comments/conversations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getConversations } from '@/src/lib/comment.service';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const conversations = await getConversations(auth.userId);
  return NextResponse.json({ conversations });
}
```

- [ ] **Step 3: Add "Conversations" link to nav in layout.tsx**

Read `app/dashboard/layout.tsx`. Find where `TopBarLink` components are rendered for the main nav. Add:
```typescript
<TopBarLink href="/dashboard/conversations">Conversations</TopBarLink>
```

---

## Task 8: Docker rebuild

- [ ] **Step 1: Rebuild 22accounting**
```bash
cd /opt/relentify-monorepo/apps/22accounting
docker compose down
docker compose build --no-cache 2>&1 | tail -30
docker compose up -d
sleep 8
docker logs 22accounting --tail 20
```

- [ ] **Step 2: Verify build succeeded**
```bash
docker ps | grep 22accounting
```
Expected: `22accounting` showing as `(healthy)`

- [ ] **Step 3: Clean up build cache**
```bash
docker builder prune -f
df -h /
```

- [ ] **Step 4: Update CLAUDE.md**

In `/opt/relentify-monorepo/apps/22accounting/CLAUDE.md`, mark item #36 as done and add a brief description: "Comments & threads on financial records with Conversations view and email notifications."
