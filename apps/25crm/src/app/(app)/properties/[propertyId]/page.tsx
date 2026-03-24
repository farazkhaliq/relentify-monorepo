'use client';

import { useParams, useRouter } from 'next/navigation';
import { doc, collection, query, where, orderBy, Timestamp, setDoc, serverTimestamp } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useAuth } from '@/firebase';
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
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { FirestorePermissionError, errorEmitter } from '@/firebase';

// This could be moved to a types file
interface Property {
    id: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postcode: string;
    country: string;
    propertyType: string;
    numberOfBedrooms: number;
    numberOfBathrooms: number;
    rentAmount: number;
    description: string;
    status: string;
    landlordIds: string[];
    imageUrl?: string;
    imageHint?: string;
}

interface Tenancy {
    id: string;
    startDate: any;
    endDate: any;
    status: string;
}

interface MaintenanceRequest {
    id: string;
    description: string;
    reportedDate: any;
    priority: 'Urgent' | 'High' | 'Medium' | 'Low';
    status: 'New' | 'In Progress' | 'Awaiting Parts' | 'On Hold' | 'Completed' | 'Cancelled';
}

interface Contact {
    id: string;
    firstName: string;
    lastName: string;
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

interface Transaction {
    id: string;
    transactionType: 'Rent Payment' | 'Management Fee' | 'Commission' | 'Landlord Payout' | 'Contractor Payment' | 'Agency Expense' | 'Deposit';
    amount: number;
    currency: string;
    transactionDate: any;
    description: string;
}

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.propertyId as string;
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [isAddTaskOpen, setAddTaskOpen] = useState(false);
  const [isAddDocOpen, setAddDocOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const { userProfile: currentUserProfile, isLoading: isLoadingCurrentUser, isAdmin } = useUserProfile();
  const { organization } = useOrganization();
  const organizationId = currentUserProfile?.organizationId;

  const propertyRef = useMemoFirebase(() => 
    (firestore && organizationId && propertyId) ? doc(firestore, `organizations/${organizationId}/properties`, propertyId) : null,
    [firestore, organizationId, propertyId]
  );
  
  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyRef);

  const landlordsQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !property?.landlordIds || property.landlordIds.length === 0) return null;
    return query(
        collection(firestore, `organizations/${organizationId}/contacts`),
        where('__name__', 'in', property.landlordIds)
    )
  }, [firestore, organizationId, property?.landlordIds]);
  const { data: landlords, isLoading: isLoadingLandlords } = useCollection<Contact>(landlordsQuery);

  // Query for all tenancies linked to this property
  const tenanciesQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !propertyId) return null;
    return query(
      collection(firestore, `organizations/${organizationId}/tenancies`),
      where('propertyId', '==', propertyId),
      orderBy('startDate', 'desc')
    );
  }, [firestore, organizationId, propertyId]);
  const { data: tenancies, isLoading: isLoadingTenancies } = useCollection<Tenancy>(tenanciesQuery);

  // Query for all maintenance requests for this property
  const maintenanceQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !propertyId) return null;
    return query(
      collection(firestore, `organizations/${organizationId}/maintenanceRequests`),
      where('propertyId', '==', propertyId),
      orderBy('reportedDate', 'desc')
    );
  }, [firestore, organizationId, propertyId]);
  const { data: maintenanceRequests, isLoading: isLoadingMaintenance } = useCollection<MaintenanceRequest>(maintenanceQuery);

  // Query for all documents for this property
  const documentsQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !propertyId) return null;
    return query(
      collection(firestore, `organizations/${organizationId}/documents`),
      where('propertyIds', 'array-contains', propertyId),
      orderBy('uploadDate', 'desc')
    );
  }, [firestore, organizationId, propertyId]);
  const { data: documents, isLoading: isLoadingDocuments } = useCollection<Document>(documentsQuery);

  // Query for transactions related to this property
  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !propertyId) return null;
    return query(
      collection(firestore, `organizations/${organizationId}/transactions`),
      where('relatedPropertyId', '==', propertyId),
      orderBy('transactionDate', 'desc')
    );
  }, [firestore, organizationId, propertyId]);
  const { data: transactions, isLoading: isLoadingTransactions } = useCollection<Transaction>(transactionsQuery);

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
    if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
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
    if (!property || !organizationId || !auth || !propertyRef) return;
    setIsGenerating(true);
    try {
      const generatedDesc = await generatePropertyDescription({
        propertyType: property.propertyType,
        city: property.city,
        numberOfBedrooms: property.numberOfBedrooms,
        numberOfBathrooms: property.numberOfBathrooms,
        description: property.description, // Pass current one for context
      });
      
      updateDocumentNonBlocking(firestore, auth, organizationId, propertyRef, { description: generatedDesc }, property.addressLine1);
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

  const handlePublish = () => {
    if (!property || !organizationId || !firestore || !auth) {
        toast({ title: 'Error', description: 'Cannot publish property.', variant: 'destructive' });
        return;
    }
    setIsPublishing(true);

    const publicListingData = {
        id: property.id,
        organizationId: organizationId,
        addressLine1: property.addressLine1,
        addressLine2: property.addressLine2 || '',
        city: property.city,
        postcode: property.postcode,
        country: property.country,
        propertyType: property.propertyType,
        numberOfBedrooms: property.numberOfBedrooms,
        numberOfBathrooms: property.numberOfBathrooms,
        description: property.description,
        rentAmount: property.rentAmount,
        imageUrl: property.imageUrl || '',
        updatedAt: serverTimestamp(),
    };

    const listingRef = doc(firestore, 'propertyListings', property.id);
    
    setDoc(listingRef, publicListingData, { merge: true })
        .then(() => {
            toast({ title: 'Published', description: 'Property has been published to the public feed.' });
        })
        .catch((serverError) => {
            console.error("Publishing failed", serverError);
            const permissionError = new FirestorePermissionError({
              path: `propertyListings/${property.id}`,
              operation: 'write',
              requestResourceData: publicListingData,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            setIsPublishing(false);
        });
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
            title: `Task for ${property.addressLine1}`
        }} 
    />
    <div className="space-y-6">
        {property.imageUrl && (
            <div className="relative w-full h-64 rounded-lg overflow-hidden border">
                <Image
                    src={property.imageUrl}
                    alt={property.addressLine1}
                    fill
                    className="object-cover"
                    data-ai-hint={property.imageHint}
                />
            </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
                 <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                    <Home className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">{property.addressLine1}</h1>
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
                <EditPropertyDialog property={property} isAdmin={isAdmin} />
            </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader><CardTitle className="text-lg">Property Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-y-4">
                    <InfoCard icon={Building} title="Property Type" value={property.propertyType} />
                    <InfoCard icon={Bed} title="Bedrooms" value={property.numberOfBedrooms} />
                    <InfoCard icon={Bath} title="Bathrooms" value={` ${property.numberOfBathrooms}`} />
                    <InfoCard icon={PoundSterling} title="Monthly Rent" value={new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(property.rentAmount)} />
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
                           {landlords.map(landlord => (
                             <li key={landlord.id}>
                                <Link href={`/contacts/${landlord.id}`} className="font-medium hover:underline text-primary flex items-center gap-2">
                                    <User className="w-4 h-4" /> {landlord.firstName} {landlord.lastName}
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
                                {tenancies && tenancies.length > 0 ? tenancies.map(tenancy => (
                                    <TableRow key={tenancy.id} className="cursor-pointer" onClick={() => router.push(`/tenancies/${tenancy.id}`)}>
                                        <TableCell>{format(getTimestampAsDate(tenancy.startDate), 'PP')} - {format(getTimestampAsDate(tenancy.endDate), 'PP')}</TableCell>
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
                                {maintenanceRequests && maintenanceRequests.length > 0 ? maintenanceRequests.map(request => (
                                    <TableRow key={request.id} className="cursor-pointer" onClick={() => router.push(`/maintenance/${request.id}`)}>
                                        <TableCell>{format(getTimestampAsDate(request.reportedDate), 'PP')}</TableCell>
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
                            {transactions && transactions.length > 0 ? transactions.map(t => (
                                <TableRow key={t.id} className="cursor-pointer" onClick={() => router.push('/transactions')}>
                                    <TableCell>{format(getTimestampAsDate(t.transactionDate), 'PP')}</TableCell>
                                    <TableCell><Badge variant={getTransactionBadgeVariant(t.transactionType)}>{t.transactionType}</Badge></TableCell>
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
