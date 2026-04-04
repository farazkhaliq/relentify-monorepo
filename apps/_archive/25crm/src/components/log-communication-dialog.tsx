'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarIcon, Phone, MessageSquare, Trash2 } from 'lucide-react';
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
import { useApiCollection, apiCreate, apiUpdate, apiDelete } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@relentify/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@relentify/ui';
import { Calendar } from '@relentify/ui';
import { cn } from '@/lib/utils';
import { Skeleton } from '@relentify/ui';
import { Checkbox } from '@relentify/ui';
import { ScrollArea } from '@relentify/ui';

const logCommunicationSchema = z.object({
  contact_id: z.string().optional(),
  direction: z.enum(['Inbound', 'Outbound']),
  timestamp: z.date({ required_error: "A date is required." }),
  subject: z.string().optional(),
  body: z.string().min(1, 'A summary or note about the communication is required.'),
});

type LogCommunicationFormValues = z.infer<typeof logCommunicationSchema>;

interface Communication {
    id: string;
    contact_id?: string;
    direction: 'Inbound' | 'Outbound';
    sent_at?: string;
    subject?: string;
    body: string;
    type: 'Call' | 'WhatsApp';
}

interface LogCommunicationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    communicationType: 'Call' | 'WhatsApp';
    organizationId: string;
    communication?: Communication | null;
    isAdmin: boolean;
}

export function LogCommunicationDialog({ open, onOpenChange, communicationType, organizationId, communication, isAdmin }: LogCommunicationDialogProps) {
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const isEditMode = !!communication;

  const { data: contacts, isLoading: loadingContacts } = useApiCollection<any>('/api/contacts');

  const form = useForm<LogCommunicationFormValues>({
    resolver: zodResolver(logCommunicationSchema),
  });

  useEffect(() => {
    if (open) {
        if (isEditMode && communication) {
            form.reset({
                ...communication,
                subject: communication.subject || '',
                contact_id: communication.contact_id || '',
                timestamp: communication.sent_at ? new Date(communication.sent_at) : new Date(),
            });
        } else {
            form.reset({
                contact_id: '',
                direction: 'Outbound',
                timestamp: new Date(),
                subject: '',
                body: '',
            });
        }
    }
  }, [open, communication, isEditMode, form]);

  async function onSubmit(data: LogCommunicationFormValues) {
    if (!organizationId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not log communication.' });
      return;
    }

    try {
      if (isEditMode) {
          await apiUpdate(`/api/communications/${communication!.id}`, {
            contact_id: data.contact_id || null,
            direction: data.direction,
            subject: data.subject || null,
            body: data.body,
            sent_at: data.timestamp.toISOString(),
          });
          toast({ title: 'Log Updated', description: 'The communication log has been updated.' });
      } else {
          await apiCreate('/api/communications', {
            type: communicationType,
            contact_id: data.contact_id || null,
            direction: data.direction,
            subject: data.subject || null,
            body: data.body,
            status: data.direction === 'Inbound' ? 'Received' : 'Sent',
            sent_at: data.timestamp.toISOString(),
          });
          toast({ title: 'Communication Logged', description: `The ${communicationType.toLowerCase()} has been successfully logged.` });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save communication.' });
    }
    onOpenChange(false);
  }

  const handleDelete = async () => {
    if (!communication) return;

    try {
      await apiDelete(`/api/communications/${communication.id}`);
      toast({ title: 'Log Deleted', description: 'The communication log has been deleted.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete communication.' });
    }

    setDeleteDialogOpen(false);
    onOpenChange(false);
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {communicationType === 'Call' ? <Phone className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
            {isEditMode ? `Edit ${communication?.type} Log` : `Log ${communicationType}`}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details of this communication.' : 'Record the details of this communication for future reference.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
             <FormField
                control={form.control}
                name="contact_id"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Contact</FormLabel>
                        {loadingContacts ? <Skeleton className="h-10 w-full" /> : (
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a contact" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="">None</SelectItem>
                                    {contacts?.map((contact: any) => (
                                        <SelectItem key={contact.id} value={contact.id}>
                                            {contact.first_name} {contact.last_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="direction"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Direction</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Outbound">Outbound</SelectItem>
                                    <SelectItem value="Inbound">Inbound</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="timestamp"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Date & Time</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild><FormControl>
                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl></PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject / Summary</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Initial follow-up about property viewing" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add a detailed summary of the conversation..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4 flex items-center justify-between w-full">
                <div>
                    {isEditMode && isAdmin && (
                        <Button type="button" variant="destructive" onClick={() => setDeleteDialogOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                    )}
                </div>
              <Button type="submit" disabled={loadingContacts}>{isEditMode ? "Save Changes" : "Log Communication"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
     <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete this communication log.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={handleDelete}
            >
                Delete
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
