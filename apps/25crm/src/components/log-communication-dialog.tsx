'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, serverTimestamp, doc, Timestamp } from 'firebase/firestore';
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
import { useCollection, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@relentify/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@relentify/ui';
import { Calendar } from '@relentify/ui';
import { cn } from '@/lib/utils';
import { Skeleton } from '@relentify/ui';
import { Checkbox } from '@relentify/ui';
import { ScrollArea } from '@relentify/ui';

const logCommunicationSchema = z.object({
  relatedContactIds: z.array(z.string()).min(1, 'At least one contact must be selected.'),
  direction: z.enum(['Inbound', 'Outbound']),
  timestamp: z.date({ required_error: "A date is required." }),
  subject: z.string().optional(),
  body: z.string().min(1, 'A summary or note about the communication is required.'),
});

type LogCommunicationFormValues = z.infer<typeof logCommunicationSchema>;

interface Communication {
    id: string;
    relatedContactIds?: string[];
    direction: 'Inbound' | 'Outbound';
    timestamp: any;
    subject?: string;
    body: string;
    communicationType: 'Call' | 'WhatsApp';
}

interface LogCommunicationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    communicationType: 'Call' | 'WhatsApp';
    organizationId: string;
    communication?: Communication | null;
    isAdmin: boolean;
}

const getTimestampAsDate = (timestamp: any): Date | undefined => {
  if (!timestamp) return undefined;
  if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
  if (typeof timestamp === 'string' || timestamp instanceof Date) { return new Date(timestamp); }
  return undefined;
};

export function LogCommunicationDialog({ open, onOpenChange, communicationType, organizationId, communication, isAdmin }: LogCommunicationDialogProps) {
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  
  const isEditMode = !!communication;

  const contactsQuery = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/contacts`) : null,
    [firestore, organizationId]
  );
  const { data: contacts, isLoading: loadingContacts } = useCollection<any>(contactsQuery);

  const form = useForm<LogCommunicationFormValues>({
    resolver: zodResolver(logCommunicationSchema),
  });
  
  useEffect(() => {
    if (open) {
        if (isEditMode && communication) {
            form.reset({
                ...communication,
                subject: communication.subject || '',
                relatedContactIds: communication.relatedContactIds || [],
                timestamp: getTimestampAsDate(communication.timestamp),
            });
        } else {
            form.reset({
                relatedContactIds: [],
                direction: 'Outbound',
                timestamp: new Date(),
                subject: '',
                body: '',
            });
        }
    }
  }, [open, communication, isEditMode, form]);

  const commsCollectionRef = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/communications`) : null, 
    [firestore, organizationId]
  );

  const commDocRef = useMemoFirebase(() =>
    (firestore && organizationId && isEditMode) ? doc(firestore, `organizations/${organizationId}/communications`, communication.id) : null,
    [firestore, organizationId, communication, isEditMode]
  );

  function onSubmit(data: LogCommunicationFormValues) {
    if (!auth || !organizationId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not log communication.' });
      return;
    }
    
    if (isEditMode) {
        if (!commDocRef) return;
        const entityName = data.subject || `Log for ${format(data.timestamp, 'PP')}`;
        updateDocumentNonBlocking(firestore, auth, organizationId, commDocRef, { ...data, updatedAt: serverTimestamp() }, entityName);
        toast({ title: 'Log Updated', description: 'The communication log has been updated.' });
    } else {
        if (!commsCollectionRef) return;
        const newCommData = {
          ...data,
          organizationId,
          communicationType: communicationType,
          status: data.direction === 'Inbound' ? 'Received' : 'Sent',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const entityName = data.subject || `${communicationType} Log`;
        addDocumentNonBlocking(firestore, auth, organizationId, commsCollectionRef, newCommData, entityName);
        toast({ title: 'Communication Logged', description: `The ${communicationType.toLowerCase()} has been successfully logged.` });
    }
    onOpenChange(false);
  }

  const handleDelete = () => {
    if (!commDocRef || !auth || !organizationId) return;

    deleteDocumentNonBlocking(firestore, auth, organizationId, commDocRef, communication?.subject);
    toast({ title: 'Log Deleted', description: 'The communication log has been deleted.' });

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
            {isEditMode ? `Edit ${communication?.communicationType} Log` : `Log ${communicationType}`}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details of this communication.' : 'Record the details of this communication for future reference.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
             <FormField
                control={form.control}
                name="relatedContactIds"
                render={() => (
                    <FormItem>
                        <FormLabel>Participants</FormLabel>
                        {loadingContacts ? <Skeleton className="h-24 w-full" /> : (
                            <ScrollArea className="h-24 w-full rounded-md border p-4">
                                {contacts?.map((contact) => (
                                    <FormField
                                    key={contact.id}
                                    control={form.control}
                                    name="relatedContactIds"
                                    render={({ field }) => (
                                        <FormItem key={contact.id} className="flex flex-row items-start space-x-3 space-y-0 py-1">
                                            <FormControl><Checkbox checked={field.value?.includes(contact.id)} onCheckedChange={(checked) => (checked ? field.onChange([...(field.value || []), contact.id]) : field.onChange(field.value?.filter((value) => value !== contact.id)))}/></FormControl>
                                            <FormLabel className="font-normal">{contact.firstName} {contact.lastName}</FormLabel>
                                        </FormItem>
                                    )}
                                    />
                                ))}
                            </ScrollArea>
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
