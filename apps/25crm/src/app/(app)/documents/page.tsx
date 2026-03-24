'use client';

import { collection, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import { File, Download, User, Home, FileText, PlusCircle, LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';
import React, { useState, useMemo } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@relentify/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@relentify/ui";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@relentify/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@relentify/ui";
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { AddDocumentDialog } from '@/components/add-document-dialog';
import { Badge } from '@relentify/ui';
import { Button } from '@relentify/ui';
import { EditDocumentDialog } from '@/components/edit-document-dialog';

interface Document {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  uploadDate: any;
  uploadedByUserId: string;
  description?: string;
  tags?: string[];
  propertyIds?: string[];
  tenancyIds?: string[];
  contactIds?: string[];
}

export default function DocumentsPage() {
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [contactFilter, setContactFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  
  const firestore = useFirestore();
  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;

  // --- Data Fetching ---
  const documentsQuery = useMemoFirebase(() =>
    (firestore && organizationId)
      ? query(
          collection(firestore, `organizations/${organizationId}/documents`),
          orderBy('uploadDate', 'desc')
        )
      : null,
    [firestore, organizationId]
  );
  const { data: documents, isLoading: loadingDocuments } = useCollection<Document>(documentsQuery);

  const usersQuery = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/userProfiles`) : null,
    [firestore, organizationId]
  );
  const { data: users, isLoading: loadingUsers } = useCollection<any>(usersQuery);

  const contactsQuery = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/contacts`) : null,
    [firestore, organizationId]
  );
  const { data: contacts, isLoading: loadingContacts } = useCollection<any>(contactsQuery);

  const propertiesQuery = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/properties`) : null,
    [firestore, organizationId]
  );
  const { data: properties, isLoading: loadingProperties } = useCollection<any>(propertiesQuery);

  // --- Data Processing & Filtering ---
  const userMap = useMemo(() => new Map(users?.map(u => [u.id, `${u.firstName} ${u.lastName}`]) || []), [users]);
  const contactMap = useMemo(() => new Map(contacts?.map(c => [c.id, `${c.firstName} ${c.lastName}`]) || []), [contacts]);
  const propertyMap = useMemo(() => new Map(properties?.map(p => [p.id, p.addressLine1]) || []), [properties]);
  
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    return documents.filter(doc => {
        const propertyMatch = propertyFilter === 'all' || (doc.propertyIds && doc.propertyIds.includes(propertyFilter));
        const contactMatch = contactFilter === 'all' || (doc.contactIds && doc.contactIds.includes(contactFilter));
        const userMatch = userFilter === 'all' || doc.uploadedByUserId === userFilter;
        return propertyMatch && contactMatch && userMatch;
    });
  }, [documents, propertyFilter, contactFilter, userFilter]);

  const getTimestampAsDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
    if (typeof timestamp === 'string') { return new Date(timestamp); }
    return new Date();
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  const linkedEntityBadges = (doc: any) => (
    <div className="flex flex-wrap gap-1 items-center">
      {doc.contactIds?.map((id: string) => contactMap.get(id) && (
        <Badge key={id} variant="zinc" className="font-normal">
          <User className="h-3 w-3 mr-1.5" />
          <Link href={`/contacts/${id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
            {contactMap.get(id)}
          </Link>
        </Badge>
      ))}
      {doc.propertyIds?.map((id: string) => propertyMap.get(id) && (
        <Badge key={id} variant="zinc" className="font-normal">
          <Home className="h-3 w-3 mr-1.5" />
          <Link href={`/properties/${id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
            {propertyMap.get(id)}
          </Link>
        </Badge>
      ))}
      {doc.tenancyIds?.map((id: string) => (
        <Badge key={id} variant="zinc" className="font-normal">
          <FileText className="h-3 w-3 mr-1.5" />
          <Link href={`/tenancies/${id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
            Tenancy Agreement
          </Link>
        </Badge>
      ))}
    </div>
  );

  const isLoading = loadingDocuments || loadingUsers || loadingCurrentUser || loadingContacts || loadingProperties;

  const EmptyState = () => (
    <Card className="col-span-full">
        <CardContent className="py-10 text-center">
            <h3 className="mt-2 text-xl font-semibold">No documents found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                Get started by adding a new document.
            </p>
            <div className="mt-6">
                <Button onClick={() => setAddDialogOpen(true)}>Add Document</Button>
            </div>
        </CardContent>
    </Card>
  );

  return (
    <>
      <AddDocumentDialog open={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditDocumentDialog document={editingDocument} open={!!editingDocument} onOpenChange={(isOpen) => !isOpen && setEditingDocument(null)} />
      <div className="flex flex-col gap-6">
        <Tabs defaultValue="list" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Documents</h1>
            <div className="flex items-center gap-2">
              <TabsList className="hidden md:grid w-full grid-cols-2 h-9">
                <TabsTrigger value="list" className="h-7"><List className="h-4 w-4 mr-2" />List</TabsTrigger>
                <TabsTrigger value="grid" className="h-7"><LayoutGrid className="h-4 w-4 mr-2" />Grid</TabsTrigger>
              </TabsList>
              <Select value={propertyFilter} onValueChange={setPropertyFilter} disabled={isLoading}>
                  <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue placeholder="Filter by property..." /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Properties</SelectItem>{properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.addressLine1}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={contactFilter} onValueChange={setContactFilter} disabled={isLoading}>
                  <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue placeholder="Filter by contact..." /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Contacts</SelectItem>{contacts?.map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={userFilter} onValueChange={setUserFilter} disabled={isLoading}>
                  <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue placeholder="Filter by user..." /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Users</SelectItem>{users?.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" className="h-8 gap-1" onClick={() => setAddDialogOpen(true)}>
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Document</span>
              </Button>
            </div>
          </div>
          <TabsContent value="list" className="mt-0">
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Uploaded</TableHead>
                      <TableHead className="hidden md:table-cell">Size</TableHead>
                      <TableHead className="hidden lg:table-cell">Tags</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                          <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-32" /></TableCell>
                          <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-16" /></TableCell>
                          <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredDocuments && filteredDocuments.length > 0 ? (
                      filteredDocuments.map((doc) => (
                        <TableRow key={doc.id} className="cursor-pointer" onClick={() => setEditingDocument(doc)}>
                          <TableCell>
                            <div className="flex items-start gap-3">
                              <File className="h-5 w-5 text-muted-foreground mt-0.5" />
                              <div className="flex flex-col gap-1.5">
                                  <span className="font-medium truncate max-w-xs">{doc.fileName}</span>
                                  <span className="text-xs text-muted-foreground">Uploaded by {userMap.get(doc.uploadedByUserId) || 'Unknown'}</span>
                                  {linkedEntityBadges(doc)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground" title={format(getTimestampAsDate(doc.uploadDate), 'PPpp')}>
                              {formatDistanceToNow(getTimestampAsDate(doc.uploadDate), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{formatFileSize(doc.fileSize)}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                              <div className="flex flex-wrap gap-1">
                                  {doc.tags?.map((tag: string) => <Badge key={tag} variant="zinc">{tag}</Badge>)}
                              </div>
                          </TableCell>
                          <TableCell className="text-right">
                              <Button asChild variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                  <Link href={doc.filePath} target="_blank" download={doc.fileName}>
                                      <Download className="h-4 w-4" />
                                  </Link>
                              </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">
                          No documents found matching your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="grid" className="mt-0">
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <Card key={i}>
                      <CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
                      <CardContent><Skeleton className="h-10 w-full" /></CardContent>
                      <CardFooter><Skeleton className="h-4 w-1/3" /></CardFooter>
                    </Card>
                  ))
                ) : filteredDocuments && filteredDocuments.length > 0 ? (
                  filteredDocuments.map((doc) => (
                    <Card key={doc.id} className="flex flex-col cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setEditingDocument(doc)}>
                      <CardHeader>
                        <CardTitle className="flex items-start justify-between text-base">
                          <span className="truncate pr-2">{doc.fileName}</span>
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Link href={doc.filePath} target="_blank" download={doc.fileName}>
                              <Download className="h-4 w-4" />
                            </Link>
                          </Button>
                        </CardTitle>
                        <CardDescription>
                          {formatDistanceToNow(getTimestampAsDate(doc.uploadDate), { addSuffix: true })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1">
                        {linkedEntityBadges(doc)}
                      </CardContent>
                      <CardFooter>
                        <p className="text-xs text-muted-foreground">
                          By: {userMap.get(doc.uploadedByUserId) || 'Unknown'}
                        </p>
                      </CardFooter>
                    </Card>
                  ))
                ) : (
                   <div className="col-span-full"><EmptyState /></div>
                )}
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
