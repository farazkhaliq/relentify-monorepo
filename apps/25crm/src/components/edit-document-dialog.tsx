'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, doc, query } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
import { useCollection, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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
  fileName: string;
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
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile, isAdmin } = useUserProfile();
  const organizationId = userProfile?.organizationId;

  // --- Data Fetching ---
  const contactsQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/contacts`) : null, [firestore, organizationId]);
  const { data: contacts, isLoading: loadingContacts } = useCollection<any>(contactsQuery);

  const propertiesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/properties`) : null, [firestore, organizationId]);
  const { data: properties, isLoading: loadingProperties } = useCollection<any>(propertiesQuery);

  const tenanciesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/tenancies`) : null, [firestore, organizationId]);
  const { data: tenancies, isLoading: loadingTenancies } = useCollection<any>(tenanciesQuery);

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

  const documentDocRef = useMemoFirebase(() =>
    (firestore && organizationId && document) ? doc(firestore, `organizations/${organizationId}/documents`, document.id) : null
  , [firestore, organizationId, document]);

  function onSubmit(data: DocumentFormValues) {
    if (!documentDocRef || !auth || !organizationId || !document) return;

    const updateData = {
      ...data,
      tags: data.tags?.split(',').map(tag => tag.trim()).filter(Boolean) || [],
    };
    
    updateDocumentNonBlocking(firestore, auth, organizationId, documentDocRef, updateData, document.fileName);
    toast({ title: 'Document Updated', description: 'The document details have been saved.' });
    onOpenChange(false);
  }

  const handleDelete = () => {
    if (!documentDocRef || !auth || !organizationId || !document) return;
    deleteDocumentNonBlocking(firestore, auth, organizationId, documentDocRef, document.fileName);
    toast({ title: 'Document Deleted', description: 'The document has been permanently deleted.' });
    setDeleteDialogOpen(false);
    onOpenChange(false);
  };

  const handleSearch = (type: 'contacts' | 'properties' | 'tenancies', value: string) => {
    setSearchTerms(prev => ({ ...prev, [type]: value }));
  };

  const filteredContacts = useMemo(() => contacts?.filter(c => `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(searchTerms.contacts.toLowerCase())), [contacts, searchTerms.contacts]);
  const filteredProperties = useMemo(() => properties?.filter(p => `${p.addressLine1} ${p.city} ${p.postcode}`.toLowerCase().includes(searchTerms.properties.toLowerCase())), [properties, searchTerms.properties]);
  
  const propertyMap = useMemo(() => new Map(properties?.map(p => [p.id, `${p.addressLine1}, ${p.city}`]) || []), [properties]);
  const contactMap = useMemo(() => new Map(contacts?.map(c => [c.id, `${c.firstName} ${c.lastName}`]) || []), [contacts]);

  const enhancedTenancies = useMemo<FullTenancyInfo[]>(() => {
    if (!tenancies) return [];
    return tenancies.map(t => ({
      id: t.id,
      propertyName: propertyMap.get(t.propertyId) || 'Unknown Property',
      tenantNames: t.tenantIds.map((id: string) => contactMap.get(id) || '').join(', '),
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
            <DialogTitle className="truncate pr-8">Edit: {document.fileName}</DialogTitle>
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
                        <LinkingTab name="contactIds" items={filteredContacts} displayKey="lastName" subDisplayKey="email" />
                    </TabsContent>
                    <TabsContent value="properties">
                        <Input placeholder="Search properties..." value={searchTerms.properties} onChange={(e) => handleSearch('properties', e.target.value)} className="my-2" />
                        <LinkingTab name="propertyIds" items={filteredProperties} displayKey="addressLine1" subDisplayKey="postcode" />
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
