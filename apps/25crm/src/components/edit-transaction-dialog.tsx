'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, serverTimestamp, doc, Timestamp } from 'firebase/firestore';
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
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUserProfile, useAuth } from '@/firebase';
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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

const getTimestampAsDate = (timestamp: any): Date | undefined => {
  if (!timestamp) return undefined;
  if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
  if (typeof timestamp === 'string' || timestamp instanceof Date) { return new Date(timestamp); }
  return undefined;
};

export function EditTransactionDialog({ transaction, open, onOpenChange, isAdmin }: EditTransactionDialogProps) {
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const firestore = useFirestore();
  const auth = useAuth();
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
        transactionDate: getTimestampAsDate(transaction.transactionDate),
        payerContactId: transaction.payerContactId || '',
        payeeContactId: transaction.payeeContactId || '',
        relatedPropertyId: transaction.relatedPropertyId || '',
        relatedTenancyId: transaction.relatedTenancyId || '',
      });
    }
  }, [transaction, form]);

  // Fetch contacts and properties for dropdowns
  const contactsQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/contacts`) : null, [firestore, organizationId]);
  const { data: contacts, isLoading: loadingContacts } = useCollection<any>(contactsQuery);

  const propertiesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/properties`) : null, [firestore, organizationId]);
  const { data: properties, isLoading: loadingProperties } = useCollection<any>(propertiesQuery);
  
  const tenanciesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/tenancies`) : null, [firestore, organizationId]);
  const { data: tenancies, isLoading: loadingTenancies } = useCollection<any>(tenanciesQuery);

  const contactMap = useMemo(() => new Map(contacts?.map(c => [c.id, `${c.firstName} ${c.lastName}`]) || []), [contacts]);
  const propertyMap = useMemo(() => new Map(properties?.map(p => [p.id, p.addressLine1]) || []), [properties]);

  const transactionDocRef = useMemoFirebase(() => (firestore && organizationId) ? doc(firestore, `organizations/${organizationId}/transactions`, transaction.id) : null, [firestore, organizationId, transaction.id]);

  function onSubmit(data: TransactionFormValues) {
    if (!transactionDocRef || !auth || !organizationId) return;

    const updatedData = { ...data, updatedAt: serverTimestamp() };
    updateDocumentNonBlocking(firestore, auth, organizationId, transactionDocRef, updatedData, data.description);
    
    toast({ title: 'Transaction Updated', description: 'The transaction has been successfully updated.' });
    onOpenChange(false);
  }

  const handleDelete = () => {
    if (!transactionDocRef || !auth || !organizationId) return;
    
    deleteDocumentNonBlocking(firestore, auth, organizationId, transactionDocRef, transaction.description);

    toast({ title: 'Transaction Deleted', description: 'The transaction has been deleted.' });
    
    setDeleteDialogOpen(false);
    onOpenChange(false);
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
                  <FormItem><FormLabel>Amount (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
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
                  <FormItem><FormLabel>From / Payer</FormLabel>{isLoading ? <Skeleton className="h-10 w-full" /> : (<Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a contact" /></SelectTrigger></FormControl><SelectContent>{contacts?.map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent></Select>)}<FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="payeeContactId" render={({ field }) => (
                  <FormItem><FormLabel>To / Payee</FormLabel>{isLoading ? <Skeleton className="h-10 w-full" /> : (<Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a contact" /></SelectTrigger></FormControl><SelectContent>{contacts?.map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent></Select>)}<FormMessage /></FormItem>
                )}/>
              </div>
              <FormField control={form.control} name="relatedPropertyId" render={({ field }) => (
                <FormItem><FormLabel>Related Property (Optional)</FormLabel>{isLoading ? <Skeleton className="h-10 w-full" /> : (<Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger></FormControl><SelectContent>{properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.addressLine1}</SelectItem>)}</SelectContent></Select>)}<FormMessage /></FormItem>
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
                          {tenancies?.map(t => {
                            const propertyName = propertyMap.get(t.propertyId) || 'Unknown Property';
                            const tenantNames = t.tenantIds.map((id:string) => contactMap.get(id) || 'Unknown').join(', ');
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
