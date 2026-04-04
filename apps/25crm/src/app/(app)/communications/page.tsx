'use client'

import React from 'react'
import { Archive, MessageSquare, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useApiCollection } from '@/hooks/use-api'
import { Card, CardContent } from '@relentify/ui'
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@relentify/ui'
import { Badge } from '@relentify/ui'
import { format } from 'date-fns'

export default function CommunicationsArchivePage() {
  const { data: comms, isLoading } = useApiCollection<any>('/api/communications')

  return (
    <div>
      {/* Banner pointing to new inbox */}
      <div className="mb-6 p-4 rounded-xl bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/20 flex items-center gap-4">
        <MessageSquare size={24} className="text-[var(--theme-primary)] flex-shrink-0" />
        <div className="flex-1">
          <h2 className="font-bold text-sm">New: Unified Inbox</h2>
          <p className="text-xs text-[var(--theme-text-muted)]">
            All new messages are now in the multi-channel Inbox. Chat, email, WhatsApp, SMS, and voice — all in one place.
          </p>
        </div>
        <Link href="/inbox" className="flex items-center gap-1 px-4 py-2 bg-[var(--theme-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 flex-shrink-0">
          Open Inbox <ArrowRight size={14} />
        </Link>
      </div>

      {/* Archive header */}
      <div className="flex items-center gap-3 mb-6">
        <Archive size={24} className="text-[var(--theme-text-muted)]" />
        <div>
          <h1 className="text-2xl font-bold">Communications Archive</h1>
          <p className="text-sm text-[var(--theme-text-muted)]">Historical communications from the legacy system. Read-only.</p>
        </div>
      </div>

      {/* Archive table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-[var(--theme-text-muted)]">Loading archive...</TableCell>
                </TableRow>
              )}
              {!isLoading && comms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-[var(--theme-text-muted)]">No archived communications</TableCell>
                </TableRow>
              )}
              {comms.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{c.communication_type || 'unknown'}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{c.subject || '(no subject)'}</TableCell>
                  <TableCell className="capitalize text-[var(--theme-text-muted)]">{c.direction || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{c.status || 'sent'}</Badge>
                  </TableCell>
                  <TableCell className="text-[var(--theme-text-muted)]">
                    {c.created_at ? format(new Date(c.created_at), 'dd MMM yyyy HH:mm') : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
