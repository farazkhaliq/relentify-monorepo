'use client';

import React from 'react';
import { useApiDoc } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@relentify/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@relentify/ui';

const chartConfig = {
  count: {
    label: "Requests",
    color: "var(--theme-accent)",
  },
} satisfies ChartConfig;

interface MaintenanceReportData {
  summary: Array<{ status: string; priority: string; count: number }>;
  requests: Array<{
    id: string;
    property_id?: string;
    title: string;
    description?: string;
    priority: string;
    status: string;
    reported_date: string;
    property_address?: string;
  }>;
  chartData: Array<{ type: string; count: number }>;
}

export function MaintenanceReport() {
  const router = useRouter();
  const { data: reportData, isLoading } = useApiDoc<MaintenanceReportData>('/api/reports/maintenance-report');

  const requests = reportData?.requests ?? [];
  const chartData = reportData?.chartData ?? [];

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'New': return 'default';
        case 'In Progress': return 'secondary';
        case 'Awaiting Quote': case 'Scheduled': return 'outline';
        default: return 'secondary';
    }
  }

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
        case 'Urgent': return 'destructive';
        case 'High': return 'default';
        case 'Medium': return 'secondary';
        case 'Low': return 'outline';
        default: return 'outline';
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open Maintenance Report</CardTitle>
        <CardDescription>A summary of all maintenance requests that are not yet completed.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <Skeleton className="h-[250px] w-full" />
        ) : chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="min-h-[200px] w-full mb-8">
                <BarChart accessibilityLayer data={chartData} margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                    dataKey="type"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                    />
                    <Bar dataKey="count" fill="var(--color-count)" radius={8} />
                </BarChart>
            </ChartContainer>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Reported</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : requests.length > 0 ? (
              requests.map((req) => (
                <TableRow key={req.id} className="cursor-pointer" onClick={() => router.push(`/maintenance/${req.id}`)}>
                  <TableCell className="font-medium">{req.property_address || 'Unknown Property'}</TableCell>
                  <TableCell className="truncate max-w-xs">{req.description}</TableCell>
                  <TableCell><Badge variant={getPriorityBadgeVariant(req.priority)}>{req.priority}</Badge></TableCell>
                  <TableCell><Badge variant={getStatusBadgeVariant(req.status)}>{req.status}</Badge></TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{format(new Date(req.reported_date), 'PP')}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">No open maintenance requests.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
