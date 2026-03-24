'use client';

import { useParams } from 'next/navigation';
import { doc, Timestamp } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { Skeleton } from '@relentify/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import { Home, User, Calendar, AlertCircle, Wrench, StickyNote, MapPin, Tag, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@relentify/ui';
import { format } from 'date-fns';
import { EditMaintenanceDialog } from '@/components/edit-maintenance-dialog';
import { useState } from 'react';
import { AddTaskDialog } from '@/components/add-task-dialog';
import { useUserProfile } from '@/hooks/use-user-profile';

interface MaintenanceRequest {
    id: string;
    description: string;
    reportedDate: any;
    priority: 'Urgent' | 'High' | 'Medium' | 'Low';
    status: 'New' | 'In Progress' | 'Awaiting Parts' | 'On Hold' | 'Completed' | 'Cancelled';
    propertyId: string;
    reporterContactId: string;
    resolutionNotes?: string;
    issueLocation?: string;
    issueType?: string;
    permissionToEnter?: boolean;
}

interface Property {
    addressLine1: string;
    city: string;
    postcode: string;
}

interface Contact {
    firstName: string;
    lastName: string;
}

export default function MaintenanceDetailPage() {
  const params = useParams();
  const maintenanceId = params.maintenanceId as string;
  const firestore = useFirestore();
  const [isAddTaskOpen, setAddTaskOpen] = useState(false);
  const { userProfile: currentUserProfile, isLoading: isLoadingCurrentUser, isAdmin } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;

  const requestRef = useMemoFirebase(() => 
    (firestore && organizationId && maintenanceId) ? doc(firestore, `organizations/${organizationId}/maintenanceRequests`, maintenanceId) : null,
    [firestore, organizationId, maintenanceId]
  );
  const { data: request, isLoading: isLoadingRequest } = useDoc<MaintenanceRequest>(requestRef);

  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !organizationId || !request?.propertyId) return null;
    return doc(firestore, `organizations/${organizationId}/properties`, request.propertyId);
  }, [firestore, organizationId, request?.propertyId]);
  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyRef);

  const reporterRef = useMemoFirebase(() => {
    if (!firestore || !organizationId || !request?.reporterContactId) return null;
    return doc(firestore, `organizations/${organizationId}/contacts`, request.reporterContactId);
  }, [firestore, organizationId, request?.reporterContactId]);
  const { data: reporter, isLoading: isLoadingReporter } = useDoc<Contact>(reporterRef);

  const getStatusBadgeVariant = (status: string | undefined) => {
    switch (status) {
        case 'New': return 'default';
        case 'In Progress': return 'secondary';
        case 'Completed': return 'outline';
        case 'Cancelled': return 'destructive';
        default: return 'secondary';
    }
  }

  const getPriorityBadgeVariant = (priority: string | undefined) => {
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
  
  const InfoCard = ({ icon: Icon, title, value }: { icon: React.ElementType, title: string, value: string | number | undefined }) => (
    value ? (
        <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-muted-foreground" />
            <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">{title}</span>
                <span className="font-medium">{value}</span>
            </div>
        </div>
    ) : null
  );

  const isLoading = isLoadingRequest || isLoadingProperty || isLoadingReporter || isLoadingCurrentUser;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
            <div className="space-y-2">
                <Skeleton className="h-8 w-80" />
                <Skeleton className="h-5 w-48" />
            </div>
            <div className="flex gap-4">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-7 w-24" />
            </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card><CardHeader><Skeleton className="h-6 w-32 mb-2" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-6 w-32 mb-2" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-6 w-32 mb-2" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>
        </div>
         <Card>
            <CardHeader><Skeleton className="h-6 w-24 mb-2" /></CardHeader>
            <CardContent><Skeleton className="h-20 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-10">
        <p>Maintenance request not found.</p>
        <Button asChild variant="link"><Link href="/maintenance">Go back to maintenance</Link></Button>
      </div>
    );
  }

  return (
    <>
    <AddTaskDialog 
        open={isAddTaskOpen} 
        onOpenChange={setAddTaskOpen} 
        defaultValues={{ 
            relatedPropertyId: request.propertyId,
            title: `Fix: ${request.description.substring(0, 40)}${request.description.length > 40 ? '...' : ''}`,
            description: `Follow up on maintenance request: \n\n${request.description}`
        }} 
    />
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
                 <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                    <Wrench className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Maintenance Request</h1>
                    {property && (
                        <p className="text-muted-foreground">{property.addressLine1}, {property.city}</p>
                    )}
                </div>
            </div>
            <div className="sm:ml-auto flex items-center gap-2">
                <Button variant="outline" onClick={() => setAddTaskOpen(true)}>Create Task</Button>
                <Badge variant={getPriorityBadgeVariant(request.priority)} className="capitalize h-7 text-sm">{request.priority}</Badge>
                <Badge variant={getStatusBadgeVariant(request.status)} className="capitalize h-7 text-sm">{request.status}</Badge>
                <EditMaintenanceDialog maintenanceRequest={request} isAdmin={isAdmin} />
            </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Home className="w-5 h-5 text-muted-foreground" /> Property</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                    {property ? (
                        <Link href={`/properties/${request.propertyId}`} className="font-medium hover:underline text-primary">
                            {property.addressLine1}, {property.city}, {property.postcode}
                        </Link>
                    ) : <Skeleton className="h-5 w-3/4" />}
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5 text-muted-foreground" /> Reported By</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                    {reporter ? (
                         <Link href={`/contacts/${request.reporterContactId}`} className="font-medium hover:underline text-primary">
                            {reporter.firstName} {reporter.lastName}
                        </Link>
                    ) : <Skeleton className="h-5 w-1/2" />}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-muted-foreground" /> Date Reported</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                   <p>{format(getTimestampAsDate(request.reportedDate), 'PPP p')}</p>
                </CardContent>
            </Card>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><AlertCircle className="w-5 h-5 text-muted-foreground" /> Issue Details</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <InfoCard icon={Tag} title="Issue Type" value={request.issueType} />
                <InfoCard icon={MapPin} title="Location" value={request.issueLocation} />
                <div className="flex items-center gap-3">
                    <KeyRound className="w-5 h-5 text-muted-foreground" />
                    <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground">Permission to Enter</span>
                        <span className="font-medium">{request.permissionToEnter ? 'Yes' : 'No'}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><StickyNote className="w-5 h-5 text-muted-foreground" /> Description</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm whitespace-pre-wrap">{request.description}</p>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><StickyNote className="w-5 h-5 text-muted-foreground" /> Resolution Notes</CardTitle>
            </CardHeader>
            <CardContent>
                {request.resolutionNotes ? (
                    <p className="text-sm whitespace-pre-wrap">{request.resolutionNotes}</p>
                ) : (
                    <p className="text-sm text-muted-foreground">No resolution notes yet.</p>
                )}
            </CardContent>
        </Card>

    </div>
    </>
  );
}
