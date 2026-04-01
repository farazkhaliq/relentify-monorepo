'use client';

import React, { useMemo, useState, useEffect } from 'react';
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
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { Avatar, AvatarFallback } from '@relentify/ui';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@relentify/ui';
import { User, Edit3, ShieldAlert } from 'lucide-react';

const ENTITY_TYPES = ['Contact', 'Property', 'Tenancy', 'MaintenanceRequest', 'Task', 'Communication', 'UserProfile', 'InventoryItem', 'Document', 'Transaction'];

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  resource_name: string | null;
  user_name: string | null;
  created_at: string;
}

export default function AuditLogPage() {
  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();

  // --- State for Filters ---
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');

  // --- Data Fetching ---
  const [auditLogs, setAuditLogs] = useState<AuditLog[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/audit-logs');
        if (res.ok) {
          const data = await res.json();
          setAuditLogs(data);
        }
      } catch (err) {
        console.error('Error fetching audit logs:', err);
      } finally {
        setLoadingLogs(false);
      }
    };
    fetchLogs();
  }, []);

  // Build unique user list from logs for the filter dropdown
  const uniqueUsers = useMemo(() => {
    if (!auditLogs) return [];
    const map = new Map<string, string>();
    auditLogs.forEach(log => {
      if (log.user_id && log.user_name) {
        map.set(log.user_id, log.user_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    if (!auditLogs) return [];
    return auditLogs.filter(log => {
      const userMatch = userFilter === 'all' || log.user_id === userFilter;
      const actionMatch = actionFilter === 'all' || log.action === actionFilter;
      const entityMatch = entityFilter === 'all' || log.resource_type === entityFilter;
      return userMatch && actionMatch && entityMatch;
    });
  }, [auditLogs, userFilter, actionFilter, entityFilter]);

  const getAssigneeInitials = (userName: string | null) => {
    if (!userName) return '??';
    const parts = userName.trim().split(/\s+/);
    return `${parts[0]?.substring(0,1) || ''}${parts[1]?.substring(0,1) || ''}`;
  }

  const formatActionDetails = (log: AuditLog) => {
    const action = log.action || 'performed an action';
    const entityType = log.resource_type || 'an entity';
    const entityId = log.resource_id;
    const entityName = log.resource_name;

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

  const isLoading = loadingLogs || loadingCurrentUser;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <div className="flex items-center gap-2">
            <Select value={userFilter} onValueChange={setUserFilter} disabled={isLoading}>
                <SelectTrigger className="w-[180px] h-8 text-sm"><User className="h-4 w-4 mr-2" /><SelectValue placeholder="Filter by user..." /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Users</SelectItem>{uniqueUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter} disabled={isLoading}>
                <SelectTrigger className="w-[160px] h-8 text-sm"><Edit3 className="h-4 w-4 mr-2" /><SelectValue placeholder="Filter by action..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="Create">Created</SelectItem>
                    <SelectItem value="Update">Updated</SelectItem>
                    <SelectItem value="Delete">Deleted</SelectItem>
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
                          <AvatarFallback>{getAssigneeInitials(log.user_name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{log.user_name || 'Unknown User'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatActionDetails(log)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                        {log.created_at ? format(new Date(log.created_at), 'PPpp') : ''}
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
