'use client';

import React, { useState, useMemo } from 'react';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@relentify/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Button } from '@relentify/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@relentify/ui';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/date-range-picker';
import { addDays, format } from 'date-fns';
import { Badge } from '@relentify/ui';

interface Transaction {
    id: string;
    transactionType: 'Rent Payment' | 'Management Fee' | 'Landlord Payout' | 'Contractor Payment' | 'Deposit';
    amount: number;
    currency: string;
    transactionDate: any;
    description: string;
    relatedPropertyId?: string;
    payerContactId?: string;
    payeeContactId?: string;
}

export function LandlordStatementReport() {
    const firestore = useFirestore();
    const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();
    const organizationId = currentUserProfile?.organizationId;
    
    const [selectedLandlordId, setSelectedLandlordId] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: addDays(new Date(), -30), to: new Date() });
    const [statementData, setStatementData] = useState<any[] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Data fetching
    const landlordsQuery = useMemoFirebase(() => (firestore && organizationId) ? query(collection(firestore, `organizations/${organizationId}/contacts`), where('contactType', '==', 'Landlord')) : null, [firestore, organizationId]);
    const { data: landlords, isLoading: loadingLandlords } = useCollection<any>(landlordsQuery);
    
    const propertiesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/properties`) : null, [firestore, organizationId]);
    const { data: properties, isLoading: loadingProperties } = useCollection<any>(propertiesQuery);
    
    const transactionsQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/transactions`) : null, [firestore, organizationId]);
    const { data: allTransactions, isLoading: loadingTransactions } = useCollection<any>(transactionsQuery);
    
    const isLoading = loadingCurrentUser || loadingLandlords || loadingProperties || loadingTransactions;

    const generateStatement = () => {
        if (!selectedLandlordId || !dateRange?.from || !dateRange?.to || !allTransactions || !properties) return;
        
        setIsGenerating(true);
        
        const landlordProperties = properties.filter(p => p.landlordIds.includes(selectedLandlordId)).map(p => p.id);
        
        const fromTimestamp = Timestamp.fromDate(dateRange.from);
        const toTimestamp = Timestamp.fromDate(dateRange.to);

        const relevantTransactions = allTransactions.filter(t => {
            const transactionDate = t.transactionDate instanceof Timestamp ? t.transactionDate : Timestamp.fromDate(new Date(t.transactionDate));
            const isDateInRange = transactionDate >= fromTimestamp && transactionDate <= toTimestamp;
            if (!isDateInRange) return false;

            const isPayout = t.transactionType === 'Landlord Payout' && t.payeeContactId === selectedLandlordId;
            const isRelatedToProperty = t.relatedPropertyId && landlordProperties.includes(t.relatedPropertyId);
            
            return isPayout || (isRelatedToProperty && ['Rent Payment', 'Management Fee', 'Contractor Payment'].includes(t.transactionType));
        });

        setStatementData(relevantTransactions.sort((a,b) => getTimestampAsDate(a.transactionDate).getTime() - getTimestampAsDate(b.transactionDate).getTime()));
        setIsGenerating(false);
    };

    const formatCurrency = (amount: number, currency = 'GBP') => {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
    };

    const getTimestampAsDate = (timestamp: any): Date => {
        if (!timestamp) return new Date();
        if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
        if (typeof timestamp === 'string') { return new Date(timestamp); }
        return new Date();
    };

    const income = statementData?.filter(t => t.transactionType === 'Rent Payment').reduce((sum, t) => sum + t.amount, 0) ?? 0;
    const expenses = statementData?.filter(t => ['Management Fee', 'Contractor Payment'].includes(t.transactionType)).reduce((sum, t) => sum + t.amount, 0) ?? 0;
    const payouts = statementData?.filter(t => t.transactionType === 'Landlord Payout').reduce((sum, t) => sum + t.amount, 0) ?? 0;
    const netTotal = income - expenses - payouts;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Landlord Statement</CardTitle>
                <CardDescription>Generate a financial statement for a specific landlord over a date range.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Select onValueChange={setSelectedLandlordId} disabled={isLoading}>
                        <SelectTrigger className="w-full sm:w-[250px]"><SelectValue placeholder="Select a landlord" /></SelectTrigger>
                        <SelectContent>{landlords?.map(l => <SelectItem key={l.id} value={l.id}>{l.firstName} {l.lastName}</SelectItem>)}</SelectContent>
                    </Select>
                    
                    <DateRangePicker date={dateRange} setDate={setDateRange} />
                    
                    <Button onClick={generateStatement} disabled={!selectedLandlordId || !dateRange || isGenerating}>
                        {isGenerating ? 'Generating...' : 'Generate Statement'}
                    </Button>
                </div>

                {isGenerating && <Skeleton className="h-40 w-full" />}
                
                {statementData && (
                    <div className="space-y-4 pt-4">
                         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Card><CardHeader className="pb-2"><CardDescription>Total Income</CardDescription><CardTitle className="text-2xl text-[var(--theme-success)]">{formatCurrency(income)}</CardTitle></CardHeader></Card>
                            <Card><CardHeader className="pb-2"><CardDescription>Total Expenses</CardDescription><CardTitle className="text-2xl text-[var(--theme-destructive)]">{formatCurrency(expenses)}</CardTitle></CardHeader></Card>
                            <Card><CardHeader className="pb-2"><CardDescription>Total Paid Out</CardDescription><CardTitle className="text-2xl">{formatCurrency(payouts)}</CardTitle></CardHeader></Card>
                            <Card><CardHeader className="pb-2"><CardDescription>Net Balance</CardDescription><CardTitle className="text-2xl">{formatCurrency(netTotal)}</CardTitle></CardHeader></Card>
                        </div>
                        <div className="rounded-md border">
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {statementData.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{format(getTimestampAsDate(t.transactionDate), 'PP')}</TableCell>
                                        <TableCell>{t.description}</TableCell>
                                        <TableCell><Badge variant="zinc">{t.transactionType}</Badge></TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(t.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
