'use client';

import React, { useState } from 'react';
import { useApiDoc } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@relentify/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Button } from '@relentify/ui';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/crm/date-range-picker';
import { format, startOfYear } from 'date-fns';
import { cn } from '@/lib/utils';

interface ReportData {
    transactions: Array<{
        id: string;
        type: string;
        amount: number;
        currency: string;
        description: string;
        transaction_date: string;
    }>;
    total_income: number;
    total_expenses: number;
    net: number;
}

export function ProfitLossReport() {
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfYear(new Date()), to: new Date() });
    const [apiUrl, setApiUrl] = useState<string | null>(null);

    const { data: reportData, isLoading } = useApiDoc<ReportData>(apiUrl);

    const generateReport = () => {
        if (!dateRange?.from || !dateRange?.to) return;
        const from = format(dateRange.from, 'yyyy-MM-dd');
        const to = format(dateRange.to, 'yyyy-MM-dd');
        setApiUrl(`/api/reports/profit-loss?from=${from}&to=${to}`);
    };

    const formatCurrency = (amount: number, currency = 'GBP') => {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
    };

    const income = reportData?.total_income ?? 0;
    const expenses = reportData?.total_expenses ?? 0;
    const netProfit = reportData?.net ?? 0;
    const transactions = reportData?.transactions ?? [];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Profit & Loss Statement</CardTitle>
                <CardDescription>Generate a P&L statement for your agency for a specific date range.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                    <DateRangePicker date={dateRange} setDate={setDateRange} />

                    <Button onClick={generateReport} disabled={!dateRange || isLoading}>
                        {isLoading ? 'Generating...' : 'Generate Report'}
                    </Button>
                </div>

                {isLoading && <Skeleton className="h-40 w-full" />}

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
                                {transactions.length > 0 ? transactions.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{format(new Date(t.transaction_date), 'PP')}</TableCell>
                                        <TableCell>{t.description}</TableCell>
                                        <TableCell className={cn("text-right font-medium", ['Management Fee', 'Commission'].includes(t.type) ? 'text-[var(--theme-success)]' : 'text-[var(--theme-destructive)]')}>
                                            {t.type === 'Agency Expense' ? '-' : ''}
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
