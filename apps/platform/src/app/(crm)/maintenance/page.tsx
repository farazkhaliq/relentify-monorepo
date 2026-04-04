'use client';

import React, { useMemo, useState } from "react";
import { format } from 'date-fns';
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Flag, Home } from "lucide-react";

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@relentify/ui";
import { Badge } from "@relentify/ui";
import { Skeleton } from '@relentify/ui';
import { useApiCollection } from '@/hooks/use-api';
import { AddMaintenanceRequestDialog } from "@/components/crm/add-maintenance-request-dialog";
import { SortableTableHead } from "@/components/crm/sortable-table-head";

type MaintenanceStatus = 'New' | 'In Progress' | 'Awaiting Parts' | 'On Hold' | 'Completed' | 'Cancelled';
type SortDirection = 'asc' | 'desc';

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  created_at: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  status: MaintenanceStatus;
  property_id: string;
  reported_by_id: string;
  property_address?: string;
}

const statusColumns: MaintenanceStatus[] = ['New', 'In Progress', 'Awaiting Parts', 'On Hold', 'Completed', 'Cancelled'];

const priorityOrder: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

export default function MaintenancePage() {
  const router = useRouter();

  const { data: requests, isLoading: loadingRequests } = useApiCollection<MaintenanceRequest>('/api/maintenance');
  const { data: properties, isLoading: loadingProperties } = useApiCollection('/api/properties');
  const { data: contacts, isLoading: loadingContacts } = useApiCollection('/api/contacts');

  const isLoading = loadingRequests || loadingProperties || loadingContacts;

  const [propertyFilter, setPropertyFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortDescriptor, setSortDescriptor] = useState<{ column: any; direction: SortDirection }>({ column: 'created_at', direction: 'desc' });

  const propertyAddressMap = React.useMemo(() => new Map(properties?.map((p: any) => [p.id, `${p.address_line1}, ${p.city}`]) || []), [properties]);
  const contactNameMap = React.useMemo(() => new Map(contacts?.map((c: any) => [c.id, `${c.first_name} ${c.last_name}`]) || []), [contacts]);

  const handleSort = (column: any) => {
    if (sortDescriptor.column === column) {
      setSortDescriptor({ ...sortDescriptor, direction: sortDescriptor.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortDescriptor({ column, direction: 'asc' });
    }
  };

  const filteredAndSortedRequests = useMemo(() => {
    let processedRequests = [...(requests || [])];

    // Apply filters
    if (propertyFilter !== 'all') {
      processedRequests = processedRequests.filter(req => req.property_id === propertyFilter);
    }
    if (priorityFilter !== 'all') {
      processedRequests = processedRequests.filter(req => req.priority === priorityFilter);
    }

    // Apply sorting
    processedRequests.sort((a, b) => {
      const { column, direction } = sortDescriptor;
      let aValue: any, bValue: any;

      switch (column) {
        case 'propertyId': case 'property_id':
          aValue = propertyAddressMap.get(a.property_id) || '';
          bValue = propertyAddressMap.get(b.property_id) || '';
          break;
        case 'reporterContactId': case 'reported_by_id':
          aValue = contactNameMap.get(a.reported_by_id) || '';
          bValue = contactNameMap.get(b.reported_by_id) || '';
          break;
        case 'reportedDate': case 'created_at':
            aValue = new Date(a.created_at).getTime();
            bValue = new Date(b.created_at).getTime();
            break;
        case 'priority':
            aValue = priorityOrder[a.priority] || 0;
            bValue = priorityOrder[b.priority] || 0;
            break;
        default:
          aValue = (a as any)[column];
          bValue = (b as any)[column];
      }

      let comparison = 0;
      if (aValue > bValue) comparison = 1;
      else if (aValue < bValue) comparison = -1;

      return direction === 'desc' ? comparison * -1 : comparison;
    });

    return processedRequests;
  }, [requests, propertyFilter, priorityFilter, sortDescriptor, propertyAddressMap, contactNameMap]);

  const requestsByStatus = useMemo(() => {
    const initial: Record<MaintenanceStatus, any[]> = { 'New': [], 'In Progress': [], 'Awaiting Parts': [], 'On Hold': [], 'Completed': [], 'Cancelled': [] };
    return filteredAndSortedRequests?.reduce((acc, req) => {
        const status = req.status as MaintenanceStatus;
        if (acc[status]) {
            acc[status].push(req);
        }
        return acc;
    }, initial) || initial;
  }, [filteredAndSortedRequests]);


  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'New': return 'default';
        case 'In Progress': return 'secondary';
        case 'Completed': return 'outline';
        case 'Cancelled': return 'destructive';
        case 'On Hold':
        case 'Awaiting Parts':
            return 'secondary'
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
    <div className="flex flex-col gap-6 h-full">
      <Tabs defaultValue="board" className="flex flex-col gap-4 h-full">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Maintenance Requests</h1>
          <div className="flex items-center gap-2">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="board" className="h-7"><LayoutGrid className="h-4 w-4 mr-2" />Board</TabsTrigger>
              <TabsTrigger value="table" className="h-7"><List className="h-4 w-4 mr-2" />Table</TabsTrigger>
            </TabsList>
            <Select value={propertyFilter} onValueChange={setPropertyFilter} disabled={isLoading}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                  <Home className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties?.map((prop: any) => (
                      <SelectItem key={prop.id} value={prop.id}>{prop.address_line1}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter} disabled={isLoading}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                  <Flag className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <AddMaintenanceRequestDialog />
          </div>
        </div>

        <TabsContent value="board" className="flex-1 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start h-full">
              {statusColumns.map((status) => (
              <div key={status} className="flex flex-col gap-4 bg-muted/50 p-4 rounded-lg h-full">
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                      {status}
                      <span className="text-sm text-muted-foreground bg-background rounded-full px-2 py-0.5">
                          {isLoading ? '...' : requestsByStatus[status].length}
                      </span>
                  </h2>
                  <div className="flex flex-col gap-4 overflow-y-auto">
                      {isLoading ? (
                          Array.from({ length: 2 }).map((_, i) => (
                              <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent><CardFooter><Skeleton className="h-6 w-24" /></CardFooter></Card>
                          ))
                      ) : requestsByStatus[status].length > 0 ? (
                          requestsByStatus[status].map((request: any) => (
                            <Card key={request.id} className="bg-background cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/maintenance/${request.id}`)}>
                                <CardHeader>
                                    <CardTitle className="text-base">{request.property_address || propertyAddressMap.get(request.property_id) || 'Loading...'}</CardTitle>
                                    <CardDescription className="line-clamp-2">{request.description}</CardDescription>
                                </CardHeader>
                                <CardFooter>
                                    <Badge variant={getPriorityBadgeVariant(request.priority)}>{request.priority}</Badge>
                                </CardFooter>
                            </Card>
                          ))
                      ) : (
                          <div className="text-sm text-center text-muted-foreground py-8">No requests in this stage.</div>
                      )}
                  </div>
              </div>
              ))}
          </div>
        </TabsContent>
        <TabsContent value="table" className="flex-1 mt-0">
            <Card>
                <CardContent>
                <Table>
                    <TableHeader>
                    <TableRow>
                        <SortableTableHead column="property_id" title="Property" sortDescriptor={sortDescriptor} onSort={handleSort} />
                        <TableHead>Description</TableHead>
                        <SortableTableHead column="reported_by_id" title="Reported By" sortDescriptor={sortDescriptor} onSort={handleSort} />
                        <SortableTableHead column="priority" title="Priority" sortDescriptor={sortDescriptor} onSort={handleSort} className="hidden sm:table-cell" />
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        <SortableTableHead column="created_at" title="Reported" sortDescriptor={sortDescriptor} onSort={handleSort} className="hidden md:table-cell" />
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                            <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
                            <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-28" /></TableCell>
                        </TableRow>
                        ))
                    ) : filteredAndSortedRequests && filteredAndSortedRequests.length > 0 ? (
                        filteredAndSortedRequests.map((request) => (
                        <TableRow
                            key={request.id}
                            className="cursor-pointer"
                            onClick={() => router.push(`/maintenance/${request.id}`)}
                        >
                            <TableCell>
                            <div className="font-medium" title={request.property_id}>
                                {request.property_address || propertyAddressMap.get(request.property_id) || '...'}
                            </div>
                            </TableCell>
                            <TableCell className="truncate max-w-[200px]">{request.description}</TableCell>
                            <TableCell>{contactNameMap.get(request.reported_by_id) || '...'}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                            <Badge variant={getPriorityBadgeVariant(request.priority)} className="capitalize">
                                {request.priority}
                            </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                            <Badge variant={getStatusBadgeVariant(request.status)} className="capitalize">
                                {request.status}
                            </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                            {format(new Date(request.created_at), 'PP')}
                            </TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            No maintenance requests found.
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
