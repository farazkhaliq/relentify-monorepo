'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

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
import { apiUpdate, apiDelete } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@relentify/ui';
import { Textarea } from '@relentify/ui';
import { useUserProfile } from '@/hooks/use-user-profile';

// Define the Address schema part to be reusable
const addressSchema = z.object({
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
}).optional();

// Define the main form schema
const contactFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  contactType: z.enum(['Landlord', 'Tenant', 'Lead', 'Contractor']),
  notes: z.string().optional(),
  mailingAddress: addressSchema,
  previousAddress: addressSchema,
  forwardingAddress: addressSchema,
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

interface EditContactDialogProps {
    contact: { id: string } & Partial<ContactFormValues>;
    isAdmin: boolean;
}

export function EditContactDialog({ contact, isAdmin }: EditContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile } = useUserProfile();

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: contact,
  });

  // Reset the form with new contact data if the dialog is opened for a different contact
  useEffect(() => {
    form.reset(contact);
  }, [contact, form]);

  async function onSubmit(data: ContactFormValues) {
    setIsSaving(true);
    try {
      await apiUpdate('/api/contacts/' + contact.id, {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        contact_type: data.contactType,
        notes: data.notes || null,
        address_line1: data.mailingAddress?.addressLine1 || null,
        address_line2: data.mailingAddress?.addressLine2 || null,
        city: data.mailingAddress?.city || null,
        postcode: data.mailingAddress?.postcode || null,
        country: data.mailingAddress?.country || null,
      });

      toast({
        title: 'Contact Updated',
        description: `${data.firstName} ${data.lastName} has been successfully updated.`,
      });

      setOpen(false);
    } catch (error: any) {
      console.error("Failed to update contact:", error);
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  const handleDeleteContact = async () => {
    try {
      await apiDelete('/api/contacts/' + contact.id);

      toast({
        title: 'Contact Deleted',
        description: `${contact.firstName} ${contact.lastName} has been deleted.`,
      });

      setDeleteDialogOpen(false);
      setOpen(false);
      router.push('/contacts');
    } catch (error: any) {
      console.error("Failed to delete contact:", error);
      toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
    }
  }

  // A helper component to render address fields
  const AddressFields = ({ fieldName, title }: { fieldName: 'mailingAddress' | 'previousAddress' | 'forwardingAddress', title: string }) => (
    <>
      <h3 className="font-medium text-lg mt-4">{title}</h3>
      <FormField
        control={form.control}
        name={`${fieldName}.addressLine1`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address Line 1</FormLabel>
            <FormControl><Input placeholder="123 Main St" {...field} value={field.value ?? ''} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`${fieldName}.addressLine2`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address Line 2 (Optional)</FormLabel>
            <FormControl><Input placeholder="Apartment, studio, or floor" {...field} value={field.value ?? ''} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name={`${fieldName}.city`} render={({ field }) => (
          <FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="London" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name={`${fieldName}.postcode`} render={({ field }) => (
          <FormItem><FormLabel>Postcode</FormLabel><FormControl><Input placeholder="SW1A 0AA" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
        )} />
      </div>
      <FormField control={form.control} name={`${fieldName}.country`} render={({ field }) => (
        <FormItem><FormLabel>Country</FormLabel><FormControl><Input placeholder="United Kingdom" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
      )} />
    </>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Edit</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update the contact details below.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="contactType" render={({ field }) => (
                <FormItem><FormLabel>Contact Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Lead">Lead</SelectItem>
                    <SelectItem value="Tenant">Tenant</SelectItem>
                    <SelectItem value="Landlord">Landlord</SelectItem>
                    <SelectItem value="Contractor">Contractor</SelectItem>
                  </SelectContent>
                </Select><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Add notes..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />

              <Separator className="my-2" />
              <AddressFields fieldName="mailingAddress" title="Mailing Address" />

              <Separator className="my-2" />
              <AddressFields fieldName="previousAddress" title="Previous Address" />

              <Separator className="my-2" />
              <AddressFields fieldName="forwardingAddress" title="Forwarding Address" />

              <DialogFooter className="pt-4 sticky bottom-0 bg-background/95 py-4 -mx-6 px-6 flex items-center justify-between w-full">
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
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
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
                This action cannot be undone. This will permanently delete the contact
                record for {contact.firstName} {contact.lastName}.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={handleDeleteContact}
            >
                Delete
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
