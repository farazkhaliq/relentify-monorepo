'use client';

import { useApiCollection } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@relentify/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import { useRouter } from 'next/navigation';

export function VacancyReport() {
  const router = useRouter();
  const { data: properties, isLoading } = useApiCollection<any>('/api/reports/vacancy');

  const formatCurrency = (amount: number, currency = 'GBP') => {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vacancy Report</CardTitle>
        <CardDescription>A list of all currently available properties.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Rent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : properties && properties.length > 0 ? (
              properties.map((prop: any) => (
                <TableRow key={prop.id} className="cursor-pointer" onClick={() => router.push(`/properties/${prop.id}`)}>
                  <TableCell>
                    <div className="font-medium">{prop.address_line1}</div>
                    <div className="text-sm text-muted-foreground">{prop.city}, {prop.postcode}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{prop.property_type}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(prop.rent_amount)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24">No vacant properties found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
