'use client';

import { useParams } from 'next/navigation';
import { Skeleton } from '@relentify/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import { Home, User, Calendar, AlertCircle, Wrench, StickyNote, MapPin, Tag, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@relentify/ui';
import { format } from 'date-fns';
import { EditMaintenanceDialog } from '@/components/crm/edit-maintenance-dialog';
import { useState } from 'react';
import { AddTaskDialog } from '@/components/crm/add-task-dialog';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useApiDoc, useApiCollection } from '@/hooks/use-api';

interface MaintenanceRequest {
    id: string;
    title: string;
    description: string;
    created_at: string;
    priority: 'Urgent' | 'High' | 'Medium' | 'Low';
    status: 'New' | 'In Progress' | 'Awaiting Parts' | 'On Hold' | 'Completed' | 'Cancelled';
    property_id: string;
    reported_by_id: string;
    property_address?: string;
}

export default function MaintenanceDetailPage() {
  const params = useParams();
  const maintenanceId = params.maintenanceId as string;
  const [isAddTaskOpen, setAddTaskOpen] = useState(false);
  const { isAdmin, isLoading: isLoadingCurrentUser } = useUserProfile();

  const { data: request, isLoading: isLoadingRequest } = useApiDoc<MaintenanceRequest>(
    maintenanceId ? `/api/maintenance/${maintenanceId}` : null
  );

  // Fetch property and reporter contact details
  const { data: properties } = useApiCollection('/api/properties');
  const { data: contacts } = useApiCollection('/api/contacts');

  const property = properties?.find((p: any) => p.id === request?.property_id);
  const reporter = contacts?.find((c: any) => c.id === request?.reported_by_id);

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

  const isLoading = isLoadingRequest || isLoadingCurrentUser;

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
            relatedPropertyId: request.property_id,
            title: `Fix: ${(request.description || '').substring(0, 40)}${(request.description || '').length > 40 ? '...' : ''}`,
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
                        <p className="text-muted-foreground">{property.address_line1}, {property.city}</p>
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
                        <Link href={`/properties/${request.property_id}`} className="font-medium hover:underline text-primary">
                            {property.address_line1}, {property.city}, {property.postcode}
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
                         <Link href={`/contacts/${request.reported_by_id}`} className="font-medium hover:underline text-primary">
                            {reporter.first_name} {reporter.last_name}
                        </Link>
                    ) : <Skeleton className="h-5 w-1/2" />}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-muted-foreground" /> Date Reported</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                   <p>{format(new Date(request.created_at), 'PPP p')}</p>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><StickyNote className="w-5 h-5 text-muted-foreground" /> Description</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm whitespace-pre-wrap">{request.description}</p>
            </CardContent>
        </Card>

    </div>
    </>
  );
}
