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
import { useUserProfile } from '@/hooks/use-user-profile';
import { useApiCollection, apiUpdate, apiDelete } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@relentify/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@relentify/ui';
import { Calendar } from '@relentify/ui';
import { cn } from '@/lib/utils';
import { Switch } from '@relentify/ui';
import { Textarea } from '@relentify/ui';

const transactionFormSchema = z.object({
  transactionType: z.enum(['Rent Payment', 'Management Fee', 'Commission', 'Landlord Payout', 'Contractor Payment', 'Agency Expense', 'Deposit']),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  transactionDate: z.date({ required_error: 'A transaction date is required.' }),
  description: z.string().min(1, 'A description is required.'),
  payerContactId: z.string().optional(),
  payeeContactId: z.string().optional(),
  relatedPropertyId: z.string().optional(),
  relatedTenancyId: z.string().optional(),
  reconciled: z.boolean().default(false),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

interface EditTransactionDialogProps {
  transaction: { id: string, description?: string } & Partial<TransactionFormValues>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}

const getDateValue = (val: any): Date | undefined => {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  if (typeof val === 'string') return new Date(val);
  return undefined;
};

export function EditTransactionDialog({ transaction, open, onOpenChange, isAdmin }: EditTransactionDialogProps) {
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
  });

  useEffect(() => {
    if (transaction) {
      form.reset({
        ...transaction,
        transactionDate: getDateValue(transaction.transactionDate),
        payerContactId: transaction.payerContactId || '',
        payeeContactId: transaction.payeeContactId || '',
        relatedPropertyId: transaction.relatedPropertyId || '',
        relatedTenancyId: transaction.relatedTenancyId || '',
      });
    }
  }, [transaction, form]);

  // Fetch contacts and properties for dropdowns
  const { data: contacts, isLoading: loadingContacts } = useApiCollection<any>('/api/contacts');
  const { data: properties, isLoading: loadingProperties } = useApiCollection<any>('/api/properties');
  const { data: tenancies, isLoading: loadingTenancies } = useApiCollection<any>('/api/tenancies');

  const contactMap = useMemo(() => new Map(contacts?.map((c: any) => [c.id, `${c.first_name} ${c.last_name}`]) || []), [contacts]);
  const propertyMap = useMemo(() => new Map(properties?.map((p: any) => [p.id, p.address_line1]) || []), [properties]);

  async function onSubmit(data: TransactionFormValues) {
    if (!organizationId) return;

    try {
      await apiUpdate(`/api/transactions/${transaction.id}`, {
        type: data.transactionType,
        amount: data.amount,
        transaction_date: data.transactionDate.toISOString(),
        description: data.description,
        payer_contact_id: data.payerContactId || null,
        payee_contact_id: data.payeeContactId || null,
        related_property_id: data.relatedPropertyId || null,
        tenancy_id: data.relatedTenancyId || null,
        reconciled: data.reconciled,
      });

      toast({ title: 'Transaction Updated', description: 'The transaction has been successfully updated.' });
      onOpenChange(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update transaction.' });
    }
  }

  const handleDelete = async () => {
    try {
      await apiDelete(`/api/transactions/${transaction.id}`);
      toast({ title: 'Transaction Deleted', description: 'The transaction has been deleted.' });
      setDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete transaction.' });
    }
  };

  const isLoading = loadingContacts || loadingProperties || loadingCurrentUser || loadingTenancies;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Update the details for the transaction below.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
               <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="transactionType" render={({ field }) => (
                  <FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{['Rent Payment', 'Management Fee', 'Commission', 'Landlord Payout', 'Contractor Payment', 'Agency Expense', 'Deposit'].map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem><FormLabel>Amount ({'\u00A3'})</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
              </div>
              <FormField control={form.control} name="transactionDate" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Transaction Date</FormLabel><Popover><PopoverTrigger asChild><FormControl>
                  <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="payerContactId" render={({ field }) => (
                  <FormItem><FormLabel>From / Payer</FormLabel>{isLoading ? <Skeleton className="h-10 w-full" /> : (<Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a contact" /></SelectTrigger></FormControl><SelectContent>{contacts?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent></Select>)}<FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="payeeContactId" render={({ field }) => (
                  <FormItem><FormLabel>To / Payee</FormLabel>{isLoading ? <Skeleton className="h-10 w-full" /> : (<Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a contact" /></SelectTrigger></FormControl><SelectContent>{contacts?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent></Select>)}<FormMessage /></FormItem>
                )}/>
              </div>
              <FormField control={form.control} name="relatedPropertyId" render={({ field }) => (
                <FormItem><FormLabel>Related Property (Optional)</FormLabel>{isLoading ? <Skeleton className="h-10 w-full" /> : (<Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger></FormControl><SelectContent>{properties?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.address_line1}</SelectItem>)}</SelectContent></Select>)}<FormMessage /></FormItem>
              )}/>
              <FormField
                control={form.control}
                name="relatedTenancyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Tenancy (Optional)</FormLabel>
                    {isLoading ? <Skeleton className="h-10 w-full" /> : (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select a tenancy" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tenancies?.map((t: any) => {
                            const propertyName = propertyMap.get(t.property_id) || 'Unknown Property';
                            const tenantNames = (t.tenant_names || []).join(', ') || 'No tenants';
                            return (
                              <SelectItem key={t.id} value={t.id}>{propertyName} - {tenantNames}</SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
            />
              <FormField control={form.control} name="reconciled" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Reconciled</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
              )}/>
              <DialogFooter className="pt-4 flex items-center justify-between w-full">
                <div>
                    {isAdmin && (
                        <Button type="button" variant="destructive" onClick={() => setDeleteDialogOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
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
            <AlertDialogDescription>This action cannot be undone. This will permanently delete this transaction.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
