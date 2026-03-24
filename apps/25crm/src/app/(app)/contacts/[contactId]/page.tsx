'use client';

import { useParams, useRouter } from 'next/navigation';
import { doc, collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@relentify/ui';
import { Avatar, AvatarFallback } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import { Mail, Phone, Home, User, Building, StickyNote, FileText, File, Download, CheckSquare } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@relentify/ui';
import { EditContactDialog } from '@/components/edit-contact-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { format } from 'date-fns';
import { useState } from 'react';
import { AddTaskDialog } from '@/components/add-task-dialog';
import { AddDocumentDialog } from '@/components/add-document-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@relentify/ui';
import { EditDocumentDialog } from '@/components/edit-document-dialog';

interface Address {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postcode: string;
    country: string;
}

interface Contact {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    contactType: string;
    mailingAddress?: Address;
    previousAddress?: Address;
    forwardingAddress?: Address;
    notes?: string;
}

interface Property {
    id: string;
    addressLine1: string;
    city: string;
    postcode: string;
}

interface Tenancy {
    id: string;
    propertyId: string;
}

interface Document {
    id: string;
    fileName: string;
    filePath: string;
    uploadDate: any;
    description?: string;
    tags?: string[];
    propertyIds?: string[];
    tenancyIds?: string[];
    contactIds?: string[];
}

interface Communication {
    id: string;
    subject: string;
    direction: 'Inbound' | 'Outbound';
    timestamp: any;
}

interface Task {
    id: string;
    title: string;
    status: 'Open' | 'In Progress' | 'Completed';
    priority: 'High' | 'Medium' | 'Low';
    dueDate: any;
}


export default function ContactDetailPage() {
  const params = useParams();
  const contactId = params.contactId as string;
  const firestore = useFirestore();
  const router = useRouter();
  const [isAddTaskOpen, setAddTaskOpen] = useState(false);
  const [isAddDocOpen, setAddDocOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  
  const { userProfile: currentUserProfile, isLoading: isLoadingCurrentUser } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;
  const isAdmin = currentUserProfile?.role === 'Admin';

  const contactRef = useMemoFirebase(() => 
    (firestore && organizationId && contactId) ? doc(firestore, `organizations/${organizationId}/contacts`, contactId) : null,
    [firestore, organizationId, contactId]
  );
  const { data: contact, isLoading: isLoadingContact } = useDoc<Contact>(contactRef);

  // Query for properties where this contact is a landlord
  const landlordPropertiesQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !contactId || contact?.contactType !== 'Landlord') return null;
    return query(
      collection(firestore, `organizations/${organizationId}/properties`),
      where('landlordIds', 'array-contains', contactId)
    );
  }, [firestore, organizationId, contactId, contact?.contactType]);
  const { data: landlordProperties, isLoading: isLoadingProperties } = useCollection<Property>(landlordPropertiesQuery);

  // Query for tenancies where this contact is a tenant
  const tenanciesQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !contactId || contact?.contactType !== 'Tenant') return null;
    return query(
      collection(firestore, `organizations/${organizationId}/tenancies`),
      where('tenantIds', 'array-contains', contactId)
    );
  }, [firestore, organizationId, contactId, contact?.contactType]);
  const { data: tenancies, isLoading: isLoadingTenancies } = useCollection<Tenancy>(tenanciesQuery);

  // Based on the tenancy, find the property they live in. This simplifies by taking the first tenancy found.
  const tenancyPropertyRef = useMemoFirebase(() => {
    if (!firestore || !organizationId || !tenancies || tenancies.length === 0) return null;
    return doc(firestore, `organizations/${organizationId}/properties`, tenancies[0].propertyId);
  }, [firestore, organizationId, tenancies]);
  const { data: tenancyProperty, isLoading: isLoadingTenancyProperty } = useDoc<Property>(tenancyPropertyRef);

  // Query for documents where this contact is linked
  const documentsQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !contactId) return null;
    return query(
      collection(firestore, `organizations/${organizationId}/documents`),
      where('contactIds', 'array-contains', contactId),
      orderBy('uploadDate', 'desc')
    );
  }, [firestore, organizationId, contactId]);
  const { data: documents, isLoading: isLoadingDocuments } = useCollection<Document>(documentsQuery);

  // Query for communications where this contact is linked
  const communicationsQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !contactId) return null;
    return query(
        collection(firestore, `organizations/${organizationId}/communications`),
        where('relatedContactIds', 'array-contains', contactId),
        orderBy('timestamp', 'desc')
    );
  }, [firestore, organizationId, contactId]);
  const { data: communications, isLoading: isLoadingCommunications } = useCollection<Communication>(communicationsQuery);
  
  // Query for tasks related to this contact
  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !contactId) return null;
    return query(
        collection(firestore, `organizations/${organizationId}/tasks`),
        where('relatedContactId', '==', contactId),
        orderBy('dueDate', 'desc')
    );
  }, [firestore, organizationId, contactId]);
  const { data: tasks, isLoading: isLoadingTasks } = useCollection<Task>(tasksQuery);


  const getTimestampAsDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
    if (typeof timestamp === 'string') { return new Date(timestamp); }
    return new Date();
  };

  const getBadgeVariant = (type: string | undefined) => {
    switch (type) {
        case 'Tenant': return 'default';
        case 'Landlord': return 'secondary';
        case 'Lead': return 'outline';
        case 'Contractor': return 'destructive';
        default: return 'secondary';
    }
  }

  const getTaskStatusBadgeVariant = (status?: string) => {
    switch (status) {
        case 'Open': return 'secondary';
        case 'In Progress': return 'default';
        case 'Completed': return 'outline';
        default: return 'secondary';
    }
  }

  const getTaskPriorityBadgeVariant = (priority?: string) => {
    switch (priority) {
        case 'High': return 'destructive';
        case 'Medium': return 'default';
        case 'Low': return 'secondary';
        default: return 'outline';
    }
  }

  const isRelatedInfoLoading = isLoadingProperties || isLoadingTenancies || isLoadingTenancyProperty || isLoadingDocuments || isLoadingCommunications || isLoadingTasks;

  if (isLoadingContact || isLoadingCurrentUser) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-5 w-24" />
            </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card><CardHeader><Skeleton className="h-6 w-32 mb-2" /><Skeleton className="h-4 w-40" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-6 w-32 mb-2" /><Skeleton className="h-4 w-40" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-6 w-32 mb-2" /><Skeleton className="h-4 w-40" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>
        </div>
         <Card>
            <CardHeader><Skeleton className="h-6 w-24 mb-2" /></CardHeader>
            <CardContent><Skeleton className="h-20 w-full" /></CardContent>
        </Card>
        <Card>
            <CardHeader><Skeleton className="h-6 w-48 mb-2" /></CardHeader>
            <CardContent><Skeleton className="h-24 w-full" /></CardContent>
        </Card>
        <Card>
            <CardHeader><Skeleton className="h-6 w-48 mb-2" /></CardHeader>
            <CardContent><Skeleton className="h-24 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="text-center py-10">
        <p>Contact not found.</p>
        <Button asChild variant="link"><Link href="/contacts">Go back to contacts</Link></Button>
      </div>
    );
  }

  return (
    <>
    <AddDocumentDialog
        open={isAddDocOpen}
        onOpenChange={setAddDocOpen}
        defaultValues={{ contactIds: [contactId] }}
    />
    <EditDocumentDialog document={editingDocument} open={!!editingDocument} onOpenChange={(isOpen) => !isOpen && setEditingDocument(null)} />
    <AddTaskDialog 
        open={isAddTaskOpen} 
        onOpenChange={setAddTaskOpen} 
        defaultValues={{ 
            relatedContactId: contact.id, 
            title: `Follow up with ${contact.firstName} ${contact.lastName}` 
        }} 
    />
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
                <Avatar className="h-20 w-20 text-3xl">
                    <AvatarFallback>{contact.firstName?.substring(0,1)}{contact.lastName?.substring(0,1)}</AvatarFallback>
                </Avatar>
                <div>
                    <h1 className="text-3xl font-bold">{contact.firstName} {contact.lastName}</h1>
                    <Badge variant={getBadgeVariant(contact.contactType)} className="capitalize mt-1">{contact.contactType}</Badge>
                </div>
            </div>
            <div className="sm:ml-auto flex gap-2">
                <Button variant="outline" onClick={() => setAddTaskOpen(true)}>Create Task</Button>
                <EditContactDialog contact={contact} isAdmin={isAdmin} />
            </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5 text-muted-foreground" /> Contact Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{contact.phone}</span>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Home className="w-5 h-5 text-muted-foreground" /> Mailing Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                    {contact.mailingAddress && contact.mailingAddress.addressLine1 ? (
                        <>
                            <p>{contact.mailingAddress.addressLine1}</p>
                            {contact.mailingAddress.addressLine2 && <p>{contact.mailingAddress.addressLine2}</p>}
                            <p>{contact.mailingAddress.city}, {contact.mailingAddress.postcode}</p>
                            <p>{contact.mailingAddress.country}</p>
                        </>
                    ) : (
                        <p className="text-muted-foreground">No mailing address on file.</p>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Building className="w-5 h-5 text-muted-foreground" /> Address History</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-4">
                    {contact.previousAddress && contact.previousAddress.addressLine1 ? (
                        <div>
                            <h4 className="font-medium text-muted-foreground">Previous Address</h4>
                            <p>{contact.previousAddress.addressLine1}</p>
                            {contact.previousAddress.addressLine2 && <p>{contact.previousAddress.addressLine2}</p>}
                            <p>{contact.previousAddress.city}, {contact.previousAddress.postcode}</p>
                        </div>
                    ) : null}
                     {contact.forwardingAddress && contact.forwardingAddress.addressLine1 ? (
                        <div>
                            <h4 className="font-medium text-muted-foreground">Forwarding Address</h4>
                            <p>{contact.forwardingAddress.addressLine1}</p>
                            {contact.forwardingAddress.addressLine2 && <p>{contact.forwardingAddress.addressLine2}</p>}
                            <p>{contact.forwardingAddress.city}, {contact.forwardingAddress.postcode}</p>
                        </div>
                    ) : null}
                    {!contact.previousAddress?.addressLine1 && !contact.forwardingAddress?.addressLine1 && (
                        <p className="text-muted-foreground">No previous or forwarding address on file.</p>
                    )}
                </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="related" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="related">Related Info</TabsTrigger>
            <TabsTrigger value="communications">Communications</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="related" className="mt-4">
             <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Building className="w-5 h-5 text-muted-foreground" /> Related Info</CardTitle></CardHeader>
                <CardContent className="text-sm">
                    {isRelatedInfoLoading ? (
                        <Skeleton className="h-8 w-full" />
                    ) : (
                        <>
                            {contact.contactType === 'Landlord' && (
                                landlordProperties && landlordProperties.length > 0 ? (
                                    <ul className="space-y-2">
                                        {landlordProperties.map(prop => (
                                            <li key={prop.id}>
                                                <Link href={`/properties/${prop.id}`} className="font-medium hover:underline text-primary flex items-center gap-2">
                                                    <Home className="w-4 h-4" /> {prop.addressLine1}, {prop.city}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <p className="text-muted-foreground">Not linked to any properties.</p>
                            )}

                            {contact.contactType === 'Tenant' && (
                                tenancyProperty ? (
                                     <ul className="space-y-2">
                                        <li>
                                            <div className="font-medium flex items-center gap-2">
                                                <FileText className="w-4 h-4" /> Current Tenancy:
                                            </div>
                                            <Link href={`/properties/${tenancyProperty.id}`} className="hover:underline text-primary pl-6 block">
                                                {tenancyProperty.addressLine1}, {tenancyProperty.city}
                                            </Link>
                                        </li>
                                    </ul>
                                ) : <p className="text-muted-foreground">Not linked to any tenancies.</p>
                            )}
                            
                            {(contact.contactType !== 'Landlord' && contact.contactType !== 'Tenant') && (
                                <p className="text-muted-foreground">No related items for this contact type.</p>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="communications" className="mt-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Mail className="w-5 h-5 text-muted-foreground" /> Communication History</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingCommunications ? <Skeleton className="h-24 w-full" /> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Direction</TableHead>
                                    <TableHead className="text-right">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {communications && communications.length > 0 ? communications.map(comm => (
                                    <TableRow key={comm.id} className="cursor-pointer" onClick={() => router.push(`/communications?emailId=${comm.id}`)}>
                                        <TableCell className="font-medium">{comm.subject}</TableCell>
                                        <TableCell><Badge variant={comm.direction === 'Inbound' ? 'secondary' : 'default'}>{comm.direction}</Badge></TableCell>
                                        <TableCell className="text-right text-sm text-muted-foreground">
                                            {format(getTimestampAsDate(comm.timestamp), 'PP')}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={3} className="text-center h-24">No communications for this contact.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="documents" className="mt-4">
            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2"><File className="w-5 h-5 text-muted-foreground" /> Documents</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setAddDocOpen(true)}>Add Document</Button>
                </CardHeader>
                <CardContent>
                    {isLoadingDocuments ? <Skeleton className="h-24 w-full" /> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>File</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {documents && documents.length > 0 ? documents.map(doc => (
                                    <TableRow key={doc.id} className="cursor-pointer" onClick={() => setEditingDocument(doc)}>
                                        <TableCell className="font-medium">{doc.fileName}</TableCell>
                                        <TableCell className="text-right">
                                             <Button asChild variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                                <Link href={doc.filePath} target="_blank" download={doc.fileName}>
                                                    <Download className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={2} className="text-center h-24">No documents for this contact.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="tasks" className="mt-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><CheckSquare className="w-5 h-5 text-muted-foreground" /> Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingTasks ? <Skeleton className="h-24 w-full" /> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Task</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead className="text-right">Due Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tasks && tasks.length > 0 ? tasks.map(task => (
                                    <TableRow key={task.id}>
                                        <TableCell className="font-medium">{task.title}</TableCell>
                                        <TableCell><Badge variant={getTaskStatusBadgeVariant(task.status)}>{task.status}</Badge></TableCell>
                                        <TableCell><Badge variant={getTaskPriorityBadgeVariant(task.priority)}>{task.priority}</Badge></TableCell>
                                        <TableCell className="text-right text-sm text-muted-foreground">
                                            {format(getTimestampAsDate(task.dueDate), 'PP')}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={4} className="text-center h-24">No tasks for this contact.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="notes" className="mt-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><StickyNote className="w-5 h-5 text-muted-foreground" /> Notes</CardTitle>
                </CardHeader>
                <CardContent>
                    {contact.notes ? (
                        <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                    ) : (
                        <p className="text-sm text-muted-foreground">No notes for this contact.</p>
                    )}
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
    </>
  );
}
