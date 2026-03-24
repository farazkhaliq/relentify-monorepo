'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { File, UploadCloud, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@relentify/ui';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@relentify/ui';
import { Input } from '@relentify/ui';
import { Button } from '@relentify/ui';
import { useAuth, useFirestore, useStorage, useMemoFirebase, useCollection } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@relentify/ui';
import { Textarea } from '@relentify/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@relentify/ui';
import { ScrollArea } from '@relentify/ui';
import { Checkbox } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Label } from '@relentify/ui';

const documentFormSchema = z.object({
  file: z.any()
    .refine((files) => files?.length == 1, "File is required.")
    .refine((files) => files?.[0]?.size <= 5000000, `Max file size is 5MB.`),
  description: z.string().optional(),
  tags: z.string().optional(),
  propertyIds: z.array(z.string()).optional(),
  tenancyIds: z.array(z.string()).optional(),
  contactIds: z.array(z.string()).optional(),
});

type DocumentFormValues = z.infer<typeof documentFormSchema>;

interface AddDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: {
    propertyIds?: string[];
    contactIds?: string[];
    tenancyIds?: string[];
  };
}

interface FullTenancyInfo {
  id: string;
  propertyName: string;
  tenantNames: string;
}

export function AddDocumentDialog({ open, onOpenChange, defaultValues }: AddDocumentDialogProps) {
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [searchTerms, setSearchTerms] = useState({ properties: '', tenancies: '', contacts: '' });
  const firestore = useFirestore();
  const storage = useStorage();
  const auth = useAuth();
  const { toast } = useToast();
  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;


  // --- Data Fetching ---
  const contactsQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/contacts`) : null, [firestore, organizationId]);
  const { data: contacts, isLoading: loadingContacts } = useCollection<any>(contactsQuery);

  const propertiesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/properties`) : null, [firestore, organizationId]);
  const { data: properties, isLoading: loadingProperties } = useCollection<any>(propertiesQuery);

  const tenanciesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/tenancies`) : null, [firestore, organizationId]);
  const { data: tenancies, isLoading: loadingTenancies } = useCollection<any>(tenanciesQuery);

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      description: '',
      tags: '',
      propertyIds: [],
      contactIds: [],
      tenancyIds: [],
    }
  });

  useEffect(() => {
    if (open) {
      form.reset({
        file: undefined,
        description: '',
        tags: '',
        propertyIds: defaultValues?.propertyIds || [],
        contactIds: defaultValues?.contactIds || [],
        tenancyIds: defaultValues?.tenancyIds || [],
      });
      setSearchTerms({ properties: '', tenancies: '', contacts: '' });
    }
  }, [open, defaultValues, form]);


  const fileRef = form.register("file");

  const documentsCollectionRef = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/documents`) : null
  , [firestore, organizationId]);

  function onSubmit(data: DocumentFormValues) {
    const file = data.file[0];
    if (!file || !documentsCollectionRef || !auth.currentUser || !organizationId) return;

    setUploadProgress(0);

    const storageRef = ref(storage, `organizations/${organizationId}/documents/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload failed:", error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
        setUploadProgress(null);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          const newDocData = {
            organizationId,
            fileName: file.name,
            filePath: downloadURL,
            mimeType: file.type,
            fileSize: file.size,
            uploadDate: serverTimestamp(),
            uploadedByUserId: auth.currentUser?.uid,
            description: data.description || '',
            tags: data.tags?.split(',').map(tag => tag.trim()).filter(Boolean) || [],
            propertyIds: data.propertyIds || [],
            tenancyIds: data.tenancyIds || [],
            contactIds: data.contactIds || [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          addDocumentNonBlocking(firestore, auth, organizationId, documentsCollectionRef, newDocData, file.name);
          
          toast({ title: 'Document Uploaded', description: `${file.name} has been successfully added.` });
          
          setUploadProgress(null);
          form.reset();
          onOpenChange(false);
        });
      }
    );
  }

  const selectedFile = form.watch('file')?.[0];

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

  
  const isLoading = loadingContacts || loadingProperties || loadingTenancies || loadingCurrentUser;
  
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        if (uploadProgress === null) {
            onOpenChange(isOpen);
            if (!isOpen) form.reset();
        }
    }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add New Document</DialogTitle>
          <DialogDescription>
            Upload a file and link it to relevant records in the system.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
            <div className="space-y-4">
                <FormField
                control={form.control}
                name="file"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>File</FormLabel>
                    <FormControl>
                        <div className="relative">
                        {!selectedFile && (
                            <div className="flex items-center justify-center w-full">
                            <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag</p>
                                    <p className="text-xs text-muted-foreground">MAX 5MB</p>
                                </div>
                                <Input id="dropzone-file" type="file" className="hidden" {...fileRef} />
                            </label>
                            </div>
                        )}
                        {selectedFile && (
                            <div className="flex items-center justify-between w-full h-24 border rounded-lg p-4 bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <File className="w-8 h-8 text-muted-foreground" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium truncate max-w-xs">{selectedFile.name}</span>
                                        <span className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => form.reset({...form.getValues(), file: undefined})} disabled={uploadProgress !== null}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        </div>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="A short description of the document..." {...field} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="tags" render={({ field }) => (<FormItem><FormLabel>Tags</FormLabel><FormControl><Input placeholder="e.g. lease, invoice, gas safety" {...field} /></FormControl><FormDescription>Comma-separated values.</FormDescription><FormMessage /></FormItem>)}/>
            </div>
            <div className="space-y-4">
                 <Label>Link to Entities (Optional)</Label>
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
                                  <FormLabel className="font-normal flex flex-col">
                                      <span>{tenancy.propertyName}</span>
                                      <span className="text-xs text-muted-foreground">{tenancy.tenantNames}</span>
                                  </FormLabel>
                                </FormItem>
                              )}/>
                            ))}
                          </ScrollArea></FormItem>
                        )}/>
                    </TabsContent>
                </Tabs>
            </div>
            
            <div className="md:col-span-2">
                {uploadProgress !== null && <Progress value={uploadProgress} className="w-full" />}
                <DialogFooter className="pt-4">
                <Button type="submit" disabled={uploadProgress !== null || isLoading}>
                    {uploadProgress !== null ? `Uploading... ${uploadProgress.toFixed(0)}%` : 'Save Document'}
                </Button>
                </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
