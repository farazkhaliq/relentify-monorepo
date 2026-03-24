'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGrid, List } from 'lucide-react';
import Image from 'next/image';

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
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@relentify/ui";
import { Badge } from "@relentify/ui";
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { AddPropertyDialog } from '@/components/add-property-dialog';

export default function PropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProperties = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/properties');
        if (res.ok) {
          const data = await res.json();
          setProperties(data);
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProperties();
  }, []);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'Available':
        case 'Let Agreed':
            return 'default';
        case 'Occupied':
            return 'secondary';
        case 'Under Offer':
            return 'outline';
        default:
            return 'secondary';
    }
  }
  
  const GridSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
                <Skeleton className="aspect-[3/2] w-full" />
                <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                </CardContent>
                 <CardFooter>
                    <Skeleton className="h-6 w-20" />
                </CardFooter>
            </Card>
        ))}
    </div>
  );

  const ListSkeleton = () => (
     Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
            <TableCell><Skeleton className="h-5 w-48" /></TableCell>
            <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
            <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
        </TableRow>
    ))
  )

  return (
    <div className="flex flex-col gap-6">
        <Tabs defaultValue="grid">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                     <h1 className="text-2xl font-semibold">Properties</h1>
                    <TabsList className="hidden md:grid w-full grid-cols-2 h-9">
                        <TabsTrigger value="grid" className="h-7"><LayoutGrid className="h-4 w-4 mr-2" />Grid</TabsTrigger>
                        <TabsTrigger value="list" className="h-7"><List className="h-4 w-4 mr-2" />List</TabsTrigger>
                    </TabsList>
                </div>
                <div className="flex items-center gap-2">
                    <div className="md:hidden">
                        <TabsList className="grid w-full grid-cols-2 h-9">
                            <TabsTrigger value="grid" className="h-7"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
                            <TabsTrigger value="list" className="h-7"><List className="h-4 w-4" /></TabsTrigger>
                        </TabsList>
                    </div>
                    <AddPropertyDialog />
                </div>
            </div>
            
            <TabsContent value="grid">
                {isLoading ? (
                    <GridSkeleton />
                ) : properties && properties.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {properties.map((property) => (
                            <Card key={property.id} className="cursor-pointer hover:shadow-lg transition-shadow flex flex-col overflow-hidden" onClick={() => router.push(`/properties/${property.id}`)}>
                                {property.image_url && (
                                    <div className="relative aspect-[3/2] w-full">
                                        <Image
                                            src={property.image_url}
                                            alt={property.address_line1}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                            data-ai-hint={property.image_hint}
                                        />
                                    </div>
                                )}
                                <CardHeader>
                                    <CardTitle className="text-lg">{property.address_line1}</CardTitle>
                                    <CardDescription>{property.city}, {property.postcode}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <p className="text-sm font-semibold">{new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(property.rent_amount))}</p>
                                    <p className="text-sm text-muted-foreground">{property.property_type}</p>
                                </CardContent>
                                <CardFooter>
                                    <Badge variant={getStatusBadgeVariant(property.status)} className="capitalize">{property.status}</Badge>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="py-10 text-center">
                            <h3 className="mt-2 text-sm font-semibold">No properties</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Get started by adding a new property.</p>
                        </CardContent>
                    </Card>
                )}
            </TabsContent>
            
            <TabsContent value="list">
                <Card>
                    <CardHeader>
                        <CardTitle>All Properties</CardTitle>
                        <CardDescription>
                            Manage your properties.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Address</TableHead>
                            <TableHead className="hidden md:table-cell">Type</TableHead>
                            <TableHead className="hidden lg:table-cell">Rent</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {isLoading ? (
                            <ListSkeleton />
                        ) : properties && properties.length > 0 ? (
                            properties.map((property) => (
                            <TableRow 
                                key={property.id}
                                className="cursor-pointer"
                                onClick={() => router.push(`/properties/${property.id}`)}
                            >
                                <TableCell>
                                <div className="font-medium">{property.address_line1}</div>
                                <div className="text-sm text-muted-foreground">{property.city}, {property.postcode}</div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">{property.property_type}</TableCell>
                                <TableCell className="hidden lg:table-cell">
                                {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(property.rent_amount))}
                                </TableCell>
                                <TableCell>
                                <Badge variant={getStatusBadgeVariant(property.status)} className="capitalize">
                                    {property.status}
                                </Badge>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={4} className="text-center h-24">
                                No properties found.
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

    