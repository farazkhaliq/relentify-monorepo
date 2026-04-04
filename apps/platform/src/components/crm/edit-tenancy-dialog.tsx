'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@relentify/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@relentify/ui';
import { Calendar } from '@relentify/ui';
import { cn } from '@/lib/utils';
import { Checkbox } from '@relentify/ui';
import { ScrollArea } from '@relentify/ui';
import { useApiCollection, apiUpdate, apiDelete } from '@/hooks/use-api';

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
  tenancy: { id: string } & Record<string, any>;
  isAdmin: boolean;
}

const getTimestampAsDate = (timestamp: any): Date | undefined => {
  if (!timestamp) return undefined;
  if (typeof timestamp === 'string' || timestamp instanceof Date) { return new Date(timestamp); }
  return undefined;
};

export function EditTenancyDialog({ tenancy, isAdmin }: EditTenancyDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<TenancyFormValues>({
    resolver: zodResolver(tenancyFormSchema),
  });

  // Fetch data for dropdowns via API
  const { data: properties, isLoading: loadingProperties } = useApiCollection<any>('/api/properties');
  const { data: allContacts, isLoading: loadingContacts } = useApiCollection<any>('/api/contacts');

  const tenants = useMemo(() => allContacts.filter((c: any) => c.contact_type === 'Tenant'), [allContacts]);
  const allLandlords = useMemo(() => allContacts.filter((c: any) => c.contact_type === 'Landlord'), [allContacts]);

  // --- Dynamic Landlord Logic ---
  const propertyId = form.watch('propertyId');

  useEffect(() => {
    if (tenancy) {
        form.reset({
            propertyId: tenancy.property_id || tenancy.propertyId,
            tenantIds: tenancy.tenant_ids || tenancy.tenantIds || [],
            landlordIds: tenancy.landlord_ids || tenancy.landlordIds || [],
            startDate: getTimestampAsDate(tenancy.start_date || tenancy.startDate),
            endDate: getTimestampAsDate(tenancy.end_date || tenancy.endDate),
            rentAmount: Number(tenancy.rent_amount || tenancy.rentAmount || 0),
            depositAmount: Number(tenancy.deposit_amount || tenancy.depositAmount || 0),
            status: tenancy.status,
            pipelineStatus: tenancy.pipeline_status || tenancy.pipelineStatus || 'Application Received',
            inventoryUrl: tenancy.inventory_url || tenancy.inventoryUrl || '',
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

  // For now show all landlords
  const landlords = allLandlords;

  async function onSubmit(data: TenancyFormValues) {
    try {
      await apiUpdate(`/api/tenancies/${tenancy.id}`, {
        property_id: data.propertyId,
        tenant_ids: data.tenantIds,
        start_date: data.startDate.toISOString(),
        end_date: data.endDate.toISOString(),
        rent_amount: data.rentAmount,
        deposit_amount: data.depositAmount,
        status: data.status,
        pipeline_status: data.pipelineStatus,
      });
      toast({ title: 'Tenancy Updated', description: 'The tenancy agreement has been successfully updated.' });
      setOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update tenancy.' });
    }
  }

  const handleDeleteTenancy = async () => {
    try {
      await apiDelete(`/api/tenancies/${tenancy.id}`);
      toast({ title: 'Tenancy Deleted', description: 'The tenancy has been deleted.' });
      setDeleteDialogOpen(false);
      setOpen(false);
      router.push('/tenancies');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete tenancy.' });
    }
  }

  const isLoading = loadingProperties || loadingContacts;

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
                            <FormLabel className="font-normal text-sm">{item.first_name} {item.last_name}</FormLabel>
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
                  <SelectContent>{properties?.map(prop => <SelectItem key={prop.id} value={prop.id}>{prop.address_line1}, {prop.city}</SelectItem>)}</SelectContent>
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
