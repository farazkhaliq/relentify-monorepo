'use client';

import { useParams, useRouter } from 'next/navigation';
import { useApiDoc } from '@/hooks/use-api';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@relentify/ui';
import { Avatar, AvatarFallback } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import { Mail, Phone, Home, User, Building, StickyNote, FileText, File, Download, CheckSquare } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@relentify/ui';
import { EditContactDialog } from '@/components/crm/edit-contact-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { format } from 'date-fns';
import { useState } from 'react';
import { AddTaskDialog } from '@/components/crm/add-task-dialog';
import { AddDocumentDialog } from '@/components/crm/add-document-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@relentify/ui';
import { EditDocumentDialog } from '@/components/crm/edit-document-dialog';

interface Contact {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    contact_type: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    postcode?: string;
    country?: string;
    notes?: string;
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

export default function ContactDetailPage() {
  const params = useParams();
  const contactId = params.contactId as string;
  const router = useRouter();
  const [isAddTaskOpen, setAddTaskOpen] = useState(false);
  const [isAddDocOpen, setAddDocOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);

  const { userProfile: currentUserProfile, isLoading: isLoadingCurrentUser } = useUserProfile();
  const isAdmin = currentUserProfile?.role === 'Admin';

  const { data: contact, isLoading: isLoadingContact } = useApiDoc<Contact>(
    contactId ? `/api/contacts/${contactId}` : null
  );

  // Related data: these will be populated when their respective APIs support query params
  // For now, show empty states for related info tabs
  const landlordProperties: any[] = [];
  const tenancies: any[] = [];
  const communications: any[] = [];
  const tasks: any[] = [];
  const documents: any[] = [];

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

  // Map DB fields to the shape the EditContactDialog expects (camelCase form fields)
  const contactForEdit = {
    id: contact.id,
    firstName: contact.first_name,
    lastName: contact.last_name,
    email: contact.email,
    phone: contact.phone,
    contactType: contact.contact_type as any,
    notes: contact.notes,
    mailingAddress: contact.address_line1 ? {
      addressLine1: contact.address_line1,
      addressLine2: contact.address_line2 || '',
      city: contact.city || '',
      postcode: contact.postcode || '',
      country: contact.country || 'United Kingdom',
    } : undefined,
  };

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
            title: `Follow up with ${contact.first_name} ${contact.last_name}`
        }}
    />
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
                <Avatar className="h-20 w-20 text-3xl">
                    <AvatarFallback>{contact.first_name?.substring(0,1)}{contact.last_name?.substring(0,1)}</AvatarFallback>
                </Avatar>
                <div>
                    <h1 className="text-3xl font-bold">{contact.first_name} {contact.last_name}</h1>
                    <Badge variant={getBadgeVariant(contact.contact_type)} className="capitalize mt-1">{contact.contact_type}</Badge>
                </div>
            </div>
            <div className="sm:ml-auto flex gap-2">
                <Button variant="outline" onClick={() => setAddTaskOpen(true)}>Create Task</Button>
                <EditContactDialog contact={contactForEdit} isAdmin={isAdmin} />
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
                    {contact.address_line1 ? (
                        <>
                            <p>{contact.address_line1}</p>
                            {contact.address_line2 && <p>{contact.address_line2}</p>}
                            <p>{contact.city}, {contact.postcode}</p>
                            <p>{contact.country}</p>
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
                    {/* Previous/forwarding addresses not yet in DB schema -- will be added in a future migration */}
                    <p className="text-muted-foreground">No previous or forwarding address on file.</p>
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
                    {/* TODO: Wire up when properties/tenancies APIs support query param filtering by contact */}
                    {contact.contact_type === 'Landlord' && (
                        landlordProperties.length > 0 ? (
                            <ul className="space-y-2">
                                {landlordProperties.map((prop: any) => (
                                    <li key={prop.id}>
                                        <Link href={`/properties/${prop.id}`} className="font-medium hover:underline text-primary flex items-center gap-2">
                                            <Home className="w-4 h-4" /> {prop.address_line1}, {prop.city}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-muted-foreground">Not linked to any properties.</p>
                    )}

                    {contact.contact_type === 'Tenant' && (
                        tenancies.length > 0 ? (
                             <ul className="space-y-2">
                                <li>
                                    <div className="font-medium flex items-center gap-2">
                                        <FileText className="w-4 h-4" /> Current Tenancy
                                    </div>
                                </li>
                            </ul>
                        ) : <p className="text-muted-foreground">Not linked to any tenancies.</p>
                    )}

                    {(contact.contact_type !== 'Landlord' && contact.contact_type !== 'Tenant') && (
                        <p className="text-muted-foreground">No related items for this contact type.</p>
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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Subject</TableHead>
                                <TableHead>Direction</TableHead>
                                <TableHead className="text-right">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {communications.length > 0 ? communications.map((comm: any) => (
                                <TableRow key={comm.id} className="cursor-pointer" onClick={() => router.push(`/communications?emailId=${comm.id}`)}>
                                    <TableCell className="font-medium">{comm.subject}</TableCell>
                                    <TableCell><Badge variant={comm.direction === 'Inbound' ? 'secondary' : 'default'}>{comm.direction}</Badge></TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground">
                                        {comm.timestamp ? format(new Date(comm.timestamp), 'PP') : '-'}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={3} className="text-center h-24">No communications for this contact.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>File</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {documents.length > 0 ? documents.map((doc: any) => (
                                <TableRow key={doc.id} className="cursor-pointer" onClick={() => setEditingDocument(doc)}>
                                    <TableCell className="font-medium">{doc.fileName}</TableCell>
                                    <TableCell className="text-right">
                                         <Button asChild variant="ghost" size="icon" onClick={(e: any) => e.stopPropagation()}>
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
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="tasks" className="mt-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><CheckSquare className="w-5 h-5 text-muted-foreground" /> Tasks</CardTitle>
                </CardHeader>
                <CardContent>
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
                            {tasks.length > 0 ? tasks.map((task: any) => (
                                <TableRow key={task.id}>
                                    <TableCell className="font-medium">{task.title}</TableCell>
                                    <TableCell><Badge variant={getTaskStatusBadgeVariant(task.status)}>{task.status}</Badge></TableCell>
                                    <TableCell><Badge variant={getTaskPriorityBadgeVariant(task.priority)}>{task.priority}</Badge></TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground">
                                        {task.due_date ? format(new Date(task.due_date), 'PP') : '-'}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={4} className="text-center h-24">No tasks for this contact.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
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
