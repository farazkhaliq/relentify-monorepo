'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection } from 'firebase/firestore';
import { Building, FileText, Search, User } from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@relentify/ui';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Button } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const firestore = useFirestore();
  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;

  // --- Data Fetching ---
  const contactsQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/contacts`) : null, [firestore, organizationId]);
  const { data: contacts, isLoading: loadingContacts } = useCollection<any>(contactsQuery);

  const propertiesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/properties`) : null, [firestore, organizationId]);
  const { data: properties, isLoading: loadingProperties } = useCollection<any>(propertiesQuery);
  
  const tenanciesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/tenancies`) : null, [firestore, organizationId]);
  const { data: tenancies, isLoading: loadingTenancies } = useCollection<any>(tenanciesQuery);


  const isLoading = loadingContacts || loadingProperties || loadingTenancies || loadingCurrentUser;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);
  
  const runCommand = (command: () => unknown) => {
    setOpen(false);
    command();
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start rounded-[0.5rem] text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 mr-2" />
        <span className="hidden lg:inline-flex">Search...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          {isLoading && (
              <div className="p-4 space-y-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
              </div>
          )}
          
          {!isLoading && (
            <>
              <CommandGroup heading="Contacts">
                {contacts?.map((contact) => (
                  <CommandItem
                    key={`contact-${contact.id}`}
                    value={`contact-${contact.firstName} ${contact.lastName} ${contact.email}`}
                    onSelect={() => runCommand(() => router.push(`/contacts/${contact.id}`))}
                  >
                    <User className="mr-2 h-4 w-4" />
                    <span>{contact.firstName} {contact.lastName}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Properties">
                {properties?.map((property) => (
                  <CommandItem
                    key={`property-${property.id}`}
                    value={`property-${property.addressLine1} ${property.postcode}`}
                    onSelect={() => runCommand(() => router.push(`/properties/${property.id}`))}
                  >
                    <Building className="mr-2 h-4 w-4" />
                    <span>{property.addressLine1}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Tenancies">
                 {tenancies?.map((tenancy) => {
                    const property = properties?.find(p => p.id === tenancy.propertyId);
                    return (
                        <CommandItem
                            key={`tenancy-${tenancy.id}`}
                            value={`tenancy-${property?.addressLine1}`}
                            onSelect={() => runCommand(() => router.push(`/tenancies/${tenancy.id}`))}
                        >
                            <FileText className="mr-2 h-4 w-4" />
                            <span>Tenancy at {property?.addressLine1 || tenancy.propertyId}</span>
                        </CommandItem>
                    )
                 })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
