'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link as LinkIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@relentify/ui';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@relentify/ui';
import { Input } from '@relentify/ui';
import { Button } from '@relentify/ui';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@relentify/ui';
import { ScrollArea } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@relentify/ui';
import { RadioGroup, RadioGroupItem } from '@relentify/ui';
import { useApiCollection, apiUpdate } from '@/hooks/use-api';

interface LinkEntityDialogProps {
  communication: {
    id: string;
    subject?: string;
    relatedContactIds?: string[];
    relatedPropertyId?: string;
    relatedTenancyId?: string;
  }
}

const linkEntityFormSchema = z.object({
  contactIds: z.array(z.string()).optional(),
  propertyId: z.string().optional(),
  tenancyId: z.string().optional(),
});

type LinkEntityFormValues = z.infer<typeof linkEntityFormSchema>;

export function LinkEntityDialog({ communication }: LinkEntityDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchTerms, setSearchTerms] = useState({ contacts: '', properties: '', tenancies: '' });
  const { toast } = useToast();

  // Fetch all entities for linking via API
  const { data: contacts, isLoading: loadingContacts } = useApiCollection<any>('/api/contacts');
  const { data: properties, isLoading: loadingProperties } = useApiCollection<any>('/api/properties');
  const { data: tenancies, isLoading: loadingTenancies } = useApiCollection<any>('/api/tenancies');
  const { data: tenants, isLoading: loadingTenants } = useApiCollection<any>('/api/contacts?type=Tenant');

  const form = useForm<LinkEntityFormValues>({
    resolver: zodResolver(linkEntityFormSchema),
    defaultValues: {
      contactIds: communication.relatedContactIds || [],
      propertyId: communication.relatedPropertyId || '',
      tenancyId: communication.relatedTenancyId || '',
    },
  });

  useEffect(() => {
    form.reset({
      contactIds: communication.relatedContactIds || [],
      propertyId: communication.relatedPropertyId || '',
      tenancyId: communication.relatedTenancyId || '',
    });
  }, [communication, form, open]);

  async function onSubmit(data: LinkEntityFormValues) {
    try {
      await apiUpdate(`/api/communications/${communication.id}`, {
        related_contact_ids: data.contactIds || [],
        related_property_id: data.propertyId || '',
        related_tenancy_id: data.tenancyId || '',
      });

      toast({ title: 'Entities Linked', description: 'Successfully updated linked entities.' });
      setOpen(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not link entities.' });
    }
  }

  const handleSearch = (type: 'contacts' | 'properties' | 'tenancies', value: string) => {
    setSearchTerms(prev => ({ ...prev, [type]: value }));
  };

  const filteredContacts = useMemo(() => contacts?.filter((c: any) => `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(searchTerms.contacts.toLowerCase())), [contacts, searchTerms.contacts]);
  const filteredProperties = useMemo(() => properties?.filter((p: any) => `${p.address_line1} ${p.city} ${p.postcode}`.toLowerCase().includes(searchTerms.properties.toLowerCase())), [properties, searchTerms.properties]);
  const filteredTenancies = useMemo(() => tenancies?.filter((t: any) => {
    const propAddress = properties?.find((p: any) => p.id === t.property_id)?.address_line1 || '';
    return propAddress.toLowerCase().includes(searchTerms.tenancies.toLowerCase());
  }), [tenancies, properties, searchTerms.tenancies]);

  const isLoading = loadingContacts || loadingProperties || loadingTenancies || loadingTenants;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><LinkIcon className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link Entities</DialogTitle>
          <DialogDescription>
            Associate contacts, properties, or tenancies with this communication.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="contacts">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="contacts">Contacts</TabsTrigger>
                <TabsTrigger value="properties">Properties</TabsTrigger>
                <TabsTrigger value="tenancies">Tenancies</TabsTrigger>
              </TabsList>
              <TabsContent value="contacts">
                <Input placeholder="Search contacts..." value={searchTerms.contacts} onChange={(e) => handleSearch('contacts', e.target.value)} className="my-2" />
                <FormField control={form.control} name="contactIds" render={() => (
                  <FormItem><ScrollArea className="h-48 w-full rounded-md border p-4">
                    {isLoading ? <Skeleton className="h-full w-full" /> : filteredContacts?.map((contact: any) => (
                      <FormField key={contact.id} control={form.control} name="contactIds" render={({ field }) => (
                        <FormItem key={contact.id} className="flex flex-row items-start space-x-3 space-y-0 py-2">
                          <FormControl><Checkbox checked={field.value?.includes(contact.id)} onCheckedChange={(checked) => (checked ? field.onChange([...(field.value || []), contact.id]) : field.onChange(field.value?.filter((value: string) => value !== contact.id)))}/></FormControl>
                          <FormLabel className="font-normal flex flex-col"><span>{contact.first_name} {contact.last_name}</span><span className="text-xs text-muted-foreground">{contact.email}</span></FormLabel>
                        </FormItem>
                      )}/>
                    ))}
                  </ScrollArea></FormItem>
                )}/>
              </TabsContent>
              <TabsContent value="properties">
                <Input placeholder="Search properties..." value={searchTerms.properties} onChange={(e) => handleSearch('properties', e.target.value)} className="my-2" />
                <FormField control={form.control} name="propertyId" render={({ field }) => (
                  <FormItem><ScrollArea className="h-48 w-full rounded-md border p-4"><RadioGroup onValueChange={field.onChange} defaultValue={field.value}>
                    {isLoading ? <Skeleton className="h-full w-full" /> : filteredProperties?.map((prop: any) => (
                      <FormItem key={prop.id} className="flex items-center space-x-3 space-y-0 py-2">
                        <FormControl><RadioGroupItem value={prop.id} /></FormControl>
                        <FormLabel className="font-normal">{prop.address_line1}, {prop.city}</FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup></ScrollArea></FormItem>
                )}/>
              </TabsContent>
              <TabsContent value="tenancies">
                <Input placeholder="Search tenancies by address..." value={searchTerms.tenancies} onChange={(e) => handleSearch('tenancies', e.target.value)} className="my-2" />
                <FormField control={form.control} name="tenancyId" render={({ field }) => (
                  <FormItem><ScrollArea className="h-48 w-full rounded-md border p-4"><RadioGroup onValueChange={field.onChange} defaultValue={field.value}>
                    {isLoading ? <Skeleton className="h-full w-full" /> : filteredTenancies?.map((tenancy: any) => (
                      <FormItem key={tenancy.id} className="flex items-center space-x-3 space-y-0 py-2">
                        <FormControl><RadioGroupItem value={tenancy.id} /></FormControl>
                        <FormLabel className="font-normal flex flex-col">
                          <span>{properties?.find((p: any) => p.id === tenancy.property_id)?.address_line1}</span>
                          <span className="text-xs text-muted-foreground">{tenants?.filter((t: any) => tenancy.tenant_ids?.includes(t.id)).map((t: any) => `${t.first_name} ${t.last_name}`).join(', ')}</span>
                        </FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup></ScrollArea></FormItem>
                )}/>
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>Save Links</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
