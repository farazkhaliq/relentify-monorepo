'use client';

import React, { useState } from 'react';
import { useApiCollection, useApiDoc } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@relentify/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Button } from '@relentify/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@relentify/ui';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/crm/date-range-picker';
import { addDays, format } from 'date-fns';
import { Badge } from '@relentify/ui';

interface StatementData {
    transactions: Array<{
        id: string;
        type: string;
        amount: number;
        currency: string;
        description: string;
        transaction_date: string;
    }>;
    income: number;
    expenses: number;
    payouts: number;
    net: number;
}

export function LandlordStatementReport() {
    const [selectedLandlordId, setSelectedLandlordId] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: addDays(new Date(), -30), to: new Date() });
    const [apiUrl, setApiUrl] = useState<string | null>(null);

    // Fetch landlords from the contacts API filtered by type
    const { data: landlords, isLoading: loadingLandlords } = useApiCollection<any>('/api/contacts?type=Landlord');

    // Fetch statement data on demand
    const { data: statementData, isLoading: loadingStatement } = useApiDoc<StatementData>(apiUrl);

    const isLoading = loadingLandlords;

    const generateStatement = () => {
        if (!selectedLandlordId || !dateRange?.from || !dateRange?.to) return;
        const from = format(dateRange.from, 'yyyy-MM-dd');
        const to = format(dateRange.to, 'yyyy-MM-dd');
        setApiUrl(`/api/reports/landlord-statement?landlord_id=${selectedLandlordId}&from=${from}&to=${to}`);
    };

    const formatCurrency = (amount: number, currency = 'GBP') => {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
    };

    const income = statementData?.income ?? 0;
    const expenses = statementData?.expenses ?? 0;
    const payouts = statementData?.payouts ?? 0;
    const netTotal = statementData?.net ?? 0;
    const transactions = statementData?.transactions ?? [];

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
                        <SelectContent>{landlords?.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.first_name} {l.last_name}</SelectItem>)}</SelectContent>
                    </Select>

                    <DateRangePicker date={dateRange} setDate={setDateRange} />

                    <Button onClick={generateStatement} disabled={!selectedLandlordId || !dateRange || loadingStatement}>
                        {loadingStatement ? 'Generating...' : 'Generate Statement'}
                    </Button>
                </div>

                {loadingStatement && <Skeleton className="h-40 w-full" />}

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
                                {transactions.length > 0 ? transactions.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{format(new Date(t.transaction_date), 'PP')}</TableCell>
                                        <TableCell>{t.description}</TableCell>
                                        <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(t.amount)}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={4} className="text-center h-24">No transactions found for this period.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
