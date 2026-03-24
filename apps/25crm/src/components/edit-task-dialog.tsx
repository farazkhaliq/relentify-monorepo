'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, serverTimestamp, doc, Timestamp, query } from 'firebase/firestore';
import { CalendarIcon, Link as LinkIcon, Trash2, Home, User, FileText } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

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
import { useCollection, useFirestore, useMemoFirebase, useDoc, useAuth, useUserProfile } from '@/firebase';
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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
  dueDate: z.date({ required_error: "A due date is required." }),
  relatedPropertyId: z.string().optional(),
  relatedContactId: z.string().optional(),
  relatedTenancyId: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface Task extends TaskFormValues {
    id: string;
    relatedCommunicationId?: string;
}

interface EditTaskDialogProps {
  task: Partial<Task>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getTimestampAsDate = (timestamp: any): Date | undefined => {
    if (!timestamp) return undefined;
    if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
    if (typeof timestamp === 'string' || timestamp instanceof Date) { return new Date(timestamp); }
    return undefined;
};

export function EditTaskDialog({ task, open, onOpenChange }: EditTaskDialogProps) {
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;

  // --- Data for dropdowns ---
  const usersQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/userProfiles`) : null, [firestore, organizationId]);
  const { data: users, isLoading: loadingUsers } = useCollection<any>(usersQuery);

  const propertiesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/properties`) : null, [firestore, organizationId]);
  const { data: properties, isLoading: loadingProperties } = useCollection<any>(propertiesQuery);

  const contactsQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/contacts`) : null, [firestore, organizationId]);
  const { data: contacts, isLoading: loadingContacts } = useCollection<any>(contactsQuery);

  const tenanciesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/tenancies`) : null, [firestore, organizationId]);
  const { data: tenancies, isLoading: loadingTenancies } = useCollection<any>(tenanciesQuery);
  
  const contactMap = useMemo(() => new Map(contacts?.map(c => [c.id, `${c.firstName} ${c.lastName}`]) || []), [contacts]);
  const propertyMap = useMemo(() => new Map(properties?.map(p => [p.id, p.addressLine1]) || []), [properties]);

  // --- Data for readonly communication link ---
  const communicationRef = useMemoFirebase(() => {
    if (!firestore || !organizationId || !task.relatedCommunicationId) return null;
    return doc(firestore, `organizations/${organizationId}/communications`, task.relatedCommunicationId);
  }, [firestore, organizationId, task.relatedCommunicationId]);
  const { data: commData, isLoading: isLoadingComm } = useDoc<any>(communicationRef);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
  });

  useEffect(() => {
    if (task) {
        form.reset({
            ...task,
            description: task.description || '',
            dueDate: getTimestampAsDate(task.dueDate),
            relatedPropertyId: task.relatedPropertyId || '',
            relatedContactId: task.relatedContactId || '',
            relatedTenancyId: task.relatedTenancyId || '',
        });
    }
  }, [task, form]);

  const taskDocRef = useMemoFirebase(() =>
    (firestore && organizationId && task.id) ? doc(firestore, `organizations/${organizationId}/tasks`, task.id) : null,
    [firestore, organizationId, task.id]
  );

  function onSubmit(data: TaskFormValues) {
    if (!taskDocRef || !auth || !organizationId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update task.',
      });
      return;
    }

    const updatedTaskData = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    
    const entityName = data.title;
    updateDocumentNonBlocking(firestore, auth, organizationId, taskDocRef, updatedTaskData, entityName);
    
    toast({
      title: 'Task Updated',
      description: `Task "${data.title}" has been successfully updated.`,
    });

    onOpenChange(false);
  }

  const handleDeleteTask = () => {
    if (!taskDocRef || !auth || !organizationId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete task.' });
      return;
    }
    
    const entityName = task.title;
    deleteDocumentNonBlocking(firestore, auth, organizationId, taskDocRef, entityName);

    toast({ title: 'Task Deleted', description: 'The task has been deleted.' });

    setDeleteDialogOpen(false);
    onOpenChange(false);
  }

  const isLoading = loadingUsers || loadingCurrentUser || loadingProperties || loadingContacts || loadingTenancies || isLoadingComm;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update the details for the task below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
             {isLoadingComm && task.relatedCommunicationId ? <Skeleton className="h-10 w-full" /> : null}
             {commData && (
                <Link href={`/communications?emailId=${task.relatedCommunicationId}`} className="text-sm p-3 bg-muted rounded-md flex items-center gap-2 hover:bg-muted/80">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <span>Linked to email:</span>
                    <span className="font-semibold truncate">"{commData.subject}"</span>
                </Link>
            )}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                    <Textarea {...field} />
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
                                    className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                    >
                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
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
                                        <SelectTrigger allowClear><SelectValue placeholder="Select a contact" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="">None</SelectItem>
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
                                        <SelectItem value="">None</SelectItem>
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
                                <SelectItem value="">None</SelectItem>
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

            <DialogFooter className="pt-4 flex items-center justify-between w-full">
                <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                </Button>
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
                This action cannot be undone. This will permanently delete this task.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={handleDeleteTask}
            >
                Delete
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
