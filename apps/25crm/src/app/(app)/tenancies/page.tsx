'use client';

import React, { useMemo } from "react";
import { format } from 'date-fns';
import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@relentify/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@relentify/ui";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@relentify/ui";
import { Badge } from "@relentify/ui";
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { AddTenancyDialog } from "@/components/add-tenancy-dialog";

type TenancyStatus = 'Active' | 'Ended' | 'Arrears' | 'Pending';
type PipelineStatus = 'Application Received' | 'Referencing' | 'Awaiting Guarantor' | 'Contract Signed' | 'Awaiting Payment' | 'Complete';

interface Tenancy {
    id: string;
    propertyId: string;
    tenantIds: string[];
    rentAmount: number;
    startDate: any;
    endDate: any;
    status: TenancyStatus;
    pipelineStatus: PipelineStatus;
}

const pipelineStatusColumns: PipelineStatus[] = ['Application Received', 'Referencing', 'Awaiting Guarantor', 'Contract Signed', 'Awaiting Payment', 'Complete'];

export default function TenanciesPage() {
  const router = useRouter();
  
  const [tenancies, setTenancies] = React.useState<Tenancy[]>([]);
  const [properties, setProperties] = React.useState<any[]>([]);
  const [contacts, setContacts] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [tenanciesRes, propertiesRes, contactsRes] = await Promise.all([
          fetch('/api/tenancies'),
          fetch('/api/properties'),
          fetch('/api/contacts')
        ]);

        if (tenanciesRes.ok) setTenancies(await tenanciesRes.json());
        if (propertiesRes.ok) setProperties(await propertiesRes.json());
        if (contactsRes.ok) setContacts(await contactsRes.json());
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Create maps for efficient lookups
  const propertyMap = React.useMemo(() => new Map(properties?.map(p => [p.id, `${p.address_line1}, ${p.city}`]) || []), [properties]);
  const contactMap = React.useMemo(() => new Map(contacts?.map(c => [c.id, `${c.first_name} ${c.last_name}`]) || []), [contacts]);

  const tenanciesByPipelineStatus = useMemo(() => {
    const initial: Record<PipelineStatus, any[]> = { 'Application Received': [], 'Referencing': [], 'Awaiting Guarantor': [], 'Contract Signed': [], 'Awaiting Payment': [], 'Complete': [] };
    return tenancies?.reduce((acc, tenancy) => {
        const status = (tenancy.pipeline_status || 'Application Received') as PipelineStatus;
        if (acc[status]) {
            acc[status].push(tenancy);
        }
        return acc;
    }, initial) || initial;
  }, [tenancies]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'Active': return 'default';
        case 'Ended': return 'secondary';
        case 'Pending': return 'outline';
        case 'Arrears': return 'destructive';
        default: return 'secondary';
    }
  }

  const getPipelineStatusBadgeVariant = (status: string | undefined) => {
    switch (status) {
      case 'Complete': return 'default';
      case 'Referencing': case 'Awaiting Payment': return 'secondary';
      default: return 'outline';
    }
  }

  const getTimestampAsDate = (date: any): Date => {
    if (!date) return new Date();
    return new Date(date);
  };

  const getTenantNames = (tenantIds: string[] | undefined) => {
    if (!tenantIds || tenantIds.length === 0) return 'N/A';
    return tenantIds.map(id => contactMap.get(id) || 'Unknown').join(', ');
  }

  const EmptyState = () => (
    <Card className="col-span-full">
        <CardContent className="py-10 text-center">
            <h3 className="mt-2 text-xl font-semibold">No tenancies found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                Get started by creating a new tenancy agreement.
            </p>
            <div className="mt-6">
                <AddTenancyDialog />
            </div>
        </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6 h-full">
        <Tabs defaultValue="board" className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-semibold">Tenancies</h1>
                    <TabsList className="grid w-full grid-cols-2 h-9">
                        <TabsTrigger value="board" className="h-7"><LayoutGrid className="h-4 w-4 mr-2" />Board</TabsTrigger>
                        <TabsTrigger value="table" className="h-7"><List className="h-4 w-4 mr-2" />Table</TabsTrigger>
                    </TabsList>
                </div>
                <AddTenancyDialog />
            </div>

            <TabsContent value="board" className="flex-1 mt-0">
                {isLoading ? <Skeleton className="h-full w-full" /> : !tenancies || tenancies.length === 0 ? <EmptyState /> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start h-full">
                        {pipelineStatusColumns.map((status) => (
                            <div key={status} className="flex flex-col gap-4 bg-muted/50 p-4 rounded-lg h-full">
                                <h2 className="font-semibold text-lg flex items-center gap-2">
                                    {status} 
                                    <span className="text-sm text-muted-foreground bg-background rounded-full px-2 py-0.5">
                                        {isLoading ? '...' : tenanciesByPipelineStatus[status].length}
                                    </span>
                                </h2>
                                <div className="flex flex-col gap-4 overflow-y-auto">
                                    {isLoading ? (
                                        Array.from({ length: 1 }).map((_, i) => (
                                            <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2 mt-1" /></CardContent><CardFooter><Skeleton className="h-6 w-24" /></CardFooter></Card>
                                        ))
                                    ) : tenanciesByPipelineStatus[status].length > 0 ? (
                                        tenanciesByPipelineStatus[status].map((tenancy) => (
                                            <Card key={tenancy.id} className="bg-background cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/tenancies/${tenancy.id}`)}>
                                                <CardHeader>
                                                    <CardTitle className="text-base">{propertyMap.get(tenancy.property_id) || 'Loading...'}</CardTitle>
                                                    <CardDescription className="line-clamp-2">{getTenantNames(tenancy.tenant_ids)}</CardDescription>
                                                </CardHeader>
                                                <CardFooter>
                                                    <Badge variant="zinc">{new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(tenancy.rent_amount))}</Badge>
                                                </CardFooter>
                                            </Card>
                                        ))
                                    ) : (
                                        <div className="text-sm text-center text-muted-foreground py-8">No tenancies in this stage.</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </TabsContent>
            <TabsContent value="table" className="flex-1 mt-0">
                <Card>
                    <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Property</TableHead>
                            <TableHead>Tenants</TableHead>
                            <TableHead>Term</TableHead>
                            <TableHead>Rent</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Pipeline Stage</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                            </TableRow>
                            ))
                        ) : tenancies && tenancies.length > 0 ? (
                            tenancies.map((tenancy) => (
                            <TableRow 
                                key={tenancy.id}
                                className="cursor-pointer"
                                onClick={() => router.push(`/tenancies/${tenancy.id}`)}
                            >
                                <TableCell className="font-medium">
                                {propertyMap.get(tenancy.property_id) || 'Unknown Property'}
                                </TableCell>
                                <TableCell>{getTenantNames(tenancy.tenant_ids)}</TableCell>
                                <TableCell>
                                {format(getTimestampAsDate(tenancy.start_date), 'PP')} - {tenancy.end_date ? format(getTimestampAsDate(tenancy.end_date), 'PP') : 'N/A'}
                                </TableCell>
                                <TableCell>
                                {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(tenancy.rent_amount))}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={getStatusBadgeVariant(tenancy.status)} className="capitalize">
                                        {tenancy.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={getPipelineStatusBadgeVariant(tenancy.pipeline_status)} className="capitalize">
                                        {tenancy.pipeline_status || 'Application Received'}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={6} className="text-center h-24">
                                No tenancies found.
                            </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
