'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, serverTimestamp, doc, Timestamp } from 'firebase/firestore';
import { CalendarIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@relentify/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@relentify/ui';
import { Calendar } from '@relentify/ui';
import { cn } from '@/lib/utils';
import { Checkbox } from '@relentify/ui';
import { ScrollArea } from '@relentify/ui';
import { useUserProfile } from '@/hooks/use-user-profile';

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
  inventoryUrl: z.string().url().optional().or(z.literal('')),
});

type TenancyFormValues = z.infer<typeof tenancyFormSchema>;

interface EditTenancyDialogProps {
  tenancy: { id: string } & Partial<TenancyFormValues>;
  isAdmin: boolean;
}

const getTimestampAsDate = (timestamp: any): Date | undefined => {
  if (!timestamp) return undefined;
  if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
  if (typeof timestamp === 'string' || timestamp instanceof Date) { return new Date(timestamp); }
  return undefined;
};

export function EditTenancyDialog({ tenancy, isAdmin }: EditTenancyDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile } = useUserProfile();
  const organizationId = userProfile?.organizationId;

  const form = useForm<TenancyFormValues>({
    resolver: zodResolver(tenancyFormSchema),
  });

  // Fetch data for dropdowns
  const propertiesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/properties`) : null, [firestore, organizationId]);
  const { data: properties, isLoading: loadingProperties } = useCollection<any>(propertiesQuery);

  const tenantsQuery = useMemoFirebase(() => (firestore && organizationId) ? query(collection(firestore, `organizations/${organizationId}/contacts`), where('contactType', '==', 'Tenant')) : null, [firestore, organizationId]);
  const { data: tenants, isLoading: loadingTenants } = useCollection<any>(tenantsQuery);

  // --- Dynamic Landlord Logic ---
  const propertyId = form.watch('propertyId');

  useEffect(() => {
    if (tenancy) {
        form.reset({
            ...tenancy,
            startDate: getTimestampAsDate(tenancy.startDate),
            endDate: getTimestampAsDate(tenancy.endDate),
            inventoryUrl: tenancy.inventoryUrl || '',
        });
    }
  }, [tenancy, form, open]);
  
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
        if (name === 'propertyId') {
            form.setValue('landlordIds', []);
        }
    })
    return () => subscription.unsubscribe()
  }, [form]);

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


  const tenancyDocRef = useMemoFirebase(() => (firestore && organizationId) ? doc(firestore, `organizations/${organizationId}/tenancies`, tenancy.id) : null, [firestore, organizationId, tenancy.id]);

  function onSubmit(data: TenancyFormValues) {
    if (!tenancyDocRef || !organizationId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore not available.' });
      return;
    }

    const property = properties?.find(p => p.id === data.propertyId);
    const entityName = property ? `Tenancy at ${property.addressLine1}` : `Tenancy for Property ID ${data.propertyId}`;
    updateDocumentNonBlocking(firestore, auth, organizationId, tenancyDocRef, { ...data, updatedAt: serverTimestamp() }, entityName);
    
    toast({ title: 'Tenancy Updated', description: 'The tenancy agreement has been successfully updated.' });
    setOpen(false);
  }

  const handleDeleteTenancy = () => {
    if (!tenancyDocRef || !organizationId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete tenancy.' });
      return;
    }
    
    const property = properties?.find(p => p.id === tenancy.propertyId);
    const entityName = property ? `Tenancy at ${property.addressLine1}` : `Tenancy for Property ID ${tenancy.propertyId}`;
    deleteDocumentNonBlocking(firestore, auth, organizationId, tenancyDocRef, entityName);

    toast({ title: 'Tenancy Deleted', description: 'The tenancy has been deleted.' });

    setDeleteDialogOpen(false);
    setOpen(false);
    router.push('/tenancies');
  }

  const isLoading = loadingProperties || loadingTenants || loadingLandlords;

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
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Update</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Tenancy</DialogTitle>
          <DialogDescription>Update the details for this tenancy agreement.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="propertyId" render={({ field }) => (
              <FormItem>{isLoading ? <Skeleton className="h-10 w-full" /> : (<>
                <FormLabel>Property</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
            
            <FormField control={form.control} name="inventoryUrl" render={({ field }) => (<FormItem><FormLabel>Inventory URL</FormLabel><FormControl><Input placeholder="https://inventory.app/report/..." {...field} /></FormControl><FormMessage /></FormItem>)} />

            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Arrears">Arrears</SelectItem><SelectItem value="Ended">Ended</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="pipelineStatus" render={({ field }) => (<FormItem><FormLabel>Pipeline Stage</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{['Application Received', 'Referencing', 'Awaiting Guarantor', 'Contract Signed', 'Awaiting Payment', 'Complete'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            </div>
            
            <DialogFooter className="pt-4 flex items-center justify-between w-full">
               <div>
                {isAdmin && (
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setDeleteDialogOpen(true)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </Button>
                )}
               </div>
              <Button type="submit" disabled={isLoading || !organizationId}>Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this tenancy agreement.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={handleDeleteTenancy}
            >
                Delete
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
