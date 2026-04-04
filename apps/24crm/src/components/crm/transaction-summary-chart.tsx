'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@relentify/ui';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import React, { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@relentify/ui"
import { subMonths, format } from 'date-fns';

const chartConfig = {
  amount: {
    label: 'Amount (£)',
  },
  'Rent Payment': {
    label: 'Rent',
    color: 'var(--theme-accent)',
  },
  'Management Fee': {
    label: 'Fees',
    color: 'var(--theme-success)',
  },
  'Commission': {
    label: 'Commission',
    color: 'var(--theme-success)',
  },
  'Landlord Payout': {
    label: 'Payouts',
    color: 'var(--theme-warning)',
  },
  'Contractor Payment': {
    label: 'Payments',
    color: 'var(--theme-primary)',
  },
  'Agency Expense': {
    label: 'Expense',
    color: 'var(--theme-destructive)',
  },
  'Deposit': {
    label: 'Deposits',
    color: 'var(--theme-destructive)',
  },
} satisfies ChartConfig;

export function TransactionSummaryChart() {
  const [timeRange, setTimeRange] = useState('3'); // Default to 3 months
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Default to false since we aren't fetching for now

  // For now, we'll just show an empty chart to avoid Firestore errors
  // while we migrate other more critical parts.
  const chartData = React.useMemo(() => {
    return [];
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Transaction Summary</CardTitle>
                <CardDescription>A summary of income and expenses.</CardDescription>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last month</SelectItem>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <div className="h-[350px] w-full"><Skeleton className="h-full w-full" /></div>
        ): (
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <BarChart
                    accessibilityLayer
                    data={chartData}
                    margin={{ top: 20, right: 20, bottom: 20, left: 0 }}
                >
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="month"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                    />
                     <YAxis
                        tickFormatter={(value) => `£${Number(value) / 1000}k`}
                     />
                    <ChartTooltip
                        content={<ChartTooltipContent />}
                    />
                    {Object.keys(chartConfig).filter(key => key !== 'amount').map((key) => (
                        <Bar
                            key={key}
                            dataKey={key}
                            stackId="a"
                            fill={chartConfig[key as keyof typeof chartConfig].color}
                            radius={[4, 4, 0, 0]}
                         />
                    ))}
                </BarChart>
            </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
