'use client';

import React, { useState, useMemo } from 'react';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { usePortalUserProfile } from '@/hooks/use-portal-user-profile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@relentify/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Button } from '@relentify/ui';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/date-range-picker';
import { addDays, format, startOfYear } from 'date-fns';
import { Badge } from '@relentify/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@relentify/ui';

interface Transaction {
    id: string;
    transactionType: 'Rent Payment' | 'Management Fee' | 'Commission' | 'Landlord Payout' | 'Contractor Payment' | 'Agency Expense' | 'Deposit';
    amount: number;
    currency: string;
    transactionDate: any;
    description: string;
    relatedPropertyId?: string;
    payerContactId?: string;
    payeeContactId?: string;
}

export default function PortalFinancialsPage() {
    const firestore = useFirestore();
    const { portalUserProfile, isLoading: isLoadingProfile } = usePortalUserProfile();
    const organizationId = portalUserProfile?.organizationId;
    const contactId = portalUserProfile?.contactId;

    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfYear(new Date()), to: new Date() });

    // 1. Fetch landlord's properties
    const propertiesQuery = useMemoFirebase(() =>
        (firestore && organizationId && contactId) ? query(collection(firestore, `organizations/${organizationId}/properties`), where('landlordIds', 'array-contains', contactId)) : null,
        [firestore, organizationId, contactId]
    );
    const { data: properties, isLoading: isLoadingProperties } = useCollection<any>(propertiesQuery);
    const propertyIds = useMemo(() => properties?.map(p => p.id) || [], [properties]);

    // 2. Fetch transactions based on properties and date range
    const transactionsQuery = useMemoFirebase(() => {
        if (!firestore || !organizationId || propertyIds.length === 0 || !dateRange?.from || !dateRange?.to) return null;
        
        return query(
            collection(firestore, `organizations/${organizationId}/transactions`),
            where('relatedPropertyId', 'in', propertyIds),
            where('transactionDate', '>=', dateRange.from),
            where('transactionDate', '<=', dateRange.to),
            orderBy('transactionDate', 'desc')
        );
    }, [firestore, organizationId, propertyIds, dateRange]);
    const { data: transactions, isLoading: isLoadingTransactions } = useCollection<any>(transactionsQuery);

    const isLoading = isLoadingProfile || isLoadingProperties || isLoadingTransactions;

    const formatCurrency = (amount: number, currency = 'GBP') => {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
    };

    const getTimestampAsDate = (timestamp: any): Date => {
        if (!timestamp) return new Date();
        if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
        if (typeof timestamp === 'string') { return new Date(timestamp); }
        return new Date();
    };
    
    const getBadgeVariant = (type: string) => {
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
    
    return (
        <div className="flex flex-col gap-6 w-full max-w-6xl">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold">Financials</h1>
                <p className="text-muted-foreground">View transactions related to your properties.</p>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Transactions</CardTitle>
                        <DateRangePicker date={dateRange} setDate={setDateRange} />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Property</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : transactions && transactions.length > 0 ? (
                                transactions.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell className="text-sm text-muted-foreground">{format(getTimestampAsDate(t.transactionDate), 'PP')}</TableCell>
                                        <TableCell>{properties?.find(p => p.id === t.relatedPropertyId)?.addressLine1}</TableCell>
                                        <TableCell className="font-medium">{t.description}</TableCell>
                                        <TableCell><Badge variant={getBadgeVariant(t.transactionType)}>{t.transactionType}</Badge></TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(t.amount)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">No transactions found for this period.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
