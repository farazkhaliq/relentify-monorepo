'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGrid, List } from 'lucide-react';

import {
  Card,
  CardContent,
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
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@relentify/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@relentify/ui";
import { Badge } from "@relentify/ui";
import { Avatar, AvatarFallback } from "@relentify/ui";
import { useApiCollection } from '@/hooks/use-api';
import { Skeleton } from '@relentify/ui';
import { AddContactDialog } from '@/components/add-contact-dialog';
import { Button } from '@relentify/ui';

export default function ContactsPage() {
  const [contactTypeFilter, setContactTypeFilter] = useState("all");
  const router = useRouter();

  const { data: contacts, isLoading } = useApiCollection('/api/contacts');

  const getBadgeVariant = (type: string) => {
    switch (type) {
        case 'Tenant': return 'default';
        case 'Landlord': return 'secondary';
        case 'Lead': return 'outline';
        case 'Contractor': return 'destructive';
        default: return 'secondary';
    }
  }

  const filteredContacts = contacts?.filter((contact: any) => {
    if (contactTypeFilter === 'all') return true;
    // Ensure case-insensitive comparison
    return contact.contact_type?.toLowerCase() === contactTypeFilter;
  }) || [];


  const PageSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
                <CardHeader className="flex flex-col items-center text-center gap-4">
                    <Skeleton className="h-20 w-20 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-5 w-20 mx-auto" />
                    </div>
                </CardHeader>
                <CardContent className="text-center space-y-2">
                    <Skeleton className="h-4 w-40 mx-auto" />
                    <Skeleton className="h-4 w-28 mx-auto" />
                </CardContent>
            </Card>
        ))}
    </div>
  );

  const EmptyState = () => (
    <Card className="col-span-full">
        <CardContent className="py-10 text-center">
            <h3 className="mt-2 text-xl font-semibold">No contacts found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                Get started by adding a new contact.
            </p>
            <div className="mt-6">
                <AddContactDialog />
            </div>
        </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
        <Tabs defaultValue="grid">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-semibold">Contacts</h1>
                    <TabsList className="grid w-full grid-cols-2 h-9">
                        <TabsTrigger value="grid" className="h-7"><LayoutGrid className="h-4 w-4 mr-2" />Grid</TabsTrigger>
                        <TabsTrigger value="list" className="h-7"><List className="h-4 w-4 mr-2" />List</TabsTrigger>
                    </TabsList>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={contactTypeFilter} onValueChange={setContactTypeFilter} disabled={isLoading}>
                        <SelectTrigger className="w-[180px] h-9 text-sm">
                            <SelectValue placeholder="All Contact Types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="tenant">Tenants</SelectItem>
                            <SelectItem value="landlord">Landlords</SelectItem>
                            <SelectItem value="lead">Leads</SelectItem>
                            <SelectItem value="contractor">Contractors</SelectItem>
                        </SelectContent>
                    </Select>
                    <AddContactDialog />
                </div>
            </div>

            <TabsContent value="grid">
                {isLoading ? (
                    <PageSkeleton />
                ) : filteredContacts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredContacts.map((contact: any) => (
                            <Card key={contact.id} className="cursor-pointer hover:shadow-lg transition-shadow flex flex-col" onClick={() => router.push(`/contacts/${contact.id}`)}>
                                <CardHeader className="flex flex-col items-center text-center gap-4">
                                    <Avatar className="h-20 w-20 text-3xl">
                                        <AvatarFallback>{contact.first_name?.substring(0,1)}{contact.last_name?.substring(0,1)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <CardTitle className="text-xl">{contact.first_name} {contact.last_name}</CardTitle>
                                        <Badge variant={getBadgeVariant(contact.contact_type)} className="capitalize mt-2">{contact.contact_type}</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-center text-sm text-muted-foreground flex-1 flex flex-col justify-center">
                                    <p className="truncate">{contact.email}</p>
                                    <p>{contact.phone}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <EmptyState />
                )}
            </TabsContent>

            <TabsContent value="list">
                <Card>
                    <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="hidden md:table-cell">Email</TableHead>
                            <TableHead className="hidden md:table-cell">Phone</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-40" /></TableCell>
                                <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-28" /></TableCell>
                            </TableRow>
                            ))
                        ) : filteredContacts.length > 0 ? (
                            filteredContacts.map((contact: any) => (
                            <TableRow
                                key={contact.id}
                                className="cursor-pointer"
                                onClick={() => router.push(`/contacts/${contact.id}`)}
                            >
                                <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar className="hidden h-9 w-9 sm:flex">
                                    <AvatarFallback>{contact.first_name?.substring(0,1)}{contact.last_name?.substring(0,1)}</AvatarFallback>
                                    </Avatar>
                                    <div className="font-medium">{contact.first_name} {contact.last_name}</div>
                                </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={getBadgeVariant(contact.contact_type)} className="capitalize">{contact.contact_type}</Badge>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">{contact.email}</TableCell>
                                <TableCell className="hidden md:table-cell">{contact.phone}</TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24">
                                     No contacts found matching your criteria.
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
