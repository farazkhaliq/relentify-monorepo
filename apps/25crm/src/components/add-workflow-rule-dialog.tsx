'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, serverTimestamp } from 'firebase/firestore';
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
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Textarea } from '@relentify/ui';
import { Switch } from '@relentify/ui';

const workflowFormSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  description: z.string().optional(),
  eventType: z.string().min(1, 'Trigger event is required'),
  conditions: z.string().optional(),
  actions: z.string().min(1, 'At least one action is required'),
  priority: z.coerce.number().min(1).max(10),
  isActive: z.boolean().default(true),
});

type WorkflowFormValues = z.infer<typeof workflowFormSchema>;

const EXAMPLE_EVENT_TYPES = [
    'RentOverdue',
    'MaintenanceRequestCreated',
    'TenancyAboutToExpire',
    'NewLeadReceived',
    'PropertyStatusChanged',
];

export function AddWorkflowRuleDialog() {
  const [open, setOpen] = useState(false);
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const { userProfile } = useUserProfile();
  const organizationId = userProfile?.organizationId;
  const currentUserId = userProfile?.id;

  const form = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues: {
      name: '',
      description: '',
      conditions: '',
      actions: '',
      priority: 5,
      isActive: true,
    },
  });

  const workflowsCollectionRef = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/workflowRules`) : null
  , [firestore, organizationId]);

  function onSubmit(data: WorkflowFormValues) {
    if (!workflowsCollectionRef || !organizationId || !currentUserId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not add rule.',
      });
      return;
    }

    const newRuleData = {
      ...data,
      organizationId,
      createdByUserId: currentUserId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    addDocumentNonBlocking(firestore, auth, organizationId, workflowsCollectionRef, newRuleData, data.name);
    
    toast({
      title: 'Workflow Rule Added',
      description: `The rule "${data.name}" has been created.`,
    });

    form.reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 gap-1">
          <PlusCircle className="h-4 w-4" />
          <span className="whitespace-nowrap">Add Rule</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add New Workflow Rule</DialogTitle>
          <DialogDescription>
            Define a new automation rule for the system.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Send Rent Reminder Email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="A short explanation of what this rule does." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trigger Event</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select an event" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {EXAMPLE_EVENT_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="conditions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conditions</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="JSON or DSL for conditions (e.g., property.status == 'Available')" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="actions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Actions</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="JSON or DSL for actions (e.g., sendEmail(template: 'rent_reminder'))" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4 items-end">
                <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <FormControl>
                            <Input type="number" min="1" max="10" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm h-10">
                            <div className="space-y-0.5">
                                <FormLabel>Active</FormLabel>
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
            </div>
            
            <DialogFooter className="pt-4">
              <Button type="submit">Save Rule</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
