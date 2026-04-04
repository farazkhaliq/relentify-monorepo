'use client';

import React from 'react';
import { useApiCollection } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@relentify/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { useRouter } from 'next/navigation';

export function ArrearsReport() {
  const router = useRouter();
  const { data: tenancies, isLoading } = useApiCollection<any>('/api/reports/arrears');

  const getTenantNames = (tenants: Array<{ id: string; name: string }>) => {
    if (!tenants || tenants.length === 0) return 'N/A';
    return tenants.map(t => t.name).join(', ');
  };

  const formatCurrency = (amount: number, currency = 'GBP') => {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rent Arrears Report</CardTitle>
        <CardDescription>A list of all tenancies currently in arrears.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Tenants</TableHead>
              <TableHead className="text-right">Rent Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : tenancies && tenancies.length > 0 ? (
              tenancies.map((tenancy: any) => (
                <TableRow key={tenancy.id} className="cursor-pointer" onClick={() => router.push(`/tenancies/${tenancy.id}`)}>
                  <TableCell className="font-medium">{tenancy.property_address || 'Unknown Property'}</TableCell>
                  <TableCell>{getTenantNames(tenancy.tenants)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(tenancy.rent_amount)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24">No tenancies in arrears.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
