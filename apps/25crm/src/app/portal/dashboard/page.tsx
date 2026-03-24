'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@relentify/ui";
import { usePortalUserProfile } from '@/hooks/use-portal-user-profile';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, doc, query, where, Timestamp } from "firebase/firestore";
import { Skeleton } from "@relentify/ui";
import { Badge } from "@relentify/ui";
import { Home, User, FileText, Bed, Bath, PoundSterling, Wrench, Landmark } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@relentify/ui";
import { useRouter } from "next/navigation";
import { format, subDays, startOfYear } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@relentify/ui';

// Component for Tenant Dashboard
const TenantDashboard = ({ organizationId, contactId }: { organizationId: string, contactId: string }) => {
    const firestore = useFirestore();

    const tenancyQuery = useMemoFirebase(() =>
        query(
            collection(firestore, `organizations/${organizationId}/tenancies`),
            where('tenantIds', 'array-contains', contactId),
            where('status', '==', 'Active')
        ), [firestore, organizationId, contactId]
    );
    const { data: tenancies, isLoading: isLoadingTenancies } = useCollection<any>(tenancyQuery);
    const activeTenancy = tenancies?.[0];

    const propertyRef = useMemoFirebase(() => 
        (activeTenancy?.propertyId) ? doc(firestore, `organizations/${organizationId}/properties`, activeTenancy.propertyId) : null, 
    [firestore, organizationId, activeTenancy?.propertyId]);
    const { data: property, isLoading: isLoadingProperty } = useDoc<any>(propertyRef);

    const isLoading = isLoadingTenancies || isLoadingProperty;

    if (isLoading) {
        return <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>
    }

    if (!activeTenancy) {
        return <Card><CardContent className="p-6">You do not have an active tenancy.</CardContent></Card>
    }

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Home className="h-5 w-5" /> Your Rented Property</CardTitle>
                </CardHeader>
                <CardContent>
                    {property ? (
                        <div className="space-y-4">
                             <h3 className="text-xl font-semibold">{property.addressLine1}</h3>
                             <p className="text-muted-foreground">{property.city}, {property.postcode}</p>
                             <div className="flex flex-wrap gap-4 text-sm pt-2">
                                <div className="flex items-center gap-2"><Bed className="h-4 w-4" /> {property.numberOfBedrooms} Bedrooms</div>
                                <div className="flex items-center gap-2"><Bath className="h-4 w-4" /> {property.numberOfBathrooms} Bathrooms</div>
                                <div className="flex items-center gap-2"><PoundSterling className="h-4 w-4" /> {property.rentAmount.toLocaleString()} / month</div>
                             </div>
                        </div>
                    ) : <Skeleton className="h-24 w-full" />}
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Your Tenancy</CardTitle>
                </CardHeader>
                <CardContent>
                     <div className="space-y-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Status</p>
                            <Badge>{activeTenancy.status}</Badge>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Term</p>
                            <p className="font-medium">{new Date(activeTenancy.startDate.seconds * 1000).toLocaleDateString()} - {new Date(activeTenancy.endDate.seconds * 1000).toLocaleDateString()}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// Component for Landlord Dashboard
const LandlordDashboard = ({ organizationId, contactId }: { organizationId: string, contactId: string }) => {
    const firestore = useFirestore();
    const router = useRouter();
    const [timeRange, setTimeRange] = useState('30');

    const getTimestampAsDate = (timestamp: any): Date => {
        if (!timestamp) return new Date();
        if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
        if (typeof timestamp === 'string') { return new Date(timestamp); }
        return new Date();
    };
    
    const formatCurrency = (amount: number, currency = 'GBP') => {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
    };

    // 1. Fetch landlord's properties
    const propertiesQuery = useMemoFirebase(() =>
        query(collection(firestore, `organizations/${organizationId}/properties`), where('landlordIds', 'array-contains', contactId)),
        [firestore, organizationId, contactId]
    );
    const { data: properties, isLoading: isLoadingProperties } = useCollection<any>(propertiesQuery);
    const propertyIds = useMemo(() => properties?.map(p => p.id) || [], [properties]);

    // 2. Fetch open maintenance requests for those properties
    const maintenanceQuery = useMemoFirebase(() =>
        (propertyIds.length > 0) ? query(
            collection(firestore, `organizations/${organizationId}/maintenanceRequests`),
            where('propertyId', 'in', propertyIds),
            where('status', 'in', ['New', 'In Progress', 'Awaiting Parts', 'On Hold'])
        ) : null, [firestore, organizationId, propertyIds]
    );
    const { data: maintenanceRequests, isLoading: isLoadingMaintenance } = useCollection<any>(maintenanceQuery);
    
    // 3. Fetch transactions based on dynamic date range
    const dateFrom = useMemo(() => {
        const days = parseInt(timeRange);
        if (timeRange === 'ytd') {
            return startOfYear(new Date());
        }
        return subDays(new Date(), days);
    }, [timeRange]);
    
    const transactionsQuery = useMemoFirebase(() => 
        (propertyIds.length > 0) ? query(
            collection(firestore, `organizations/${organizationId}/transactions`),
            where('relatedPropertyId', 'in', propertyIds),
            where('transactionDate', '>=', dateFrom)
        ) : null, [firestore, organizationId, propertyIds, dateFrom]
    );
    const { data: transactions, isLoading: isLoadingTransactions } = useCollection<any>(transactionsQuery);

    const financialSummary = useMemo(() => {
        if (!transactions) return { income: 0, expenses: 0, net: 0 };
        const income = transactions.filter(t => t.transactionType === 'Rent Payment').reduce((sum, t) => sum + t.amount, 0);
        const expenses = transactions.filter(t => ['Management Fee', 'Contractor Payment'].includes(t.transactionType)).reduce((sum, t) => sum + t.amount, 0);
        return { income, expenses, net: income - expenses };
    }, [transactions]);


    const isLoading = isLoadingProperties || isLoadingMaintenance || isLoadingTransactions;
    
    const timeRangeLabel = useMemo(() => {
        if (timeRange === 'ytd') return 'this year';
        return `the last ${timeRange} days`;
    }, [timeRange]);

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" /> Financials</CardTitle>
                            <CardDescription>A summary of financial activity for {timeRangeLabel}.</CardDescription>
                        </div>
                         <Select value={timeRange} onValueChange={setTimeRange}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select time range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="30">Last 30 days</SelectItem>
                                <SelectItem value="90">Last 90 days</SelectItem>
                                <SelectItem value="ytd">This Year</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? <Skeleton className="h-20 w-full" /> : (
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div><p className="text-sm text-muted-foreground">Income</p><p className="text-xl font-bold text-[var(--theme-success)]">{formatCurrency(financialSummary.income)}</p></div>
                            <div><p className="text-sm text-muted-foreground">Expenses</p><p className="text-xl font-bold text-[var(--theme-destructive)]">{formatCurrency(financialSummary.expenses)}</p></div>
                            <div><p className="text-sm text-muted-foreground">Net</p><p className="text-xl font-bold">{formatCurrency(financialSummary.net)}</p></div>
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Open Maintenance Requests</CardTitle>
                    <CardDescription>Active maintenance issues across your properties.</CardDescription>
                </CardHeader>
                <CardContent>
                     {isLoading ? <Skeleton className="h-24 w-full" /> : (
                        <Table>
                            <TableHeader><TableRow><TableHead>Property</TableHead><TableHead>Issue</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {maintenanceRequests && maintenanceRequests.length > 0 ? maintenanceRequests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>{properties?.find(p => p.id === req.propertyId)?.addressLine1}</TableCell>
                                        <TableCell className="truncate max-w-xs">{req.description}</TableCell>
                                        <TableCell className="text-right"><Badge variant="zinc">{req.status}</Badge></TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={3} className="text-center h-24">No open maintenance requests.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Home className="h-5 w-5" /> Your Properties</CardTitle>
                    <CardDescription>You have {properties?.length || 0} properties in your portfolio.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingProperties ? <Skeleton className="h-20 w-full" /> : properties && properties.length > 0 ? (
                        <div className="space-y-4">
                            {properties.map(prop => (
                                <div key={prop.id} className="block border p-4 rounded-lg">
                                    <p className="font-semibold">{prop.addressLine1}</p>
                                    <p className="text-sm text-muted-foreground">{prop.city}, {prop.postcode}</p>
                                    <Badge variant={prop.status === 'Available' ? 'default' : 'secondary'} className="mt-2">{prop.status}</Badge>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>You do not have any properties assigned to you.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function PortalDashboardPage() {
    const { portalUserProfile, isLoading: isLoadingProfile } = usePortalUserProfile();
    const firestore = useFirestore();
    
    // This query is just to get the contact type, which doesn't change often.
    const contactRef = useMemoFirebase(() => {
        if (!firestore || !portalUserProfile) return null;
        return doc(firestore, `organizations/${portalUserProfile.organizationId}/contacts`, portalUserProfile.contactId);
    }, [firestore, portalUserProfile]);
    const { data: contact, isLoading: isLoadingContact } = useDoc<any>(contactRef);
    
    const isLoading = isLoadingProfile || isLoadingContact;

    if (isLoading) {
        return (
            <div className="flex flex-col gap-6 w-full max-w-4xl">
                <Card><CardHeader><Skeleton className="h-8 w-3/5" /></CardHeader><CardContent><div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div></CardContent></Card>
            </div>
        );
    }
  
    return (
    <div className="flex flex-col gap-6 w-full max-w-4xl">
        <div className="space-y-1">
            <h1 className="text-2xl font-bold">Welcome, {portalUserProfile?.firstName}</h1>
            <p className="text-muted-foreground">
                This is your dedicated dashboard.
            </p>
        </div>

        {contact?.contactType === 'Tenant' && portalUserProfile && (
            <TenantDashboard organizationId={portalUserProfile.organizationId} contactId={portalUserProfile.contactId} />
        )}
        
        {contact?.contactType === 'Landlord' && portalUserProfile && (
            <LandlordDashboard organizationId={portalUserProfile.organizationId} contactId={portalUserProfile.contactId} />
        )}

        {contact && contact.contactType !== 'Tenant' && contact.contactType !== 'Landlord' && (
             <Card>
                <CardHeader>
                    <CardTitle>Portal Access</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Your account type ({contact.contactType}) does not currently have a dedicated portal dashboard.</p>
                </CardContent>
            </Card>
        )}
    </div>
  );
}
