'use client';

import { Pie, PieChart, Sector } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  Available: {
    label: 'Available',
    color: 'var(--theme-accent)',
  },
  Occupied: {
    label: 'Occupied',
    color: 'var(--theme-success)',
  },
  'Under Offer': {
    label: 'Under Offer',
    color: 'var(--theme-warning)',
  },
  'Let Agreed': {
    label: 'Let Agreed',
    color: 'var(--theme-primary)',
  },
} satisfies ChartConfig;

export function PropertyStatusChart() {
  const [properties, setProperties] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch('/api/properties');
        if (res.ok) {
          const data = await res.json();
          setProperties(data);
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProperties();
  }, []);

  const chartData = React.useMemo(() => {
    if (!properties) return [];
    const statusCounts = properties.reduce((acc, property) => {
      const status = property.status || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      fill: (chartConfig as any)[status]?.color || 'var(--theme-border)',
    }));
  }, [properties]);
  
  const totalProperties = React.useMemo(() => properties?.length || 0, [properties]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Properties by Status</CardTitle>
        <CardDescription>A breakdown of your property portfolio.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {isLoading ? <div className="flex items-center justify-center h-[250px]"><Skeleton className="h-[200px] w-[200px] rounded-full" /></div> : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[250px]">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="status"
                innerRadius={60}
                strokeWidth={5}
                activeIndex={0}
                activeShape={({ outerRadius = 0, ...props }) => (
                    <g>
                      <Sector {...props} outerRadius={outerRadius + 10} />
                      <Sector {...props} outerRadius={outerRadius} innerRadius={outerRadius - 8} />
                    </g>
                )}
              />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
            Total Properties: {isLoading ? <Skeleton className="h-4 w-6" /> : totalProperties}
        </div>
        <div className="leading-none text-muted-foreground">
          Showing the status of all properties in the system.
        </div>
      </CardFooter>
    </Card>
  );
}
