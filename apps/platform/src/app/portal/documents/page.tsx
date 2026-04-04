'use client'

import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { usePortalUserProfile } from '@/hooks/use-portal-user-profile'
import { useApiCollection } from '@/hooks/use-api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@relentify/ui'
import { Skeleton } from '@relentify/ui'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@relentify/ui'
import { Button } from '@relentify/ui'
import { Download } from 'lucide-react'
import Link from 'next/link'

export default function PortalDocumentsPage() {
  const { portalUserProfile, isLoading: isLoadingProfile } =
    usePortalUserProfile()
  const contactId = portalUserProfile?.contact_id

  const { data: allDocuments, isLoading: isLoadingDocuments } =
    useApiCollection('/api/documents')

  // Filter to documents linked to this contact
  const documents = React.useMemo(
    () =>
      contactId
        ? allDocuments?.filter((d: any) =>
            d.contact_ids?.includes(contactId)
          ) || []
        : [],
    [allDocuments, contactId]
  )

  const isLoading = isLoadingProfile || isLoadingDocuments

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-muted-foreground">
          View documents shared with you.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your Documents</CardTitle>
          <CardDescription>
            A list of documents related to you and your properties.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-5 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-8 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : documents.length > 0 ? (
                documents.map((doc: any) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      {doc.file_name || doc.fileName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(
                        new Date(doc.upload_date || doc.created_at),
                        { addSuffix: true }
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link
                          href={doc.file_path || doc.filePath || '#'}
                          target="_blank"
                          download={doc.file_name || doc.fileName}
                        >
                          <Download className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">
                    No documents have been shared with you.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
