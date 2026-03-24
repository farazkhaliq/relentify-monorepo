'use client';

import { useParams, useRouter } from 'next/navigation';
import { doc, collection, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import { Home, User, Calendar, PoundSterling, FileText, Users, ShieldCheck, Wrench, Download, Landmark, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@relentify/ui';
import { format } from 'date-fns';
import { EditTenancyDialog } from '@/components/edit-tenancy-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { useState } from 'react';
import { AddDocumentDialog } from '@/components/add-document-dialog';
import { AddTaskDialog } from '@/components/add-task-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@relentify/ui';
import { EditDocumentDialog } from '@/components/edit-document-dialog';
import { useToast } from '@/hooks/use-toast';

interface Tenancy {
    id: string;
    propertyId: string;
    tenantIds: string[];
    landlordIds: string[];
    startDate: any;
    endDate: any;
    rentAmount: number;
    depositAmount: number;
    status: 'Active' | 'Ended' | 'Arrears' | 'Pending';
    pipelineStatus: 'Application Received' | 'Referencing' | 'Awaiting Guarantor' | 'Contract Signed' | 'Awaiting Payment' | 'Complete';
    inventoryUrl?: string;
}

interface MaintenanceRequest {
    id: string;
    description: string;
    reportedDate: any;
    priority: 'Urgent' | 'High' | 'Medium' | 'Low';
    status: 'New' | 'In Progress' | 'Awaiting Parts' | 'On Hold' | 'Completed' | 'Cancelled';
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

interface Property {
    addressLine1: string;
    city: string;
    postcode: string;
}

interface Contact {
    id: string;
    firstName: string;
    lastName: string;
}

interface Transaction {
    id: string;
    transactionType: 'Rent Payment' | 'Management Fee' | 'Commission' | 'Landlord Payout' | 'Contractor Payment' | 'Agency Expense' | 'Deposit';
    amount: number;
    currency: string;
    transactionDate: any;
    description: string;
}

export default function TenancyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const tenancyId = params.tenancyId as string;
  const firestore = useFirestore();
  const [isAddDocOpen, setAddDocOpen] = useState(false);
  const [isAddTaskOpen, setAddTaskOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const { userProfile: currentUserProfile, isLoading: isLoadingCurrentUser } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;
  const isAdmin = currentUserProfile?.role === 'Admin';

  const tenancyRef = useMemoFirebase(() => 
    (firestore && organizationId && tenancyId) ? doc(firestore, `organizations/${organizationId}/tenancies`, tenancyId) : null,
    [firestore, organizationId, tenancyId]
  );
  const { data: tenancy, isLoading: isLoadingTenancy } = useDoc<Tenancy>(tenancyRef);

  // Fetch linked property
  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !organizationId || !tenancy?.propertyId) return null;
    return doc(firestore, `organizations/${organizationId}/properties`, tenancy.propertyId);
  }, [firestore, organizationId, tenancy?.propertyId]);
  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyRef);

  // Fetch linked tenants
  const tenantsQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !tenancy?.tenantIds || tenancy.tenantIds.length === 0) return null;
    return query(collection(firestore, `organizations/${organizationId}/contacts`), where('__name__', 'in', tenancy.tenantIds));
  }, [firestore, organizationId, tenancy?.tenantIds]);
  const { data: tenants, isLoading: isLoadingTenants } = useCollection<Contact>(tenantsQuery);
  
  // Fetch linked landlords
  const landlordsQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !tenancy?.landlordIds || tenancy.landlordIds.length === 0) return null;
    return query(collection(firestore, `organizations/${organizationId}/contacts`), where('__name__', 'in', tenancy.landlordIds));
  }, [firestore, organizationId, tenancy?.landlordIds]);
  const { data: landlords, isLoading: isLoadingLandlords } = useCollection<Contact>(landlordsQuery);
  
  // Query for maintenance requests for this tenancy
  const maintenanceQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !tenancyId) return null;
    return query(
      collection(firestore, `organizations/${organizationId}/maintenanceRequests`),
      where('tenancyId', '==', tenancyId),
      orderBy('reportedDate', 'desc')
    );
  }, [firestore, organizationId, tenancyId]);
  const { data: maintenanceRequests, isLoading: isLoadingMaintenance } = useCollection<MaintenanceRequest>(maintenanceQuery);
  
  // Query for documents linked to this tenancy
  const documentsQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !tenancyId) return null;
    return query(
      collection(firestore, `organizations/${organizationId}/documents`),
      where('tenancyIds', 'array-contains', tenancyId),
      orderBy('uploadDate', 'desc')
    );
  }, [firestore, organizationId, tenancyId]);
  const { data: documents, isLoading: isLoadingDocuments } = useCollection<Document>(documentsQuery);

  // Query for transactions related to this tenancy
  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !tenancyId) return null;
    return query(
      collection(firestore, `organizations/${organizationId}/transactions`),
      where('relatedTenancyId', '==', tenancyId),
      orderBy('transactionDate', 'desc')
    );
  }, [firestore, organizationId, tenancyId]);
  const { data: transactions, isLoading: isLoadingTransactions } = useCollection<Transaction>(transactionsQuery);

  const handleCreateInventory = () => {
    if (!property || !tenants) {
        toast({ variant: 'destructive', title: 'Missing Information', description: 'Property and tenant details are required.' });
        return;
    }
    const propertyAddress = encodeURIComponent(`${property.addressLine1}, ${property.city}, ${property.postcode}`);
    const tenantNames = encodeURIComponent(tenants.map(t => `${t.firstName} ${t.lastName}`).join(', '));
    const url = `https://your-inventory-app.com/create?property=${propertyAddress}&tenants=${tenantNames}`;
    window.open(url, '_blank');
    toast({
        title: 'Redirecting to Inventory App',
        description: 'Once the inventory is complete, paste the final URL back into the tenancy details.',
    });
  };

  const getStatusBadgeVariant = (status: string | undefined) => {
    switch (status) {
      case 'Active': return 'default';
      case 'Ended': return 'secondary';
      case 'Pending': return 'outline';
      case 'Arrears': return 'destructive';
      default: return 'secondary';
    }
  }

  const getPipelineStatusBadgeVariant = (status: string | undefined) => {
    switch (status) {
      case 'Complete': return 'default';
      case 'Referencing': case 'Awaiting Payment': return 'secondary';
      default: return 'outline';
    }
  }
  
  const getMaintStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'New': return 'default';
        case 'In Progress': return 'secondary';
        case 'Completed': return 'outline';
        case 'Cancelled': return 'destructive';
        default: return 'secondary';
    }
  }

  const getMaintPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
        case 'Urgent': return 'destructive';
        case 'High': return 'default';
        case 'Medium': return 'secondary';
        case 'Low': return 'outline';
        default: return 'outline';
    }
  }
  
  const getTransactionBadgeVariant = (type: string) => {
    switch (type) {
      case 'Rent Payment': return 'default';
      case 'Management Fee':
      case 'Commission':
        return 'secondary';
      case 'Landlord Payout': return 'outline';
      case 'Contractor Payment':
      case 'Agency Expense':
        return 'destructive';
      case 'Deposit': return 'secondary';
      default: return 'secondary';
    }
  }

  const formatCurrency = (amount: number, currency: string = 'GBP') => {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  };

  const getTimestampAsDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
    if (typeof timestamp === 'string' || timestamp instanceof Date) { return new Date(timestamp); }
    return new Date();
  };

  const isLoading = isLoadingTenancy || isLoadingProperty || isLoadingTenants || isLoadingLandlords || isLoadingMaintenance || isLoadingDocuments || isLoadingCurrentUser || isLoadingTransactions;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-5 w-48" />
            </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card><CardHeader><Skeleton className="h-6 w-32 mb-2" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-6 w-32 mb-2" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-6 w-32 mb-2" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
             <Card><CardHeader><Skeleton className="h-6 w-32 mb-2" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
             <Card><CardHeader><Skeleton className="h-6 w-32 mb-2" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  if (!tenancy) {
    return (
      <div className="text-center py-10">
        <p>Tenancy not found.</p>
        <Button asChild variant="link"><Link href="/tenancies">Go back to tenancies</Link></Button>
      </div>
    );
  }

  return (
    <>
    <AddTaskDialog 
        open={isAddTaskOpen} 
        onOpenChange={setAddTaskOpen} 
        defaultValues={{ 
            relatedTenancyId: tenancy.id, 
            relatedPropertyId: tenancy.propertyId,
            title: `Task for tenancy at ${property?.addressLine1}`
        }} 
    />
    <AddDocumentDialog
      open={isAddDocOpen}
      onOpenChange={setAddDocOpen}
      defaultValues={{ tenancyIds: [tenancyId] }}
    />
    <EditDocumentDialog document={editingDocument} open={!!editingDocument} onOpenChange={(isOpen) => !isOpen && setEditingDocument(null)} />
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
                 <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Tenancy Agreement</h1>
                    {property ? (
                        <Link href={`/properties/${tenancy.propertyId}`} className="text-muted-foreground hover:underline">
                            {property.addressLine1}, {property.city}
                        </Link>
                    ) : <Skeleton className="h-5 w-48" />}
                </div>
            </div>
            <div className="sm:ml-auto flex items-center gap-2">
                <Button variant="outline" onClick={() => setAddTaskOpen(true)}>Create Task</Button>
                <Badge variant={getPipelineStatusBadgeVariant(tenancy.pipelineStatus)} className="capitalize h-7 text-sm">{tenancy.pipelineStatus}</Badge>
                <Badge variant={getStatusBadgeVariant(tenancy.status)} className="capitalize h-7 text-sm">{tenancy.status}</Badge>
                <EditTenancyDialog tenancy={tenancy} isAdmin={isAdmin} />
            </div>
        </div>

        <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="financials">Financials</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4">
                <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-muted-foreground" /> Term & Rent</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Start Date</p>
                                    <p className="font-medium">{format(getTimestampAsDate(tenancy.startDate), 'PPP')}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">End Date</p>
                                    <p className="font-medium">{format(getTimestampAsDate(tenancy.endDate), 'PPP')}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Monthly Rent</p>
                                    <p className="font-medium">{new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(tenancy.rentAmount)}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5 text-muted-foreground" /> Tenants</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {isLoadingTenants ? <Skeleton className="h-5 w-3/4" /> : (
                                    tenants?.map(t => (
                                        <Link key={t.id} href={`/contacts/${t.id}`} className="flex items-center gap-2 font-medium text-primary hover:underline">
                                            <User className="w-4 h-4" />
                                            {t.firstName} {t.lastName}
                                        </Link>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5 text-muted-foreground" /> Landlords</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {isLoadingLandlords ? <Skeleton className="h-5 w-3/4" /> : (
                                    landlords?.map(l => (
                                        <Link key={l.id} href={`/contacts/${l.id}`} className="flex items-center gap-2 font-medium text-primary hover:underline">
                                            <User className="w-4 h-4" />
                                            {l.firstName} {l.lastName}
                                        </Link>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-muted-foreground" /> Deposit</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(tenancy.depositAmount)}</p>
                            <p className="text-sm text-muted-foreground mt-1">Deposit scheme details will appear here.</p>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
            <TabsContent value="inventory" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>External Inventory</CardTitle>
                        <CardDescription>Create new inventories or view existing ones from your integrated inventory app.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={handleCreateInventory} disabled={!property || !tenants}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Create Inventory
                        </Button>
                        {tenancy.inventoryUrl ? (
                            <Button asChild variant="outline">
                                <Link href={tenancy.inventoryUrl} target="_blank">View Inventory Report</Link>
                            </Button>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No inventory report has been linked. Add the URL by editing the tenancy.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="maintenance" className="mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><Wrench className="w-5 h-5 text-muted-foreground" /> Maintenance History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoadingMaintenance ? <Skeleton className="h-24 w-full" /> : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Reported</TableHead>
                                        <TableHead>Issue</TableHead>
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {maintenanceRequests && maintenanceRequests.length > 0 ? maintenanceRequests.map(request => (
                                        <TableRow key={request.id} className="cursor-pointer" onClick={() => router.push(`/maintenance/${request.id}`)}>
                                            <TableCell>{format(getTimestampAsDate(request.reportedDate), 'PP')}</TableCell>
                                            <TableCell className="truncate max-w-[150px]">{request.description}</TableCell>
                                            <TableCell><Badge variant={getMaintPriorityBadgeVariant(request.priority)}>{request.priority}</Badge></TableCell>
                                            <TableCell><Badge variant={getMaintStatusBadgeVariant(request.status)}>{request.status}</Badge></TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow><TableCell colSpan={4} className="text-center h-24">No maintenance history for this tenancy.</TableCell></TableRow>
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
                        <CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-muted-foreground" /> Documents</CardTitle>
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
                                        <TableRow><TableCell colSpan={2} className="text-center h-24">No documents for this tenancy.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="financials" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><Landmark className="w-5 h-5 text-muted-foreground" /> Financials</CardTitle>
                        <CardDescription>Financial history related to this tenancy agreement.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingTransactions ? <Skeleton className="h-24 w-full" /> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions && transactions.length > 0 ? transactions.map(t => (
                                    <TableRow key={t.id} className="cursor-pointer" onClick={() => router.push('/transactions')}>
                                        <TableCell>{format(getTimestampAsDate(t.transactionDate), 'PP')}</TableCell>
                                        <TableCell><Badge variant={getTransactionBadgeVariant(t.transactionType)}>{t.transactionType}</Badge></TableCell>
                                        <TableCell className="font-medium">{t.description}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(t.amount, t.currency)}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={4} className="text-center h-24">No transactions for this tenancy.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
    </>
  );
}
