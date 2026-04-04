'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Building, FileText, Search, User } from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@relentify/ui';
import { Button } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';

interface SearchResults {
  contacts: Array<{ id: string; first_name: string; last_name: string; email: string; contact_type: string }>;
  properties: Array<{ id: string; address_line1: string; city: string; postcode: string; status: string }>;
  tenancies: Array<{ id: string; property_address: string; status: string }>;
}

const emptyResults: SearchResults = { contacts: [], properties: [], tenancies: [] };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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

  const doSearch = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults(emptyResults);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        setResults(await res.json());
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }, [doSearch]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(emptyResults);
    }
  }, [open]);

  const runCommand = (command: () => unknown) => {
    setOpen(false);
    command();
  };

  const hasResults = results.contacts.length > 0 || results.properties.length > 0 || results.tenancies.length > 0;

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
          <span className="text-xs">&#x2318;</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type to search..." value={query} onValueChange={handleSearch} />
        <CommandList>
          {!isLoading && query.length >= 2 && !hasResults && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}

          {isLoading && (
            <div className="p-4 space-y-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}

          {!isLoading && results.contacts.length > 0 && (
            <CommandGroup heading="Contacts">
              {results.contacts.map((contact) => (
                <CommandItem
                  key={`contact-${contact.id}`}
                  value={`contact-${contact.first_name} ${contact.last_name} ${contact.email}`}
                  onSelect={() => runCommand(() => router.push(`/contacts/${contact.id}`))}
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>{contact.first_name} {contact.last_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!isLoading && results.properties.length > 0 && (
            <CommandGroup heading="Properties">
              {results.properties.map((property) => (
                <CommandItem
                  key={`property-${property.id}`}
                  value={`property-${property.address_line1} ${property.postcode}`}
                  onSelect={() => runCommand(() => router.push(`/properties/${property.id}`))}
                >
                  <Building className="mr-2 h-4 w-4" />
                  <span>{property.address_line1}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!isLoading && results.tenancies.length > 0 && (
            <CommandGroup heading="Tenancies">
              {results.tenancies.map((tenancy) => (
                <CommandItem
                  key={`tenancy-${tenancy.id}`}
                  value={`tenancy-${tenancy.property_address}`}
                  onSelect={() => runCommand(() => router.push(`/tenancies/${tenancy.id}`))}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Tenancy at {tenancy.property_address || 'Unknown'}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
