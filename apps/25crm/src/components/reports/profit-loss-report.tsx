'use client';

import React, { useState, useMemo } from 'react';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@relentify/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Button } from '@relentify/ui';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/date-range-picker';
import { addDays, format, startOfYear } from 'date-fns';
import { Badge } from '@relentify/ui';
import { cn } from '@/lib/utils';

interface Transaction {
    id: string;
    transactionType: 'Rent Payment' | 'Management Fee' | 'Commission' | 'Landlord Payout' | 'Contractor Payment' | 'Agency Expense' | 'Deposit';
    amount: number;
    currency: string;
    transactionDate: any;
    description: string;
}

export function ProfitLossReport() {
    const firestore = useFirestore();
    const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();
    const organizationId = currentUserProfile?.organizationId;
    
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfYear(new Date()), to: new Date() });
    const [reportData, setReportData] = useState<any[] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Fetch all transactions for the org
    const transactionsQuery = useMemoFirebase(() => 
        (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/transactions`) : null, 
    [firestore, organizationId]);
    const { data: allTransactions, isLoading: loadingTransactions } = useCollection<any>(transactionsQuery);
    
    const isLoading = loadingCurrentUser || loadingTransactions;

    const generateReport = () => {
        if (!dateRange?.from || !dateRange?.to || !allTransactions) return;
        
        setIsGenerating(true);
        
        const fromTimestamp = Timestamp.fromDate(dateRange.from);
        const toTimestamp = Timestamp.fromDate(dateRange.to);

        const relevantTransactions = allTransactions.filter(t => {
            const transactionDate = t.transactionDate instanceof Timestamp ? t.transactionDate : Timestamp.fromDate(new Date(t.transactionDate));
            const isDateInRange = transactionDate >= fromTimestamp && transactionDate <= toTimestamp;
            if (!isDateInRange) return false;

            return ['Management Fee', 'Commission', 'Agency Expense'].includes(t.transactionType);
        });

        setReportData(relevantTransactions.sort((a,b) => getTimestampAsDate(a.transactionDate).getTime() - getTimestampAsDate(b.transactionDate).getTime()));
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

    const income = reportData?.filter(t => ['Management Fee', 'Commission'].includes(t.transactionType)).reduce((sum, t) => sum + t.amount, 0) ?? 0;
    const expenses = reportData?.filter(t => t.transactionType === 'Agency Expense').reduce((sum, t) => sum + t.amount, 0) ?? 0;
    const netProfit = income - expenses;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Profit & Loss Statement</CardTitle>
                <CardDescription>Generate a P&L statement for your agency for a specific date range.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                    <DateRangePicker date={dateRange} setDate={setDateRange} />
                    
                    <Button onClick={generateReport} disabled={!dateRange || isGenerating || isLoading}>
                        {isGenerating ? 'Generating...' : 'Generate Report'}
                    </Button>
                </div>

                {isGenerating && <Skeleton className="h-40 w-full" />}
                
                {reportData && (
                    <div className="space-y-4 pt-4">
                         <div className="grid gap-4 md:grid-cols-3">
                            <Card><CardHeader className="pb-2"><CardDescription>Total Income</CardDescription><CardTitle className="text-2xl text-[var(--theme-success)]">{formatCurrency(income)}</CardTitle></CardHeader></Card>
                            <Card><CardHeader className="pb-2"><CardDescription>Total Expenses</CardDescription><CardTitle className="text-2xl text-[var(--theme-destructive)]">{formatCurrency(expenses)}</CardTitle></CardHeader></Card>
                            <Card><CardHeader className="pb-2"><CardDescription>Net Profit</CardDescription><CardTitle className="text-2xl">{formatCurrency(netProfit)}</CardTitle></CardHeader></Card>
                        </div>
                        <div className="rounded-md border">
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {reportData.length > 0 ? reportData.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{format(getTimestampAsDate(t.transactionDate), 'PP')}</TableCell>
                                        <TableCell>{t.description}</TableCell>
                                        <TableCell className={cn("text-right font-medium", ['Management Fee', 'Commission'].includes(t.transactionType) ? 'text-[var(--theme-success)]' : 'text-[var(--theme-destructive)]')}>
                                            {t.transactionType === 'Agency Expense' ? '-' : ''}
                                            {formatCurrency(t.amount)}
                                        </TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={3} className="text-center h-24">No transactions found for this period.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
