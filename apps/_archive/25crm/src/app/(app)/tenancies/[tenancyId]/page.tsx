'use client';

import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from '@relentify/ui';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import { Home, User, Calendar, PoundSterling, FileText, Users, ShieldCheck, Wrench, Download, Landmark, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@relentify/ui';
import { format } from 'date-fns';
import { EditTenancyDialog } from '@/components/edit-tenancy-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { useState, useMemo } from 'react';
import { AddDocumentDialog } from '@/components/add-document-dialog';
import { AddTaskDialog } from '@/components/add-task-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@relentify/ui';
import { EditDocumentDialog } from '@/components/edit-document-dialog';
import { useToast } from '@/hooks/use-toast';
import { useApiDoc, useApiCollection } from '@/hooks/use-api';

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

export default function TenancyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const tenancyId = params.tenancyId as string;
  const [isAddDocOpen, setAddDocOpen] = useState(false);
  const [isAddTaskOpen, setAddTaskOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);

  // Fetch tenancy via API
  const { data: tenancy, isLoading: isLoadingTenancy } = useApiDoc<any>(`/api/tenancies/${tenancyId}`);

  // Fetch related data via API
  const { data: allContacts, isLoading: isLoadingContacts } = useApiCollection<any>('/api/contacts');
  const { data: allMaintenance, isLoading: isLoadingMaintenance } = useApiCollection<any>('/api/maintenance');

  // Build lookup maps
  const contactMap = useMemo(() => new Map(allContacts.map(c => [c.id, c])), [allContacts]);

  // Derive tenants and landlords from the tenancy's tenant_ids
  const tenants = useMemo(() => {
    if (!tenancy?.tenant_ids) return [];
    return tenancy.tenant_ids.map((id: string) => contactMap.get(id)).filter(Boolean);
  }, [tenancy?.tenant_ids, contactMap]);

  const landlords = useMemo(() => {
    // Landlords linked to the property - for now show from contacts with type Landlord
    return allContacts.filter(c => c.contact_type === 'Landlord');
  }, [allContacts]);

  // Maintenance requests for the tenancy's property
  const maintenanceRequests = useMemo(() => {
    if (!tenancy?.property_id) return [];
    return allMaintenance.filter((m: any) => m.property_id === tenancy.property_id);
  }, [allMaintenance, tenancy?.property_id]);

  // Determine admin (simple check - could be improved)
  const isAdmin = true; // The edit dialog handles this via prop

  const handleCreateInventory = () => {
    if (!tenancy) {
        toast({ variant: 'destructive', title: 'Missing Information', description: 'Tenancy details are required.' });
        return;
    }
    const propertyAddress = encodeURIComponent(tenancy.property_address || '');
    const tenantNames = encodeURIComponent((tenancy.tenant_names || []).join(', '));
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

  const formatCurrency = (amount: number, currency: string = 'GBP') => {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  };

  const getTimestampAsDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (typeof timestamp === 'string' || timestamp instanceof Date) { return new Date(timestamp); }
    return new Date();
  };

  const isLoading = isLoadingTenancy || isLoadingContacts;

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
            relatedPropertyId: tenancy.property_id,
            title: `Task for tenancy at ${tenancy.property_address}`
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
                    {tenancy.property_address ? (
                        <Link href={`/properties/${tenancy.property_id}`} className="text-muted-foreground hover:underline">
                            {tenancy.property_address}
                        </Link>
                    ) : <Skeleton className="h-5 w-48" />}
                </div>
            </div>
            <div className="sm:ml-auto flex items-center gap-2">
                <Button variant="outline" onClick={() => setAddTaskOpen(true)}>Create Task</Button>
                <Badge variant={getPipelineStatusBadgeVariant(tenancy.pipeline_status)} className="capitalize h-7 text-sm">{tenancy.pipeline_status}</Badge>
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
                                    <p className="font-medium">{format(getTimestampAsDate(tenancy.start_date), 'PPP')}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">End Date</p>
                                    <p className="font-medium">{tenancy.end_date ? format(getTimestampAsDate(tenancy.end_date), 'PPP') : 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Monthly Rent</p>
                                    <p className="font-medium">{new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(tenancy.rent_amount))}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5 text-muted-foreground" /> Tenants</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {tenants.length > 0 ? tenants.map((t: any) => (
                                    <Link key={t.id} href={`/contacts/${t.id}`} className="flex items-center gap-2 font-medium text-primary hover:underline">
                                        <User className="w-4 h-4" />
                                        {t.first_name} {t.last_name}
                                    </Link>
                                )) : (
                                    <p className="text-muted-foreground">No tenants linked.</p>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5 text-muted-foreground" /> Landlords</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {landlords.length > 0 ? landlords.map((l: any) => (
                                    <Link key={l.id} href={`/contacts/${l.id}`} className="flex items-center gap-2 font-medium text-primary hover:underline">
                                        <User className="w-4 h-4" />
                                        {l.first_name} {l.last_name}
                                    </Link>
                                )) : (
                                    <p className="text-muted-foreground">No landlords linked.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-muted-foreground" /> Deposit</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(tenancy.deposit_amount || 0))}</p>
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
                        <Button onClick={handleCreateInventory} disabled={!tenancy.property_address}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Create Inventory
                        </Button>
                        {tenancy.inventory_url ? (
                            <Button asChild variant="outline">
                                <Link href={tenancy.inventory_url} target="_blank">View Inventory Report</Link>
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
                                    {maintenanceRequests && maintenanceRequests.length > 0 ? maintenanceRequests.map((request: any) => (
                                        <TableRow key={request.id} className="cursor-pointer" onClick={() => router.push(`/maintenance/${request.id}`)}>
                                            <TableCell>{format(getTimestampAsDate(request.reported_date), 'PP')}</TableCell>
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
                        <p className="text-sm text-muted-foreground text-center py-8">Document storage will be available once file upload is migrated.</p>
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
                        <p className="text-sm text-muted-foreground text-center py-8">Transaction history will be available once the transactions module is migrated.</p>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
    </>
  );
}
