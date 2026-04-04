'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Sparkles, Trash2 } from 'lucide-react';

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
import { Input } from '@relentify/ui';
import { Button } from '@relentify/ui';
import { Textarea } from '@relentify/ui';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@relentify/ui';
import { ScrollArea } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Separator } from '@relentify/ui';
import { generatePropertyDescription } from '@/ai/flows/generate-property-description';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useOrganization } from '@/hooks/use-organization';
import { apiUpdate, apiDelete, useApiCollection } from '@/hooks/use-api';

const propertyFormSchema = z.object({
  addressLine1: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  postcode: z.string().min(1, 'Postcode is required'),
  propertyType: z.enum(['House', 'Apartment', 'Bungalow', 'Maisonette', 'Commercial']),
  status: z.enum(['Available', 'Occupied', 'Under Offer', 'Let Agreed']),
  numberOfBedrooms: z.coerce.number().min(0, 'Must be a positive number'),
  numberOfBathrooms: z.coerce.number().min(0, 'Must be a positive number'),
  rentAmount: z.coerce.number().min(0, 'Must be a positive number'),
  description: z.string().min(1, 'Description is required'),
  landlordIds: z.array(z.string()).min(1, 'At least one landlord must be selected'),
});

type PropertyFormValues = z.infer<typeof propertyFormSchema>;

interface EditPropertyDialogProps {
    property: { id: string } & Partial<PropertyFormValues>;
    isAdmin: boolean;
}

export function EditPropertyDialog({ property, isAdmin }: EditPropertyDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile } = useUserProfile();
  const { organization } = useOrganization();

  // Fetch landlord contacts via API
  const { data: allContacts, isLoading: loadingLandlords } = useApiCollection<any>('/api/contacts');
  const landlords = allContacts.filter((c: any) => c.contact_type === 'Landlord');

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: property,
  });

  useEffect(() => {
    form.reset(property);
  }, [property, form, open]);

  async function onSubmit(data: PropertyFormValues) {
    if (!userProfile?.activeEntityId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update property.',
      });
      return;
    }

    setIsSaving(true);
    try {
      await apiUpdate('/api/properties/' + property.id, {
        address_line1: data.addressLine1,
        city: data.city,
        postcode: data.postcode,
        property_type: data.propertyType,
        status: data.status,
        number_of_bedrooms: data.numberOfBedrooms,
        number_of_bathrooms: data.numberOfBathrooms,
        rent_amount: data.rentAmount,
        description: data.description,
      });

      toast({
        title: 'Property Updated',
        description: `Property at ${data.addressLine1} has been successfully updated.`,
      });

      setOpen(false);
    } catch (error: any) {
      console.error("Failed to update property:", error);
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  const handleDeleteProperty = async () => {
    if (!userProfile?.activeEntityId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete property.',
      });
      return;
    }

    try {
      await apiDelete('/api/properties/' + property.id);

      toast({
        title: 'Property Deleted',
        description: `The property has been deleted.`,
      });

      setDeleteDialogOpen(false);
      setOpen(false);
      router.push('/properties');
    } catch (error: any) {
      console.error("Failed to delete property:", error);
      toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
    }
  }

  const handleGenerateDescription = async () => {
    setIsGenerating(true);
    try {
        const values = form.getValues();
        if (!values.propertyType || !values.city || values.numberOfBedrooms === undefined || values.numberOfBathrooms === undefined) {
             toast({
                variant: 'destructive',
                title: 'Missing Details',
                description: 'Please fill out property type, city, bedrooms, and bathrooms before generating a description.',
            });
            return;
        }

        const generatedDesc = await generatePropertyDescription({
            propertyType: values.propertyType,
            city: values.city,
            numberOfBedrooms: values.numberOfBedrooms,
            numberOfBathrooms: values.numberOfBathrooms,
            description: values.description,
        });
        form.setValue('description', generatedDesc, { shouldDirty: true });
    } catch (e) {
        console.error(e);
        toast({
            variant: 'destructive',
            title: 'Generation Failed',
            description: 'Could not generate a description at this time.',
        });
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Edit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Property</DialogTitle>
          <DialogDescription>
            Update the details for the property below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="addressLine1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 123 Apple Street" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., London" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postcode</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., SW1A 0AA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="propertyType"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Property Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="House">House</SelectItem>
                                <SelectItem value="Apartment">Apartment</SelectItem>
                                <SelectItem value="Bungalow">Bungalow</SelectItem>
                                <SelectItem value="Maisonette">Maisonette</SelectItem>
                                <SelectItem value="Commercial">Commercial</SelectItem>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Available">Available</SelectItem>
                                <SelectItem value="Occupied">Occupied</SelectItem>
                                <SelectItem value="Under Offer">Under Offer</SelectItem>
                                <SelectItem value="Let Agreed">Let Agreed</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <div className="grid grid-cols-3 gap-4">
                <FormField
                    control={form.control}
                    name="numberOfBedrooms"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Bedrooms</FormLabel>
                            <FormControl><Input type="number" placeholder="3" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="numberOfBathrooms"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Bathrooms</FormLabel>
                            <FormControl><Input type="number" placeholder="1" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="rentAmount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Monthly Rent (£)</FormLabel>
                            <FormControl><Input type="number" placeholder="1500" {...field} /></FormControl>
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
                        <div className="flex items-center justify-between">
                            <FormLabel>Description</FormLabel>
                            {organization?.aiEnabled && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleGenerateDescription}
                                    disabled={isGenerating}
                                >
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    {isGenerating ? 'Generating...' : 'Generate with AI'}
                                </Button>
                            )}
                        </div>
                        <FormControl><Textarea placeholder="A short description of the property..." rows={8} {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="landlordIds"
              render={() => (
                <FormItem>
                  <div className="mb-2">
                    <FormLabel className="text-base">Assign Landlords</FormLabel>
                  </div>
                  {loadingLandlords ? <Skeleton className="h-24 w-full" /> : (
                    <ScrollArea className="h-32 w-full rounded-md border p-4">
                      {landlords?.map((landlord: any) => (
                        <FormField
                          key={landlord.id}
                          control={form.control}
                          name="landlordIds"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={landlord.id}
                                className="flex flex-row items-start space-x-3 space-y-0 py-2"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(landlord.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), landlord.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value: string) => value !== landlord.id
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {landlord.first_name} {landlord.last_name}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                      {(!landlords || landlords.length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-4">No landlords found. Please add a landlord contact first.</p>
                      )}
                    </ScrollArea>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4 sticky bottom-0 bg-background/95 py-4 -mx-6 px-6 flex items-center justify-between w-full">
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
              <Button type="submit" disabled={isSaving || loadingLandlords || isGenerating || !userProfile?.activeEntityId}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
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
                This action cannot be undone. This will permanently delete this property record.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={handleDeleteProperty}
            >
                Delete
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
