'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, serverTimestamp } from 'firebase/firestore';
import { CalendarIcon, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';

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
import { Input } from '@relentify/ui';
import { Button } from '@relentify/ui';
import { useCollection, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@relentify/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@relentify/ui';
import { Calendar } from '@relentify/ui';
import { cn } from '@/lib/utils';
import { Checkbox } from '@relentify/ui';
import { ScrollArea } from '@relentify/ui';

const tenancyFormSchema = z.object({
  propertyId: z.string().min(1, 'Please select a property.'),
  tenantIds: z.array(z.string()).min(1, 'At least one tenant must be selected.'),
  landlordIds: z.array(z.string()).min(1, 'At least one landlord must be selected.'),
  startDate: z.date({ required_error: 'Start date is required.' }),
  endDate: z.date({ required_error: 'End date is required.' }),
  rentAmount: z.coerce.number().min(0, 'Rent must be a positive number.'),
  depositAmount: z.coerce.number().min(0, 'Deposit must be a positive number.'),
  status: z.enum(['Active', 'Ended', 'Arrears', 'Pending']),
  pipelineStatus: z.enum(['Application Received', 'Referencing', 'Awaiting Guarantor', 'Contract Signed', 'Awaiting Payment', 'Complete']),
});

type TenancyFormValues = z.infer<typeof tenancyFormSchema>;

export function AddTenancyDialog() {
  const [open, setOpen] = useState(false);
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;

  const form = useForm<TenancyFormValues>({
    resolver: zodResolver(tenancyFormSchema),
    defaultValues: {
      tenantIds: [],
      landlordIds: [],
      status: 'Pending',
      pipelineStatus: 'Application Received',
    },
  });

  // --- Data Fetching ---
  const propertiesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/properties`) : null, [firestore, organizationId]);
  const { data: properties, isLoading: loadingProperties } = useCollection<any>(propertiesQuery);

  const tenantsQuery = useMemoFirebase(() => (firestore && organizationId) ? query(collection(firestore, `organizations/${organizationId}/contacts`), where('contactType', '==', 'Tenant')) : null, [firestore, organizationId]);
  const { data: tenants, isLoading: loadingTenants } = useCollection<any>(tenantsQuery);
  
  // --- Dynamic Landlord Logic ---
  const propertyId = form.watch('propertyId');
  
  useEffect(() => {
    // When property changes, reset the landlord selection
    form.setValue('landlordIds', []);
  }, [propertyId, form]);

  const landlordIdsForSelectedProperty = useMemo(() => {
    if (!properties || !propertyId) return [];
    const selectedProperty = properties.find(p => p.id === propertyId);
    return selectedProperty?.landlordIds || [];
  }, [properties, propertyId]);
  
  const landlordsQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || landlordIdsForSelectedProperty.length === 0) return null;
    return query(
        collection(firestore, `organizations/${organizationId}/contacts`),
        where('__name__', 'in', landlordIdsForSelectedProperty)
    );
  }, [firestore, organizationId, landlordIdsForSelectedProperty]);
  const { data: landlords, isLoading: loadingLandlords } = useCollection<any>(landlordsQuery);
  

  const tenanciesCollectionRef = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/tenancies`) : null, [firestore, organizationId]);

  function onSubmit(data: TenancyFormValues) {
    if (!tenanciesCollectionRef || !organizationId || !auth.currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore not available.' });
      return;
    }

    const newTenancyData = {
      ...data,
      organizationId,
      createdByUserId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const property = properties?.find(p => p.id === data.propertyId);
    const entityName = property ? `Tenancy at ${property.addressLine1}` : `Tenancy for Property ID ${data.propertyId}`;
    addDocumentNonBlocking(firestore, auth, organizationId, tenanciesCollectionRef, newTenancyData, entityName);
    
    toast({ title: 'Tenancy Added', description: 'The new tenancy agreement has been created.' });
    form.reset();
    setOpen(false);
  }

  const isLoading = loadingProperties || loadingTenants || loadingLandlords || loadingCurrentUser;

  const MultiSelectField = ({ name, label, items, disabled = false, disabledText }: { name: "tenantIds" | "landlordIds"; label: string; items: any[] | undefined, disabled?: boolean, disabledText?: string }) => (
    <fieldset disabled={disabled} className="space-y-2">
        <FormItem>
        <FormLabel className={cn(disabled && "text-muted-foreground")}>{label}</FormLabel>
        {isLoading && !items ? <Skeleton className="h-24 w-full" /> : (
            <ScrollArea className="h-24 w-full rounded-md border p-2 bg-background peer-disabled:bg-muted/50 peer-disabled:cursor-not-allowed">
            {items?.map((item) => (
                <FormField
                    key={item.id}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                        <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0 py-1">
                            <FormControl>
                                <Checkbox
                                checked={field.value?.includes(item.id)}
                                onCheckedChange={(checked) => {
                                    return checked
                                    ? field.onChange([...(field.value || []), item.id])
                                    : field.onChange(field.value?.filter((value) => value !== item.id));
                                }}
                                />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">{item.firstName} {item.lastName}</FormLabel>
                        </FormItem>
                    )}
                />
            ))}
            {(!items || items.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                    {disabled ? disabledText : `No ${label.toLowerCase()} found.`}
                </p>
            )}
            </ScrollArea>
        )}
        <FormMessage />
        </FormItem>
    </fieldset>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1">
          <PlusCircle className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">New Tenancy</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Tenancy</DialogTitle>
          <DialogDescription>Link a property, tenants, and landlords to create a new agreement.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="propertyId" render={({ field }) => (
              <FormItem>{isLoading ? <Skeleton className="h-10 w-full" /> : (<>
                <FormLabel>Property</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger></FormControl>
                  <SelectContent>{properties?.map(prop => <SelectItem key={prop.id} value={prop.id}>{prop.addressLine1}, {prop.city}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </>)}</FormItem>
            )} />
            
            <div className="grid grid-cols-2 gap-4">
                <MultiSelectField name="tenantIds" label="Tenants" items={tenants} />
                <MultiSelectField name="landlordIds" label="Landlords" items={landlords} disabled={!propertyId} disabledText="Select a property to see landlords." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Start Date</FormLabel><Popover><PopoverTrigger asChild><FormControl>
                  <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>End Date</FormLabel><Popover><PopoverTrigger asChild><FormControl>
                  <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="rentAmount" render={({ field }) => (<FormItem><FormLabel>Monthly Rent (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="depositAmount" render={({ field }) => (<FormItem><FormLabel>Deposit (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Arrears">Arrears</SelectItem><SelectItem value="Ended">Ended</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="pipelineStatus" render={({ field }) => (<FormItem><FormLabel>Pipeline Stage</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{['Application Received', 'Referencing', 'Awaiting Guarantor', 'Contract Signed', 'Awaiting Payment', 'Complete'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            </div>
            
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isLoading || !organizationId}>Create Tenancy</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    