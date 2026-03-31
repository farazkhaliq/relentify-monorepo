'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Trash2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@relentify/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@relentify/ui';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@relentify/ui';
import { Input } from '@relentify/ui';
import { Button } from '@relentify/ui';
import { useApiCollection, apiUpdate, apiDelete } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@relentify/ui';
import { ScrollArea } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@relentify/ui';
import { Textarea } from '@relentify/ui';
import { useUserProfile } from '@/hooks/use-user-profile';

const documentFormSchema = z.object({
  description: z.string().optional(),
  tags: z.string().optional(),
  propertyIds: z.array(z.string()).optional(),
  tenancyIds: z.array(z.string()).optional(),
  contactIds: z.array(z.string()).optional(),
});

type DocumentFormValues = z.infer<typeof documentFormSchema>;

interface Document {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  propertyIds?: string[];
  tenancyIds?: string[];
  contactIds?: string[];
}

interface EditDocumentDialogProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FullTenancyInfo {
  id: string;
  propertyName: string;
  tenantNames: string;
}

export function EditDocumentDialog({ document, open, onOpenChange }: EditDocumentDialogProps) {
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [searchTerms, setSearchTerms] = useState({ contacts: '', properties: '', tenancies: '' });
  const { toast } = useToast();
  const { isAdmin } = useUserProfile();

  // --- Data Fetching ---
  const { data: contacts, isLoading: loadingContacts } = useApiCollection('/api/contacts');
  const { data: properties, isLoading: loadingProperties } = useApiCollection('/api/properties');
  const { data: tenancies, isLoading: loadingTenancies } = useApiCollection('/api/tenancies');

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
  });

  useEffect(() => {
    if (document) {
      form.reset({
        description: document.description || '',
        tags: document.tags?.join(', ') || '',
        propertyIds: document.propertyIds || [],
        contactIds: document.contactIds || [],
        tenancyIds: document.tenancyIds || [],
      });
      setSearchTerms({ properties: '', tenancies: '', contacts: '' });
    }
  }, [document, form]);

  async function onSubmit(data: DocumentFormValues) {
    if (!document) return;

    try {
      const updateData = {
        description: data.description || '',
        tags: data.tags?.split(',').map((tag: string) => tag.trim()).filter(Boolean) || [],
      };

      await apiUpdate(`/api/documents/${document.id}`, updateData);
      toast({ title: 'Document Updated', description: 'The document details have been saved.' });
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    }
  }

  const handleDelete = async () => {
    if (!document) return;

    try {
      await apiDelete(`/api/documents/${document.id}`);
      toast({ title: 'Document Deleted', description: 'The document has been permanently deleted.' });
      setDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
    }
  };

  const handleSearch = (type: 'contacts' | 'properties' | 'tenancies', value: string) => {
    setSearchTerms(prev => ({ ...prev, [type]: value }));
  };

  const filteredContacts = useMemo(() => contacts?.filter((c: any) => `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(searchTerms.contacts.toLowerCase())), [contacts, searchTerms.contacts]);
  const filteredProperties = useMemo(() => properties?.filter((p: any) => `${p.address_line1 || p.address || ''} ${p.city || ''} ${p.postcode || ''}`.toLowerCase().includes(searchTerms.properties.toLowerCase())), [properties, searchTerms.properties]);

  const propertyMap = useMemo(() => new Map(properties?.map((p: any) => [p.id, `${p.address_line1 || p.address || ''}, ${p.city || ''}`]) || []), [properties]);
  const contactMap = useMemo(() => new Map(contacts?.map((c: any) => [c.id, `${c.first_name} ${c.last_name}`]) || []), [contacts]);

  const enhancedTenancies = useMemo<FullTenancyInfo[]>(() => {
    if (!tenancies) return [];
    return tenancies.map((t: any) => ({
      id: t.id,
      propertyName: propertyMap.get(t.property_id) || 'Unknown Property',
      tenantNames: (t.tenant_ids || []).map((id: string) => contactMap.get(id) || '').join(', '),
    }));
  }, [tenancies, propertyMap, contactMap]);

  const filteredTenancies = useMemo(() => enhancedTenancies.filter(t =>
    `${t.propertyName} ${t.tenantNames}`.toLowerCase().includes(searchTerms.tenancies.toLowerCase())
  ), [enhancedTenancies, searchTerms.tenancies]);

  const isLoading = loadingContacts || loadingProperties || loadingTenancies;

  const LinkingTab = ({ name, items, displayKey, subDisplayKey }: { name: "propertyIds" | "contactIds", items: any[] | undefined, displayKey: string, subDisplayKey?: string}) => (
    <FormField control={form.control} name={name} render={() => (
      <FormItem><ScrollArea className="h-48 w-full rounded-md border p-2">
        {isLoading ? <Skeleton className="h-full w-full" /> : items?.map((item) => (
          <FormField key={item.id} control={form.control} name={name} render={({ field }) => (
            <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0 py-2">
              <FormControl><Checkbox checked={field.value?.includes(item.id)} onCheckedChange={(checked) => (checked ? field.onChange([...(field.value || []), item.id]) : field.onChange(field.value?.filter((value) => value !== item.id)))}/></FormControl>
              <FormLabel className="font-normal flex flex-col"><span>{item[displayKey]}</span>{subDisplayKey && <span className="text-xs text-muted-foreground">{item[subDisplayKey]}</span>}</FormLabel>
            </FormItem>
          )}/>
        ))}
      </ScrollArea></FormItem>
    )}/>
  );

  if (!document) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">Edit: {document.name}</DialogTitle>
            <DialogDescription>Update the document's metadata and links.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
              <div className="space-y-4">
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="A short description of the document..." {...field} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="tags" render={({ field }) => (<FormItem><FormLabel>Tags</FormLabel><FormControl><Input placeholder="e.g. lease, invoice, gas safety" {...field} /></FormControl><FormMessage /></FormItem>)}/>
              </div>
              <div className="space-y-4">
                 <FormLabel>Link to Entities</FormLabel>
                 <Tabs defaultValue="contacts">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="contacts">Contacts</TabsTrigger>
                        <TabsTrigger value="properties">Properties</TabsTrigger>
                        <TabsTrigger value="tenancies">Tenancies</TabsTrigger>
                    </TabsList>
                    <TabsContent value="contacts">
                        <Input placeholder="Search contacts..." value={searchTerms.contacts} onChange={(e) => handleSearch('contacts', e.target.value)} className="my-2" />
                        <LinkingTab name="contactIds" items={filteredContacts} displayKey="last_name" subDisplayKey="email" />
                    </TabsContent>
                    <TabsContent value="properties">
                        <Input placeholder="Search properties..." value={searchTerms.properties} onChange={(e) => handleSearch('properties', e.target.value)} className="my-2" />
                        <LinkingTab name="propertyIds" items={filteredProperties} displayKey="address_line1" subDisplayKey="postcode" />
                    </TabsContent>
                    <TabsContent value="tenancies">
                        <Input placeholder="Search by address or tenant..." value={searchTerms.tenancies} onChange={(e) => handleSearch('tenancies', e.target.value)} className="my-2" />
                        <FormField control={form.control} name="tenancyIds" render={() => (
                          <FormItem><ScrollArea className="h-48 w-full rounded-md border p-4">
                            {isLoading ? <Skeleton className="h-full w-full" /> : filteredTenancies.map((tenancy) => (
                              <FormField key={tenancy.id} control={form.control} name="tenancyIds" render={({ field }) => (
                                <FormItem key={tenancy.id} className="flex flex-row items-start space-x-3 space-y-0 py-2">
                                  <FormControl><Checkbox checked={field.value?.includes(tenancy.id)} onCheckedChange={(checked) => (checked ? field.onChange([...(field.value || []), tenancy.id]) : field.onChange(field.value?.filter((value) => value !== tenancy.id)))}/></FormControl>
                                  <FormLabel className="font-normal flex flex-col"><span>{tenancy.propertyName}</span><span className="text-xs text-muted-foreground">{tenancy.tenantNames}</span></FormLabel>
                                </FormItem>
                              )}/>
                            ))}
                          </ScrollArea></FormItem>
                        )}/>
                    </TabsContent>
                </Tabs>
            </div>
              <DialogFooter className="pt-4 md:col-span-2 flex items-center justify-between w-full">
                <div>
                  {isAdmin && (
                    <Button type="button" variant="destructive" onClick={() => setDeleteDialogOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                  )}
                </div>
                <Button type="submit" disabled={isLoading}>Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete this document.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
