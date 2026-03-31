'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@relentify/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@relentify/ui';
import { Calendar } from '@relentify/ui';
import { cn } from '@/lib/utils';
import { Skeleton } from '@relentify/ui';
import { Separator } from '@relentify/ui';
import { useApiCollection, apiCreate } from '@/hooks/use-api';
import { useUserProfile } from '@/hooks/use-user-profile';

const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['High', 'Medium', 'Low']),
  status: z.enum(['To Do', 'In Progress', 'Completed']),
  dueDate: z.date({
    required_error: "A due date is required.",
  }),
  relatedType: z.string().optional(),
  relatedId: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface AddTaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultValues?: Partial<TaskFormValues>;
}


export function AddTaskDialog({ open, onOpenChange, defaultValues }: AddTaskDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { userProfile, isLoading: loadingCurrentUser } = useUserProfile();

  const { data: contacts, isLoading: loadingContacts } = useApiCollection<any>('/api/contacts');
  const { data: properties, isLoading: loadingProperties } = useApiCollection<any>('/api/properties');
  const { data: tenancies, isLoading: loadingTenancies } = useApiCollection<any>('/api/tenancies');

  const contactMap = useMemo(() => new Map(contacts?.map((c: any) => [c.id, `${c.first_name} ${c.last_name}`]) || []), [contacts]);
  const propertyMap = useMemo(() => new Map(properties?.map((p: any) => [p.id, p.address_line1]) || []), [properties]);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      priority: 'Medium',
      status: 'To Do',
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
          status: 'To Do',
        });
      }
    }
  }, [defaultValues, form, open]);

  async function onSubmit(data: TaskFormValues) {
    setIsSaving(true);
    try {
        await apiCreate('/api/tasks', {
          title: data.title,
          description: data.description || null,
          due_date: data.dueDate ? format(data.dueDate, 'yyyy-MM-dd') : null,
          priority: data.priority,
          status: data.status,
          related_type: data.relatedType || null,
          related_id: data.relatedId || null,
        });

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

  const isLoading = loadingCurrentUser || loadingProperties || loadingContacts || loadingTenancies;

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
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                                    <SelectItem value="To Do">To Do</SelectItem>
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
                    name="relatedType"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Link Type</FormLabel>
                            <Select onValueChange={(v) => { field.onChange(v); form.setValue('relatedId', ''); }} value={field.value || ''}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="">None</SelectItem>
                                    <SelectItem value="contact">Contact</SelectItem>
                                    <SelectItem value="property">Property</SelectItem>
                                    <SelectItem value="tenancy">Tenancy</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="relatedId"
                    render={({ field }) => {
                        const relatedType = form.watch('relatedType');
                        let items: { id: string; label: string }[] = [];
                        if (relatedType === 'contact') {
                          items = contacts?.map((c: any) => ({ id: c.id, label: `${c.first_name} ${c.last_name}` })) || [];
                        } else if (relatedType === 'property') {
                          items = properties?.map((p: any) => ({ id: p.id, label: p.address_line1 })) || [];
                        } else if (relatedType === 'tenancy') {
                          items = tenancies?.map((t: any) => {
                            const propertyName = propertyMap.get(t.property_id) || 'Unknown Property';
                            return { id: t.id, label: propertyName };
                          }) || [];
                        }
                        return (
                            <FormItem>
                                <FormLabel>Link To</FormLabel>
                                {isLoading ? <Skeleton className="h-10 w-full" /> : (
                                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={!relatedType}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder={relatedType ? "Select..." : "Choose type first"} /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {items.map(item => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                                <FormMessage />
                            </FormItem>
                        );
                    }}
                />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading || isSaving}>
                {isSaving ? 'Saving...' : 'Save Task'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
