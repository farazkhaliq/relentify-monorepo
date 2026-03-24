'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, serverTimestamp } from 'firebase/firestore';
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
import { Button } from '@relentify/ui';
import { Textarea } from '@relentify/ui';
import { useAuth, useFirestore, useMemoFirebase } from '@/firebase';
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/hooks/use-user-profile';

const maintenanceFormSchema = z.object({
  status: z.enum(['New', 'In Progress', 'Awaiting Parts', 'On Hold', 'Completed', 'Cancelled']),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  resolutionNotes: z.string().optional(),
});

type MaintenanceFormValues = z.infer<typeof maintenanceFormSchema>;

interface EditMaintenanceDialogProps {
    maintenanceRequest: { id: string, description?: string } & Partial<MaintenanceFormValues>;
    isAdmin: boolean;
}

export function EditMaintenanceDialog({ maintenanceRequest, isAdmin }: EditMaintenanceDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile } = useUserProfile();
  const organizationId = userProfile?.organizationId;

  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceFormSchema),
    defaultValues: maintenanceRequest,
  });

  useEffect(() => {
    form.reset(maintenanceRequest);
  }, [maintenanceRequest, form, open]);

  const requestDocRef = useMemoFirebase(() =>
    (firestore && organizationId) ? doc(firestore, `organizations/${organizationId}/maintenanceRequests`, maintenanceRequest.id) : null
  , [firestore, organizationId, maintenanceRequest.id]);

  function onSubmit(data: MaintenanceFormValues) {
    if (!requestDocRef || !organizationId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update request.',
      });
      return;
    }

    const updatedData = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    
    const entityName = maintenanceRequest.description;
    updateDocumentNonBlocking(firestore, auth, organizationId, requestDocRef, updatedData, entityName);
    
    toast({
      title: 'Request Updated',
      description: `The maintenance request has been successfully updated.`,
    });

    setOpen(false);
  }

  const handleDeleteRequest = () => {
    if (!requestDocRef || !organizationId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete request.' });
      return;
    }
    
    const entityName = maintenanceRequest.description;
    deleteDocumentNonBlocking(firestore, auth, organizationId, requestDocRef, entityName);

    toast({ title: 'Request Deleted', description: 'The maintenance request has been deleted.' });

    setDeleteDialogOpen(false);
    setOpen(false);
    router.push('/maintenance');
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Update</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Maintenance Request</DialogTitle>
            <DialogDescription>
              Update the status, priority, and add resolution notes.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                          {['New', 'In Progress', 'Awaiting Parts', 'On Hold', 'Completed', 'Cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                name="resolutionNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resolution Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Detail the work carried out..." {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4 flex items-center justify-between w-full">
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
                <Button type="submit">Save Changes</Button>
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
                  This action cannot be undone. This will permanently delete this maintenance request.
              </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={handleDeleteRequest}
              >
                  Delete
              </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
