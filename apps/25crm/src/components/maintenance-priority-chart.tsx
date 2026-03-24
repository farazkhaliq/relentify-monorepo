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
import React from 'react';

const chartConfig = {
  count: {
    label: 'Count',
  },
  Urgent: {
    label: 'Urgent',
    color: 'var(--theme-destructive)',
  },
  High: {
    label: 'High',
    color: 'var(--theme-primary)',
  },
  Medium: {
    label: 'Medium',
    color: 'var(--theme-warning)',
  },
  Low: {
    label: 'Low',
    color: 'var(--theme-success)',
  },
} satisfies ChartConfig;

export function MaintenancePriorityChart() {
  const [maintenanceRequests, setMaintenanceRequests] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchMaintenance = async () => {
      try {
        const res = await fetch('/api/maintenance');
        if (res.ok) {
          const data = await res.json();
          setMaintenanceRequests(data);
        }
      } catch (error) {
        console.error('Error fetching maintenance requests:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMaintenance();
  }, []);

  const chartData = React.useMemo(() => {
    if (!maintenanceRequests) return [];
    
    const priorityCounts: Record<string, number> = { Urgent: 0, High: 0, Medium: 0, Low: 0 };
    
    maintenanceRequests.forEach((req) => {
        if(req.priority in priorityCounts) {
            priorityCounts[req.priority]++;
        }
    });

    return Object.entries(priorityCounts).map(([priority, count]) => ({
      priority,
      count,
      fill: (chartConfig as any)[priority]?.color || 'var(--theme-border)',
    }));
  }, [maintenanceRequests]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance by Priority</CardTitle>
        <CardDescription>A summary of open and recent requests.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <div className="h-[250px] w-full"><Skeleton className="h-full w-full" /></div>
        ): (
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart
                    accessibilityLayer
                    data={chartData}
                    margin={{ top: 20, right: 20, bottom: 0, left: 0 }}
                >
                    <CartesianGrid vertical={false} />
                    <XAxis
                    dataKey="priority"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    />
                     <YAxis allowDecimals={false} />
                    <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                    />
                    <Bar dataKey="count" radius={8} />
                </BarChart>
            </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
