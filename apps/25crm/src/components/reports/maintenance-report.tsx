'use client';

import React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@relentify/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
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

export function MaintenanceReport() {
  const firestore = useFirestore();
  const router = useRouter();
  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;

  const openMaintenanceQuery = useMemoFirebase(() =>
    (firestore && organizationId) ? query(
        collection(firestore, `organizations/${organizationId}/maintenanceRequests`),
        where('status', 'in', ['New', 'In Progress', 'Awaiting Parts', 'On Hold']),
        orderBy('reportedDate', 'desc')
    ) : null, [firestore, organizationId]);
  const { data: requests, isLoading: loadingRequests } = useCollection<any>(openMaintenanceQuery);

  const propertiesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/properties`) : null, [firestore, organizationId]);
  const { data: properties, isLoading: loadingProperties } = useCollection<any>(propertiesQuery);
  const propertyMap = React.useMemo(() => new Map(properties?.map(p => [p.id, p.addressLine1]) || []), [properties]);

  const isLoading = loadingCurrentUser || loadingRequests || loadingProperties;

  const chartData = React.useMemo(() => {
    if (!requests) return [];
    
    const typeCounts = requests.reduce((acc, req) => {
      const type = req.issueType || 'Other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count,
    }));
  }, [requests]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'New': return 'default';
        case 'In Progress': return 'secondary';
        case 'Awaiting Parts': case 'On Hold': return 'outline';
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

  const getTimestampAsDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
    if (typeof timestamp === 'string') { return new Date(timestamp); }
    return new Date();
  };

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
            ) : requests && requests.length > 0 ? (
              requests.map((req) => (
                <TableRow key={req.id} className="cursor-pointer" onClick={() => router.push(`/maintenance/${req.id}`)}>
                  <TableCell className="font-medium">{propertyMap.get(req.propertyId) || 'Unknown Property'}</TableCell>
                  <TableCell className="truncate max-w-xs">{req.description}</TableCell>
                  <TableCell><Badge variant={getPriorityBadgeVariant(req.priority)}>{req.priority}</Badge></TableCell>
                  <TableCell><Badge variant={getStatusBadgeVariant(req.status)}>{req.status}</Badge></TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{format(getTimestampAsDate(req.reportedDate), 'PP')}</TableCell>
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
