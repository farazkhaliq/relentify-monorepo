'use client';

import React from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@relentify/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { useRouter } from 'next/navigation';

export function ArrearsReport() {
  const firestore = useFirestore();
  const router = useRouter();
  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;

  const arrearsQuery = useMemoFirebase(() =>
    (firestore && organizationId) ? query(
        collection(firestore, `organizations/${organizationId}/tenancies`),
        where('status', '==', 'Arrears')
    ) : null, [firestore, organizationId]);
  const { data: tenancies, isLoading: loadingTenancies } = useCollection<any>(arrearsQuery);

  const propertiesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/properties`) : null, [firestore, organizationId]);
  const { data: properties, isLoading: loadingProperties } = useCollection<any>(propertiesQuery);
  const propertyMap = React.useMemo(() => new Map(properties?.map(p => [p.id, p.addressLine1]) || []), [properties]);
  
  const contactsQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/contacts`) : null, [firestore, organizationId]);
  const { data: contacts, isLoading: loadingContacts } = useCollection<any>(contactsQuery);
  const contactMap = React.useMemo(() => new Map(contacts?.map(c => [c.id, `${c.firstName} ${c.lastName}`]) || []), [contacts]);

  const isLoading = loadingCurrentUser || loadingTenancies || loadingProperties || loadingContacts;

  const getTenantNames = (tenantIds: string[]) => {
    if (!tenantIds || tenantIds.length === 0) return 'N/A';
    return tenantIds.map(id => contactMap.get(id) || 'Unknown').join(', ');
  }

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
              tenancies.map((tenancy) => (
                <TableRow key={tenancy.id} className="cursor-pointer" onClick={() => router.push(`/tenancies/${tenancy.id}`)}>
                  <TableCell className="font-medium">{propertyMap.get(tenancy.propertyId) || 'Unknown Property'}</TableCell>
                  <TableCell>{getTenantNames(tenancy.tenantIds)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(tenancy.rentAmount)}</TableCell>
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
