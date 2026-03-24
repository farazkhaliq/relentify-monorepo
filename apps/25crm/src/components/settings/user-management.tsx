'use client';

import React from 'react';
import { collection, query, doc } from 'firebase/firestore';
import { MoreHorizontal } from 'lucide-react';

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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@relentify/ui';
import { Button } from '@relentify/ui';
import { useCollection, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { Avatar, AvatarFallback } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';

export function UserManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const auth = useAuth();
    const { userProfile: currentUserProfile, isLoading: isCurrentUserLoading } = useUserProfile();
    const organizationId = currentUserProfile?.organizationId;

    const usersQuery = useMemoFirebase(() =>
        (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/userProfiles`) : null,
        [firestore, organizationId]
    );
    const { data: users, isLoading: loadingUsers } = useCollection<any>(usersQuery);

    const handleChangeRole = (userId: string, userName: string, newRole: 'Admin' | 'Staff') => {
        if (!firestore || !auth || !organizationId) return;

        const userDocRef = doc(firestore, `organizations/${organizationId}/userProfiles`, userId);
        const entityName = userName;
        updateDocumentNonBlocking(firestore, auth, organizationId, userDocRef, { role: newRole }, entityName);

        toast({
            title: 'Role Updated',
            description: `${userName}'s role has been changed to ${newRole}.`,
        });
    }

    const handleChangeStatus = (userId: string, userName: string, newStatus: 'Active' | 'Inactive') => {
        if (!firestore || !auth || !organizationId) return;

        const userDocRef = doc(firestore, `organizations/${organizationId}/userProfiles`, userId);
        const entityName = userName;
        updateDocumentNonBlocking(firestore, auth, organizationId, userDocRef, { status: newStatus }, entityName);

        toast({
            title: 'User Status Updated',
            description: `${userName}'s account has been set to ${newStatus}.`,
        });
    }

    const getRoleBadgeVariant = (role: string) => {
        return role === 'Admin' ? 'default' : 'secondary';
    }

    const getStatusBadgeVariant = (status?: string) => {
        return status === 'Active' ? 'default' : 'destructive';
    }

    const isLoading = isCurrentUserLoading || loadingUsers;
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                    Manage team members and their roles within the organization.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                     <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><div className="space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-40" /></div></div></TableCell>
                                        <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users && users.length > 0 ? (
                                    users.map((u) => (
                                        <TableRow key={u.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9"><AvatarFallback>{u.firstName?.substring(0,1)}{u.lastName?.substring(0,1)}</AvatarFallback></Avatar>
                                                    <div>
                                                        <div className="font-medium">{u.firstName} {u.lastName}</div>
                                                        <div className="text-sm text-muted-foreground">{u.email}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge variant={getRoleBadgeVariant(u.role)}>{u.role}</Badge></TableCell>
                                            <TableCell><Badge variant={getStatusBadgeVariant(u.status)}>{u.status}</Badge></TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost" disabled={u.id === currentUserProfile?.id}><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuSub>
                                                            <DropdownMenuSubTrigger>Change Role</DropdownMenuSubTrigger>
                                                            <DropdownMenuPortal>
                                                                <DropdownMenuSubContent>
                                                                    <DropdownMenuItem onSelect={() => handleChangeRole(u.id, `${u.firstName} ${u.lastName}`, 'Admin')}>Admin</DropdownMenuItem>
                                                                    <DropdownMenuItem onSelect={() => handleChangeRole(u.id, `${u.firstName} ${u.lastName}`, 'Staff')}>Staff</DropdownMenuItem>
                                                                </DropdownMenuSubContent>
                                                            </DropdownMenuPortal>
                                                        </DropdownMenuSub>
                                                        <DropdownMenuSeparator />
                                                        {u.status === 'Active' ? (
                                                            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={() => handleChangeStatus(u.id, `${u.firstName} ${u.lastName}`, 'Inactive')}>Deactivate User</DropdownMenuItem>
                                                        ) : (
                                                            <DropdownMenuItem onSelect={() => handleChangeStatus(u.id, `${u.firstName} ${u.lastName}`, 'Active')}>Activate User</DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (<TableRow><TableCell colSpan={4} className="h-24 text-center">No other users found.</TableCell></TableRow>)}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
