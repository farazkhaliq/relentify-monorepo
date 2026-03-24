'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, serverTimestamp, doc, setDoc, addDoc } from 'firebase/firestore';
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
import { useAuth, useFirestore, useMemoFirebase } from '@/firebase';
import { logAuditEvent } from '@/firebase/audit';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@relentify/ui';
import { useUserProfile } from '@/hooks/use-user-profile';

const contactFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  contactType: z.enum(['Landlord', 'Tenant', 'Lead', 'Contractor']),
  mailingAddress: z.object({
    addressLine1: z.string().min(1, 'Address is required'),
    addressLine2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    postcode: z.string().min(1, 'Postcode is required'),
    country: z.string().min(1, 'Country is required'),
  }),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export function AddContactDialog() {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const { userProfile } = useUserProfile();
  const organizationId = userProfile?.organizationId;

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      contactType: 'Lead',
      mailingAddress: {
        addressLine1: '',
        addressLine2: '',
        city: '',
        postcode: '',
        country: 'United Kingdom',
      }
    },
  });

  const contactsCollectionRef = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/contacts`) : null
  , [firestore, organizationId]);

  async function onSubmit(data: ContactFormValues) {
    if (!contactsCollectionRef || !organizationId || !auth.currentUser) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not add contact. Organization not found.',
      });
      return;
    }
    
    setIsSaving(true);
    try {
        const newContactRef = doc(contactsCollectionRef);
        const newContactData = {
          id: newContactRef.id,
          ...data,
          organizationId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          propertyIds: [],
          tenancyIds: [],
        };
        
        await setDoc(newContactRef, newContactData);
        logAuditEvent(firestore, auth, organizationId, 'Created', newContactRef, `${data.firstName} ${data.lastName}`);
        
        // --- Workflow: Create task if new contact is a lead ---
        if (data.contactType === 'Lead') {
            const tasksCollectionRef = collection(firestore, `organizations/${organizationId}/tasks`);
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 3); // Set due date 3 days from now
            
            const tasksRef = doc(tasksCollectionRef);
            const newTaskData = {
                id: tasksRef.id,
                organizationId,
                title: `Follow up with ${data.firstName} ${data.lastName}`,
                description: `A new lead has been added. Reach out to them.`,
                assignedToUserId: auth.currentUser.uid,
                createdByUserId: auth.currentUser.uid,
                dueDate: dueDate,
                priority: 'Medium',
                status: 'Open',
                relatedContactId: newContactRef.id,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            // This is a "fire-and-forget" operation, we don't need to wait for it.
            // We'll add its own audit event inside the task creation logic if needed,
            // but for now, we'll keep it simple.
            await setDoc(tasksRef, newTaskData);
            logAuditEvent(firestore, auth, organizationId, 'Created', tasksRef, newTaskData.title);
        }

        toast({
          title: 'Contact Added',
          description: `${data.firstName} ${data.lastName} has been successfully added.`,
        });

        form.reset();
        setOpen(false);

    } catch (error: any) {
        console.error("Failed to save contact:", error);
        toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1">
          <PlusCircle className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Add Contact
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
          <DialogDescription>
            Enter the details for the new contact below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john.doe@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="07123 456789" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a contact type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Lead">Lead</SelectItem>
                      <SelectItem value="Tenant">Tenant</SelectItem>
                      <SelectItem value="Landlord">Landlord</SelectItem>
                      <SelectItem value="Contractor">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator className="my-2" />
            
            <h3 className="font-medium text-lg">Mailing Address</h3>

            <FormField
              control={form.control}
              name="mailingAddress.addressLine1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mailingAddress.addressLine2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2 (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Apartment, studio, or floor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="mailingAddress.city"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                            <Input placeholder="London" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="mailingAddress.postcode"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Postcode</FormLabel>
                        <FormControl>
                            <Input placeholder="SW1A 0AA" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
             <FormField
                control={form.control}
                name="mailingAddress.country"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                        <Input placeholder="United Kingdom" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />


            <DialogFooter className="pt-4">
              <Button type="submit" disabled={!organizationId || isSaving}>
                {isSaving ? 'Saving...' : 'Save Contact'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
