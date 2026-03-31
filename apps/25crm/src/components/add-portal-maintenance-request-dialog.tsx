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
import { usePortalUserProfile } from '@/hooks/use-portal-user-profile';
import { useApiCollection, apiCreate } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@relentify/ui';
import { Switch } from '@relentify/ui';
import { Alert, AlertDescription, AlertTitle } from '@relentify/ui';
import { AlertCircle } from 'lucide-react';

const portalMaintenanceRequestFormSchema = z.object({
  issueLocation: z.enum(["Kitchen", "Bathroom", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Living Room", "Dining Room", "Garden", "Exterior", "Communal Area", "Other"]),
  issueType: z.enum(["Plumbing", "Electrical", "Heating", "Appliance", "Structural", "General", "Other"]),
  permissionToEnter: z.boolean().default(false),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
});

type MaintenanceRequestFormValues = z.infer<typeof portalMaintenanceRequestFormSchema>;

export function AddPortalMaintenanceRequestDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { portalUserProfile, isLoading: loadingProfile } = usePortalUserProfile();
  const contactId = portalUserProfile?.contactId;

  // Fetch tenancies to find the portal user's active tenancy and property
  const { data: tenancies, isLoading: loadingTenancies } = useApiCollection('/api/tenancies');
  const activeTenancy = tenancies?.find((t: any) =>
    t.status === 'Active' && t.tenant_ids?.includes(contactId)
  );
  const propertyId = activeTenancy?.property_id;

  const form = useForm<MaintenanceRequestFormValues>({
    resolver: zodResolver(portalMaintenanceRequestFormSchema),
    defaultValues: {
      description: '',
      priority: 'Medium',
      permissionToEnter: false,
    },
  });

  async function onSubmit(data: MaintenanceRequestFormValues) {
    if (!contactId || !propertyId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not submit request. Missing required information.',
      });
      return;
    }

    try {
      await apiCreate('/api/maintenance', {
        reported_by_id: contactId,
        property_id: propertyId,
        title: `[${data.issueType}] ${data.issueLocation}`,
        description: `[${data.issueType}] [${data.issueLocation}] ${data.description}${data.permissionToEnter ? ' [Permission to enter: Yes]' : ''}`,
        priority: data.priority,
        status: 'New',
      });

      toast({
        title: 'Request Submitted',
        description: `Your maintenance request has been successfully submitted.`,
      });

      form.reset();
      setOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not submit request.',
      });
    }
  }

  const isLoading = loadingProfile || loadingTenancies;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> New Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Report a New Maintenance Issue</DialogTitle>
          <DialogDescription>
            Please provide as much detail as possible about the issue.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? <Skeleton className="h-64 w-full" /> : !activeTenancy ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Active Tenancy Found</AlertTitle>
            <AlertDescription>
              You must have an active tenancy agreement to report a maintenance issue.
            </AlertDescription>
          </Alert>
        ) : (
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="issueLocation"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Location</FormLabel>
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
                        <FormLabel>Type</FormLabel>
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
                        <Textarea rows={5} placeholder="e.g., The kitchen sink is leaking under the cabinet. It started yesterday evening." {...field} />
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
                    <FormLabel>Urgency</FormLabel>
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
                    <FormDescription>Please select 'Urgent' only for emergencies like major leaks, no heating/hot water, or security risks.</FormDescription>
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
                                <FormDescription>Do we have your permission for a contractor to enter the property if you are not home?</FormDescription>
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
                <Button type="submit" disabled={isLoading || !propertyId}>Submit Request</Button>
                </DialogFooter>
            </form>
            </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
