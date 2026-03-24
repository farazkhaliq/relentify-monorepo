'use client';

import React from 'react';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { usePortalUserProfile } from '@/hooks/use-portal-user-profile';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { Button } from '@relentify/ui';
import { Download } from 'lucide-react';
import Link from 'next/link';

interface Document {
    id: string;
    fileName: string;
    filePath: string;
    uploadDate: any;
    description?: string;
}

export default function PortalDocumentsPage() {
    const firestore = useFirestore();
    const { portalUserProfile, isLoading: isLoadingProfile } = usePortalUserProfile();
    const organizationId = portalUserProfile?.organizationId;
    const contactId = portalUserProfile?.contactId;

    const documentsQuery = useMemoFirebase(() =>
        (firestore && organizationId && contactId) ? query(
            collection(firestore, `organizations/${organizationId}/documents`),
            where('contactIds', 'array-contains', contactId),
            orderBy('uploadDate', 'desc')
        ) : null, [firestore, organizationId, contactId]
    );
    const { data: documents, isLoading: isLoadingDocuments } = useCollection<Document>(documentsQuery);

    const isLoading = isLoadingProfile || isLoadingDocuments;

    const getTimestampAsDate = (timestamp: any): Date => {
        if (!timestamp) return new Date();
        if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
        if (typeof timestamp === 'string') { return new Date(timestamp); }
        return new Date();
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-4xl">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold">Documents</h1>
                <p className="text-muted-foreground">View documents shared with you.</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Your Documents</CardTitle>
                    <CardDescription>A list of documents related to you and your properties.</CardDescription>
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
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : documents && documents.length > 0 ? (
                                documents.map(doc => (
                                    <TableRow key={doc.id}>
                                        <TableCell className="font-medium">{doc.fileName}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(getTimestampAsDate(doc.uploadDate), { addSuffix: true })}</TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild variant="ghost" size="icon">
                                                <Link href={doc.filePath} target="_blank" download={doc.fileName}>
                                                    <Download className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">No documents have been shared with you.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
