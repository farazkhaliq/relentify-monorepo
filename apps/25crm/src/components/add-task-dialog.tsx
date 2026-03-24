'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, doc, serverTimestamp, query, setDoc } from 'firebase/firestore';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useCollection, useFirestore, useMemoFirebase, useAuth, useUserProfile } from '@/firebase';
import { logAuditEvent } from '@/firebase/audit';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@relentify/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@relentify/ui';
import { Calendar } from '@relentify/ui';
import { cn } from '@/lib/utils';
import { Skeleton } from '@relentify/ui';
import { Separator } from '@relentify/ui';

const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assignedToUserId: z.string().min(1, 'Please assign this task to a user'),
  priority: z.enum(['High', 'Medium', 'Low']),
  status: z.enum(['Open', 'In Progress', 'Completed']),
  dueDate: z.date({
    required_error: "A due date is required.",
  }),
  relatedPropertyId: z.string().optional(),
  relatedContactId: z.string().optional(),
  relatedTenancyId: z.string().optional(),
  relatedCommunicationId: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface AddTaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultValues?: Partial<TaskFormValues>;
}


export function AddTaskDialog({ open, onOpenChange, defaultValues }: AddTaskDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;

  const usersQuery = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/userProfiles`) : null,
    [firestore, organizationId]
  );
  const { data: users, isLoading: loadingUsers } = useCollection<any>(usersQuery);

  const propertiesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/properties`) : null, [firestore, organizationId]);
  const { data: properties, isLoading: loadingProperties } = useCollection<any>(propertiesQuery);

  const contactsQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/contacts`) : null, [firestore, organizationId]);
  const { data: contacts, isLoading: loadingContacts } = useCollection<any>(contactsQuery);

  const tenanciesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/tenancies`) : null, [firestore, organizationId]);
  const { data: tenancies, isLoading: loadingTenancies } = useCollection<any>(tenanciesQuery);

  const contactMap = useMemo(() => new Map(contacts?.map(c => [c.id, `${c.firstName} ${c.lastName}`]) || []), [contacts]);
  const propertyMap = useMemo(() => new Map(properties?.map(p => [p.id, p.addressLine1]) || []), [properties]);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      priority: 'Medium',
      status: 'Open',
    },
  });
  
  useEffect(() => {
    if (open) {
      if (defaultValues) {
        form.reset(defaultValues);
      } else {
        form.reset({
          title: '',
          description: '',
          priority: 'Medium',
          status: 'Open',
        });
      }
      if (currentUserProfile?.id) {
        form.setValue('assignedToUserId', currentUserProfile.id);
      }
    }
  }, [defaultValues, form, open, currentUserProfile]);

  const tasksCollectionRef = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/tasks`) : null
  , [firestore, organizationId]);

  async function onSubmit(data: TaskFormValues) {
    if (!tasksCollectionRef || !auth.currentUser || !organizationId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not add task.',
      });
      return;
    }
    
    setIsSaving(true);
    try {
        const newTaskRef = doc(tasksCollectionRef);
        const newTaskData = {
          id: newTaskRef.id,
          ...data,
          organizationId,
          createdByUserId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        await setDoc(newTaskRef, newTaskData);
        logAuditEvent(firestore, auth, organizationId, 'Created', newTaskRef, data.title);
        
        toast({
          title: 'Task Added',
          description: `Task "${data.title}" has been successfully added.`,
        });

        onOpenChange(false);
    } catch (error: any) {
        console.error("Failed to save task:", error);
        toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } finally {
        setIsSaving(false);
    }
  }

  const isLoading = loadingUsers || loadingCurrentUser || loadingProperties || loadingContacts || loadingTenancies;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>
            Fill in the details for the new task below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Follow up with potential client" {...field} />
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
                    <Textarea placeholder="Add a more detailed description for this task..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="assignedToUserId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Assign To</FormLabel>
                            {isLoading ? <Skeleton className="h-10 w-full" /> : (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {users?.map(user => (
                                            <SelectItem key={user.id} value={user.id}>{user.firstName} {user.lastName}</SelectItem>
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
                    name="dueDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Due Date</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                    )}
                                    >
                                    {field.value ? (
                                        format(field.value, "PPP")
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) =>
                                        date < new Date(new Date().setHours(0,0,0,0))
                                    }
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="Low">Low</SelectItem>
                                    <SelectItem value="Medium">Medium</SelectItem>
                                    <SelectItem value="High">High</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="Open">Open</SelectItem>
                                    <SelectItem value="In Progress">In Progress</SelectItem>
                                    <SelectItem value="Completed">Completed</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <Separator className="my-2" />
            <h3 className="text-base font-medium">Link to (Optional)</h3>
             <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="relatedContactId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Contact</FormLabel>
                            {isLoading ? <Skeleton className="h-10 w-full" /> : (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select a contact" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {contacts?.map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="relatedPropertyId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Property</FormLabel>
                            {isLoading ? <Skeleton className="h-10 w-full" /> : (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.addressLine1}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
             <FormField
                control={form.control}
                name="relatedTenancyId"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Tenancy</FormLabel>
                        {isLoading ? <Skeleton className="h-10 w-full" /> : (
                            <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a tenancy" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {tenancies?.map(t => {
                                const propertyName = propertyMap.get(t.propertyId) || 'Unknown Property';
                                const tenantNames = t.tenantIds.map((id:string) => contactMap.get(id) || '').join(', ');
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
            <DialogFooter>
              <Button type="submit" disabled={isLoading || isSaving || !organizationId}>
                {isSaving ? 'Saving...' : 'Save Task'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
