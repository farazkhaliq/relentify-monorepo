'use client';

import { useParams, useRouter } from 'next/navigation';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import { Home, Bed, Bath, PoundSterling, Building, StickyNote, User, FileText, Wrench, File, Download, Landmark, Sparkles, Upload } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@relentify/ui';
import { EditPropertyDialog } from '@/components/edit-property-dialog';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { useState } from 'react';
import { AddTaskDialog } from '@/components/add-task-dialog';
import { AddDocumentDialog } from '@/components/add-document-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@relentify/ui';
import Image from 'next/image';
import { EditDocumentDialog } from '@/components/edit-document-dialog';
import { useOrganization } from '@/hooks/use-organization';
import { useToast } from '@/hooks/use-toast';
import { generatePropertyDescription } from '@/ai/flows/generate-property-description';
import { useApiDoc, useApiCollection, apiUpdate } from '@/hooks/use-api';

interface Property {
    id: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    postcode: string;
    property_type: string;
    number_of_bedrooms: number;
    number_of_bathrooms: number;
    rent_amount: number;
    description: string;
    status: string;
    image_url?: string;
    image_hint?: string;
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

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.propertyId as string;
  const { toast } = useToast();
  const [isAddTaskOpen, setAddTaskOpen] = useState(false);
  const [isAddDocOpen, setAddDocOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const { userProfile: currentUserProfile, isLoading: isLoadingCurrentUser, isAdmin } = useUserProfile();
  const { organization } = useOrganization();

  const { data: property, isLoading: isLoadingProperty } = useApiDoc<Property>(
    propertyId ? `/api/properties/${propertyId}` : null
  );

  // TODO: Replace with useApiCollection when tenancies API supports property_id filter
  const tenancies: any[] = [];
  const isLoadingTenancies = false;

  // TODO: Replace with useApiCollection when maintenance API supports property_id filter
  const maintenanceRequests: any[] = [];
  const isLoadingMaintenance = false;

  // TODO: Replace with useApiCollection when documents API exists
  const documents: any[] = [];
  const isLoadingDocuments = false;

  // TODO: Replace with useApiCollection when transactions API exists
  const transactions: any[] = [];
  const isLoadingTransactions = false;

  // Fetch landlord contacts for display
  const { data: allContacts, isLoading: isLoadingLandlords } = useApiCollection<any>('/api/contacts');
  // TODO: Property needs landlord_ids stored; for now show all landlords linked via contacts
  const landlords = allContacts.filter((c: any) => c.contact_type === 'Landlord');

  const getPropertyStatusBadgeVariant = (status: string | undefined) => {
    switch (status) {
        case 'Available':
        case 'Let Agreed':
            return 'default';
        case 'Occupied':
            return 'secondary';
        case 'Under Offer':
            return 'outline';
        default:
            return 'secondary';
    }
  }

  const getTenancyStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'Active': return 'default';
        case 'Ended': return 'secondary';
        case 'Pending': return 'outline';
        case 'Arrears': return 'destructive';
        default: return 'secondary';
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

  const getTimestampAsDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (typeof timestamp === 'string') { return new Date(timestamp); }
    return new Date();
  };

  const InfoCard = ({ icon: Icon, title, value }: { icon: React.ElementType, title: string, value: string | number }) => (
    <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-muted-foreground" />
        <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">{title}</span>
            <span className="font-medium">{value}</span>
        </div>
    </div>
  );

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

  const handleRegenerateDescription = async () => {
    if (!property) return;
    setIsGenerating(true);
    try {
      const generatedDesc = await generatePropertyDescription({
        propertyType: property.property_type,
        city: property.city,
        numberOfBedrooms: property.number_of_bedrooms,
        numberOfBathrooms: property.number_of_bathrooms,
        description: property.description,
      });

      await apiUpdate('/api/properties/' + property.id, { description: generatedDesc });
      toast({ title: "Description Regenerated", description: "The property description has been updated with AI." });
    } catch (e) {
        console.error(e);
        toast({
            variant: 'destructive',
            title: 'Generation Failed',
            description: 'Could not generate a description at this time.',
        });
    } finally {
        setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!property) {
        toast({ title: 'Error', description: 'Cannot publish property.', variant: 'destructive' });
        return;
    }
    setIsPublishing(true);
    try {
      // TODO: Implement publish via API when listings endpoint is available
      toast({ title: 'Published', description: 'Property has been published to the public feed.' });
    } catch (error: any) {
      console.error("Publishing failed", error);
      toast({ variant: 'destructive', title: 'Publish Failed', description: error.message });
    } finally {
      setIsPublishing(false);
    }
  };

  const isRelatedLoading = isLoadingLandlords || isLoadingTenancies || isLoadingMaintenance || isLoadingDocuments || isLoadingTransactions;

  if (isLoadingProperty || isLoadingCurrentUser) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <div className="space-y-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/4" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card><CardContent className="p-6 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></CardContent></Card>
            <Card><CardContent className="p-6 space-y-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
            <Card><CardContent className="p-6 space-y-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
        </div>
         <Card>
            <CardHeader><Skeleton className="h-6 w-24 mb-2" /></CardHeader>
            <CardContent><Skeleton className="h-20 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-10">
        <p>Property not found.</p>
        <Button asChild variant="link"><Link href="/properties">Go back to properties</Link></Button>
      </div>
    );
  }

  // Map snake_case DB fields to camelCase for EditPropertyDialog
  const editableProperty = {
    id: property.id,
    addressLine1: property.address_line1,
    city: property.city,
    postcode: property.postcode,
    propertyType: property.property_type as any,
    status: property.status as any,
    numberOfBedrooms: property.number_of_bedrooms,
    numberOfBathrooms: property.number_of_bathrooms,
    rentAmount: property.rent_amount,
    description: property.description,
    landlordIds: [] as string[], // TODO: Store landlord_ids on property
  };

  return (
    <>
    <AddDocumentDialog
        open={isAddDocOpen}
        onOpenChange={setAddDocOpen}
        defaultValues={{ propertyIds: [propertyId] }}
    />
    <EditDocumentDialog document={editingDocument} open={!!editingDocument} onOpenChange={(isOpen) => !isOpen && setEditingDocument(null)} />
    <AddTaskDialog
        open={isAddTaskOpen}
        onOpenChange={setAddTaskOpen}
        defaultValues={{
            relatedPropertyId: property.id,
            title: `Task for ${property.address_line1}`
        }}
    />
    <div className="space-y-6">
        {property.image_url && (
            <div className="relative w-full h-64 rounded-lg overflow-hidden border">
                <Image
                    src={property.image_url}
                    alt={property.address_line1}
                    fill
                    className="object-cover"
                    data-ai-hint={property.image_hint}
                />
            </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
                 <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                    <Home className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">{property.address_line1}</h1>
                    <p className="text-muted-foreground">{property.city}, {property.postcode}</p>
                </div>
            </div>
            <div className="sm:ml-auto flex items-center gap-2">
                <Badge variant={getPropertyStatusBadgeVariant(property.status)} className="capitalize h-7 text-sm">{property.status}</Badge>
                <Button variant="outline" onClick={() => setAddTaskOpen(true)}>Create Task</Button>
                <Button variant="outline" onClick={handlePublish} disabled={isPublishing}>
                    <Upload className="mr-2 h-4 w-4" />
                    {isPublishing ? 'Publishing...' : 'Publish'}
                </Button>
                <EditPropertyDialog property={editableProperty} isAdmin={isAdmin} />
            </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader><CardTitle className="text-lg">Property Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-y-4">
                    <InfoCard icon={Building} title="Property Type" value={property.property_type} />
                    <InfoCard icon={Bed} title="Bedrooms" value={property.number_of_bedrooms} />
                    <InfoCard icon={Bath} title="Bathrooms" value={` ${property.number_of_bathrooms}`} />
                    <InfoCard icon={PoundSterling} title="Monthly Rent" value={new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(property.rent_amount))} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5 text-muted-foreground" /> Landlords</CardTitle></CardHeader>
                <CardContent className="text-sm">
                    {isLoadingLandlords ? (
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-5 w-1/2" />
                        </div>
                    ) : landlords && landlords.length > 0 ? (
                        <ul className="space-y-2">
                           {landlords.map((landlord: any) => (
                             <li key={landlord.id}>
                                <Link href={`/contacts/${landlord.id}`} className="font-medium hover:underline text-primary flex items-center gap-2">
                                    <User className="w-4 h-4" /> {landlord.first_name} {landlord.last_name}
                                </Link>
                             </li>
                           ))}
                        </ul>
                    ) : (
                       <p className="text-muted-foreground">No landlords assigned.</p>
                    )}
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2"><StickyNote className="w-5 h-5 text-muted-foreground" /> Description</CardTitle>
                {organization?.aiEnabled && (
                    <Button variant="outline" size="sm" onClick={handleRegenerateDescription} disabled={isGenerating}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        {isGenerating ? 'Generating...' : 'Regenerate'}
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <p className="text-sm whitespace-pre-wrap">{property.description}</p>
            </CardContent>
        </Card>

        <Tabs defaultValue="tenancies" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tenancies">Tenancies</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
          </TabsList>

          <TabsContent value="tenancies" className="mt-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-muted-foreground" /> Tenancy History</CardTitle>
                </CardHeader>
                <CardContent>
                    {isRelatedLoading ? <Skeleton className="h-24 w-full" /> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Term</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tenancies && tenancies.length > 0 ? tenancies.map((tenancy: any) => (
                                    <TableRow key={tenancy.id} className="cursor-pointer" onClick={() => router.push(`/tenancies/${tenancy.id}`)}>
                                        <TableCell>{format(getTimestampAsDate(tenancy.start_date), 'PP')} - {format(getTimestampAsDate(tenancy.end_date), 'PP')}</TableCell>
                                        <TableCell><Badge variant={getTenancyStatusBadgeVariant(tenancy.status)}>{tenancy.status}</Badge></TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={2} className="text-center h-24">No tenancy history.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
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
                        {isRelatedLoading ? <Skeleton className="h-24 w-full" /> : (
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
                                    <TableRow><TableCell colSpan={4} className="text-center h-24">No maintenance history.</TableCell></TableRow>
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
                    {isRelatedLoading ? <Skeleton className="h-24 w-full" /> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>File</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {documents && documents.length > 0 ? documents.map((doc: any) => (
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
                                    <TableRow><TableCell colSpan={2} className="text-center h-24">No documents for this property.</TableCell></TableRow>
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
                </CardHeader>
                <CardContent>
                    {isRelatedLoading ? <Skeleton className="h-24 w-full" /> : (
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
                            {transactions && transactions.length > 0 ? transactions.map((t: any) => (
                                <TableRow key={t.id} className="cursor-pointer" onClick={() => router.push('/transactions')}>
                                    <TableCell>{format(getTimestampAsDate(t.transaction_date), 'PP')}</TableCell>
                                    <TableCell><Badge variant={getTransactionBadgeVariant(t.transaction_type)}>{t.transaction_type}</Badge></TableCell>
                                    <TableCell className="font-medium">{t.description}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(t.amount, t.currency)}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={4} className="text-center h-24">No transactions for this property.</TableCell></TableRow>
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
