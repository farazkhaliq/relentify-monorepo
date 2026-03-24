'use client';

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, serverTimestamp } from 'firebase/firestore';
import { PlusCircle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@relentify/ui';
import { Button } from '@relentify/ui';
import { Textarea } from '@relentify/ui';
import { useCollection, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@relentify/ui';
import { Switch } from '@relentify/ui';

const maintenanceRequestFormSchema = z.object({
  propertyId: z.string().min(1, 'Please select a property'),
  reporterContactId: z.string().min(1, 'Please select a contact'),
  tenancyId: z.string().optional(),
  issueLocation: z.enum(["Kitchen", "Bathroom", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Living Room", "Dining Room", "Garden", "Exterior", "Communal Area", "Other"]),
  issueType: z.enum(["Plumbing", "Electrical", "Heating", "Appliance", "Structural", "General", "Other"]),
  permissionToEnter: z.boolean().default(false),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
});

type MaintenanceRequestFormValues = z.infer<typeof maintenanceRequestFormSchema>;

export function AddMaintenanceRequestDialog() {
  const [open, setOpen] = useState(false);
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;

  const form = useForm<MaintenanceRequestFormValues>({
    resolver: zodResolver(maintenanceRequestFormSchema),
    defaultValues: {
      description: '',
      priority: 'Medium',
      permissionToEnter: false,
    },
  });
  
  const propertyId = form.watch('propertyId');

  // Fetch properties for the dropdown
  const propertiesQuery = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/properties`) : null,
    [firestore, organizationId]
  );
  const { data: properties, isLoading: loadingProperties } = useCollection<any>(propertiesQuery);
  
  // Fetch contacts for the dropdown
  const contactsQuery = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/contacts`) : null,
    [firestore, organizationId]
  );
  const { data: contacts, isLoading: loadingContacts } = useCollection<any>(contactsQuery);

  // Fetch active tenancies for the selected property
  const tenanciesQuery = useMemoFirebase(() =>
    (firestore && organizationId && propertyId)
      ? query(
          collection(firestore, `organizations/${organizationId}/tenancies`),
          where('propertyId', '==', propertyId),
          where('status', '==', 'Active')
        )
      : null,
    [firestore, organizationId, propertyId]
  );
  const { data: activeTenancies, isLoading: loadingTenancies } = useCollection<any>(tenanciesQuery);

  const contactNameMap = React.useMemo(() => new Map(contacts?.map(c => [c.id, `${c.firstName} ${c.lastName}`]) || []), [contacts]);

  const getTenantNames = (tenantIds: string[]) => {
    if (!tenantIds || !contactNameMap) return 'Loading tenants...';
    return tenantIds.map(id => contactNameMap.get(id) || 'Unknown').join(', ');
  }

  const maintenanceCollectionRef = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/maintenanceRequests`) : null
  , [firestore, organizationId]);

  function onSubmit(data: MaintenanceRequestFormValues) {
    if (!maintenanceCollectionRef || !organizationId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore not available. Could not add request.',
      });
      return;
    }

    const newRequestData = {
      ...data,
      organizationId,
      status: 'New', // Default status for new requests
      reportedDate: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    const entityName = data.description;
    addDocumentNonBlocking(firestore, auth, organizationId, maintenanceCollectionRef, newRequestData, entityName);
    
    toast({
      title: 'Request Added',
      description: `A new maintenance request has been successfully created.`,
    });

    form.reset();
    setOpen(false);
  }

  const isLoading = loadingProperties || loadingContacts || loadingCurrentUser;
  const isTenancyLoading = loadingTenancies || loadingContacts;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1">
          <PlusCircle className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            New Request
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New Maintenance Request</DialogTitle>
          <DialogDescription>
            Fill in the details for the new maintenance request below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="propertyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property</FormLabel>
                  {isLoading ? <Skeleton className="h-10 w-full" /> : (
                    <Select onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('tenancyId', undefined); // Reset tenancy when property changes
                    }} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {properties?.map(prop => (
                          <SelectItem key={prop.id} value={prop.id}>{prop.addressLine1}, {prop.city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="tenancyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tenancy (Optional)</FormLabel>
                  {isTenancyLoading && propertyId ? <Skeleton className="h-10 w-full" /> : (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!propertyId || !activeTenancies || activeTenancies.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an active tenancy" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeTenancies?.map(tenancy => (
                          <SelectItem key={tenancy.id} value={tenancy.id}>
                            {getTenantNames(tenancy.tenantIds)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormDescription>
                    Link this request to an active tenancy at the selected property.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reporterContactId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reporting Contact</FormLabel>
                  {isLoading ? <Skeleton className="h-10 w-full" /> : (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a contact" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contacts?.map(contact => (
                          <SelectItem key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="issueLocation"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Issue Location</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {["Kitchen", "Bathroom", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Living Room", "Dining Room", "Garden", "Exterior", "Communal Area", "Other"].map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="issueType"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Issue Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {["Plumbing", "Electrical", "Heating", "Appliance", "Structural", "General", "Other"].map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description of Issue</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., The kitchen sink is leaking under the cabinet." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
                control={form.control}
                name="permissionToEnter"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <FormLabel>Permission to Enter</FormLabel>
                            <FormMessage />
                        </div>
                        <FormControl>
                            <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>Save Request</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
