'use client';

import React, { useMemo, useState } from 'react';
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';

import {
  Card,
  CardContent,
  CardDescription,
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
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { Avatar, AvatarFallback } from '@relentify/ui';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@relentify/ui';
import { User, Edit3, ShieldAlert } from 'lucide-react';

const ENTITY_TYPES = ['Contact', 'Property', 'Tenancy', 'MaintenanceRequest', 'Task', 'Communication', 'UserProfile', 'InventoryItem', 'Document', 'Transaction'];

export default function AuditLogPage() {
  const firestore = useFirestore();
  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;

  // --- State for Filters ---
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');

  // --- Data Fetching ---
  const auditLogsQuery = useMemoFirebase(() =>
    (firestore && organizationId)
      ? query(
          collection(firestore, `organizations/${organizationId}/auditLogs`),
          orderBy('timestamp', 'desc')
        )
      : null,
    [firestore, organizationId]
  );
  const { data: auditLogs, isLoading: loadingLogs } = useCollection<any>(auditLogsQuery);
  
  const usersQuery = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/userProfiles`) : null,
    [firestore, organizationId]
  );
  const { data: users, isLoading: loadingUsers } = useCollection<any>(usersQuery);

  // --- Data Processing & Memos ---
  const userMap = React.useMemo(() => {
    if (!users) return new Map<string, { firstName: string, lastName: string }>();
    return new Map(users.map(u => [u.id, { firstName: u.firstName, lastName: u.lastName }]));
  }, [users]);
  
  const filteredLogs = React.useMemo(() => {
    if (!auditLogs) return [];
    return auditLogs.filter(log => {
      const userMatch = userFilter === 'all' || log.userId === userFilter;
      const actionMatch = actionFilter === 'all' || log.action === actionFilter;
      const entityMatch = entityFilter === 'all' || log.entityType === entityFilter;
      return userMatch && actionMatch && entityMatch;
    });
  }, [auditLogs, userFilter, actionFilter, entityFilter]);

  const getTimestampAsDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
    if (typeof timestamp === 'string') { return new Date(timestamp); }
    return new Date();
  };

  const getAssigneeInitials = (userId: string) => {
    const user = userMap.get(userId);
    if (!user) return '??';
    return `${user.firstName?.substring(0,1) || ''}${user.lastName?.substring(0,1) || ''}`
  }

  const getAssigneeName = (userId: string) => {
    const user = userMap.get(userId);
    if (!user) return 'Unknown User';
    return `${user.firstName} ${user.lastName}`;
  }

  const formatActionDetails = (log: any) => {
    const action = log.action || 'performed an action';
    const entityType = log.entityType || 'an entity';
    const entityId = log.entityId;
    const entityName = log.entityName;

    let entityLink: React.ReactNode = null;
    if (entityId) {
        let path = '';
        switch(entityType.toLowerCase()) {
            case 'contact': path = `/contacts/${entityId}`; break;
            case 'property': path = `/properties/${entityId}`; break;
            case 'tenancy': path = `/tenancies/${entityId}`; break;
            case 'communication': path = `/communications?emailId=${entityId}`; break;
            case 'maintenancerequest': path = `/maintenance/${entityId}`; break;
            case 'task': path = '/tasks'; break;
            case 'userprofile': path = '/settings'; break;
            case 'document': path = '/documents'; break;
            default: path = ''; break;
        }
        const linkText = entityName || entityId;

        if (path) {
            entityLink = <Link href={path} className="font-mono text-xs bg-muted p-1 rounded-md ml-2 hover:underline hover:bg-primary/10">{linkText}</Link>;
        } else {
            entityLink = <span className="font-mono text-xs bg-muted p-1 rounded-md ml-2">{linkText}</span>;
        }
    }

    return (
      <p>
        <span className="font-semibold">{action}</span> on the {entityType.toLowerCase()}
        {entityLink}
      </p>
    );
  }

  const isLoading = loadingLogs || loadingUsers || loadingCurrentUser;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <div className="flex items-center gap-2">
            <Select value={userFilter} onValueChange={setUserFilter} disabled={isLoading}>
                <SelectTrigger className="w-[180px] h-8 text-sm"><User className="h-4 w-4 mr-2" /><SelectValue placeholder="Filter by user..." /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Users</SelectItem>{users?.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter} disabled={isLoading}>
                <SelectTrigger className="w-[160px] h-8 text-sm"><Edit3 className="h-4 w-4 mr-2" /><SelectValue placeholder="Filter by action..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="Created">Created</SelectItem>
                    <SelectItem value="Updated">Updated</SelectItem>
                    <SelectItem value="Deleted">Deleted</SelectItem>
                </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter} disabled={isLoading}>
                <SelectTrigger className="w-[180px] h-8 text-sm"><ShieldAlert className="h-4 w-4 mr-2" /><SelectValue placeholder="Filter by entity..." /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Entities</SelectItem>{ENTITY_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
            </Select>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>System History</CardTitle>
          <CardDescription>
            A log of all actions performed in the system, filterable by user, action, or entity type.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-5 w-24" /></div></TableCell>
                    <TableCell><Skeleton className="h-5 w-64" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredLogs && filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{getAssigneeInitials(log.userId)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{getAssigneeName(log.userId)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatActionDetails(log)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                        {format(getTimestampAsDate(log.timestamp), 'PPpp')}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">
                    No audit logs found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
