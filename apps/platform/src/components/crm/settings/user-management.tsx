'use client';

import React, { useState, useEffect } from 'react';
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
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { Avatar, AvatarFallback } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import { useToast } from '@/hooks/use-toast';

interface UserProfileItem {
    id: string;
    user_id: string;
    role: string;
    email?: string;
    full_name?: string;
}

export function UserManagement() {
    const { toast } = useToast();
    const { userProfile: currentUserProfile, isLoading: isCurrentUserLoading } = useUserProfile();

    const [users, setUsers] = useState<UserProfileItem[] | null>(null);
    const [loadingUsers, setLoadingUsers] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch('/api/user-profiles');
                if (res.ok) {
                    const data = await res.json();
                    setUsers(data);
                }
            } catch (err) {
                console.error('Error fetching user profiles:', err);
            } finally {
                setLoadingUsers(false);
            }
        };
        fetchUsers();
    }, []);

    const handleChangeRole = async (profileId: string, userName: string, newRole: 'Admin' | 'Staff') => {
        try {
            const res = await fetch(`/api/user-profiles/${profileId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });
            if (res.ok) {
                setUsers(prev => prev?.map(u => u.id === profileId ? { ...u, role: newRole } : u) || null);
                toast({
                    title: 'Role Updated',
                    description: `${userName}'s role has been changed to ${newRole}.`,
                });
            }
        } catch (err) {
            console.error('Error updating role:', err);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update role.' });
        }
    }

    const getRoleBadgeVariant = (role: string) => {
        return role === 'Admin' ? 'default' : 'secondary';
    }

    const getInitials = (fullName?: string) => {
        if (!fullName) return '??';
        const parts = fullName.trim().split(/\s+/);
        return `${parts[0]?.substring(0,1) || ''}${parts[1]?.substring(0,1) || ''}`;
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
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><div className="space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-40" /></div></div></TableCell>
                                        <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
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
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users && users.length > 0 ? (
                                    users.map((u) => (
                                        <TableRow key={u.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9"><AvatarFallback>{getInitials(u.full_name)}</AvatarFallback></Avatar>
                                                    <div>
                                                        <div className="font-medium">{u.full_name || 'Unknown'}</div>
                                                        <div className="text-sm text-muted-foreground">{u.email}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge variant={getRoleBadgeVariant(u.role)}>{u.role}</Badge></TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost" disabled={u.user_id === currentUserProfile?.uid}><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuSub>
                                                            <DropdownMenuSubTrigger>Change Role</DropdownMenuSubTrigger>
                                                            <DropdownMenuPortal>
                                                                <DropdownMenuSubContent>
                                                                    <DropdownMenuItem onSelect={() => handleChangeRole(u.id, u.full_name || 'User', 'Admin')}>Admin</DropdownMenuItem>
                                                                    <DropdownMenuItem onSelect={() => handleChangeRole(u.id, u.full_name || 'User', 'Staff')}>Staff</DropdownMenuItem>
                                                                </DropdownMenuSubContent>
                                                            </DropdownMenuPortal>
                                                        </DropdownMenuSub>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (<TableRow><TableCell colSpan={3} className="h-24 text-center">No other users found.</TableCell></TableRow>)}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
