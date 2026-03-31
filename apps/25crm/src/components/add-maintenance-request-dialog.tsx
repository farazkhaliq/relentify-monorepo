'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Input } from '@relentify/ui';
import { useApiCollection, apiCreate } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@relentify/ui';
import { Switch } from '@relentify/ui';

const maintenanceRequestFormSchema = z.object({
  propertyId: z.string().min(1, 'Please select a property'),
  reporterContactId: z.string().min(1, 'Please select a contact'),
  title: z.string().min(1, 'Title is required'),
  issueLocation: z.enum(["Kitchen", "Bathroom", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Living Room", "Dining Room", "Garden", "Exterior", "Communal Area", "Other"]),
  issueType: z.enum(["Plumbing", "Electrical", "Heating", "Appliance", "Structural", "General", "Other"]),
  permissionToEnter: z.boolean().default(false),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
});

type MaintenanceRequestFormValues = z.infer<typeof maintenanceRequestFormSchema>;

export function AddMaintenanceRequestDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: properties, isLoading: loadingProperties } = useApiCollection('/api/properties');
  const { data: contacts, isLoading: loadingContacts } = useApiCollection('/api/contacts');

  const form = useForm<MaintenanceRequestFormValues>({
    resolver: zodResolver(maintenanceRequestFormSchema),
    defaultValues: {
      description: '',
      title: '',
      priority: 'Medium',
      permissionToEnter: false,
    },
  });

  async function onSubmit(data: MaintenanceRequestFormValues) {
    try {
      await apiCreate('/api/maintenance', {
        property_id: data.propertyId,
        reported_by_id: data.reporterContactId,
        title: data.title,
        description: `[${data.issueType}] [${data.issueLocation}] ${data.description}${data.permissionToEnter ? ' [Permission to enter: Yes]' : ''}`,
        priority: data.priority,
        status: 'New',
      });

      toast({
        title: 'Request Added',
        description: `A new maintenance request has been successfully created.`,
      });

      form.reset();
      setOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not add request.',
      });
    }
  }

  const isLoading = loadingProperties || loadingContacts;

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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {properties?.map((prop: any) => (
                          <SelectItem key={prop.id} value={prop.id}>{prop.address_line1}, {prop.city}</SelectItem>
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
                        {contacts?.map((contact: any) => (
                          <SelectItem key={contact.id} value={contact.id}>{contact.first_name} {contact.last_name}</SelectItem>
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Leaking kitchen sink" {...field} />
                  </FormControl>
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
