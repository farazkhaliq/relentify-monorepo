'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle, Info } from 'lucide-react';

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
import { Alert, AlertDescription } from '@relentify/ui';
import { useApiCollection, apiCreate } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@relentify/ui';

const bankAccountFormSchema = z.object({
  contactId: z.string().min(1, 'Please select a landlord.'),
  bankName: z.string().min(1, 'Bank name is required.'),
  accountName: z.string().min(1, 'Account name is required.'),
  accountNumberMask: z.string().min(4, 'Last 4 digits are required.').max(4, 'Only enter the last 4 digits.'),
  sortCode: z.string().min(6, 'Sort code must be 6 digits.').max(6, 'Sort code must be 6 digits.'),
});

type BankAccountFormValues = z.infer<typeof bankAccountFormSchema>;

export function AddBankAccountDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: contacts, isLoading: loadingLandlords } = useApiCollection<any>('/api/contacts');
  const landlords = contacts.filter((c: any) => c.contact_type === 'Landlord');

  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: {
        contactId: '',
        bankName: '',
        accountName: '',
        accountNumberMask: '',
        sortCode: '',
    },
  });

  async function onSubmit(data: BankAccountFormValues) {
    try {
      await apiCreate('/api/bank-accounts', {
        account_name: data.accountName,
        bank_name: data.bankName,
        sort_code: data.sortCode,
        account_number: data.accountNumberMask,
      });

      toast({
        title: 'Bank Account Added',
        description: `The account for ${data.accountName} has been linked.`,
      });

      form.reset();
      setOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add bank account.',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 gap-1">
          <PlusCircle className="h-4 w-4" />
          <span className="whitespace-nowrap">Add Account</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link a Bank Account</DialogTitle>
          <DialogDescription>
            Manually link a landlord's bank account for tracking payouts.
          </DialogDescription>
        </DialogHeader>
        <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
                In a production app, this form would be replaced by a secure Open Banking integration (e.g., Plaid or Yapily) to link accounts automatically.
            </AlertDescription>
        </Alert>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="contactId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Landlord</FormLabel>
                   {loadingLandlords ? <Skeleton className="h-10 w-full" /> : (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a landlord" /></SelectTrigger></FormControl>
                            <SelectContent>{landlords?.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.first_name} {l.last_name}</SelectItem>)}</SelectContent>
                        </Select>
                   )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="bankName" render={({ field }) => (
              <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input placeholder="e.g., Monzo" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="accountName" render={({ field }) => (
              <FormItem><FormLabel>Account Name</FormLabel><FormControl><Input placeholder="e.g., Mr John Smith" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="sortCode" render={({ field }) => (
                    <FormItem><FormLabel>Sort Code</FormLabel><FormControl><Input placeholder="123456" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="accountNumberMask" render={({ field }) => (
                    <FormItem><FormLabel>Last 4 Digits</FormLabel><FormControl><Input placeholder="1234" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
            </div>

            <DialogFooter className="pt-4">
              <Button type="submit" disabled={loadingLandlords}>Link Account</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
