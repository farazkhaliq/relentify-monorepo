'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';

import { Button } from '@relentify/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@relentify/ui';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@relentify/ui';
import { Input } from '@relentify/ui';
import { useAuth, useFirestore, useMemoFirebase } from '@/firebase';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/hooks/use-user-profile';

const profileFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileSettingsFormProps {
  userProfile: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export function ProfileSettingsForm({ userProfile }: ProfileSettingsFormProps) {
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const { userProfile: profileFromHook } = useUserProfile();
  const organizationId = profileFromHook?.organizationId;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      email: userProfile.email,
    },
  });

  const userProfileDocRef = useMemoFirebase(() =>
    (firestore && organizationId) ? doc(firestore, `organizations/${organizationId}/userProfiles`, userProfile.id) : null
  , [firestore, organizationId, userProfile.id]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!userProfileDocRef || !auth.currentUser || !organizationId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update profile.',
      });
      return;
    }

    const updatedData = {
      firstName: data.firstName,
      lastName: data.lastName,
      updatedAt: serverTimestamp(),
    };
    
    // Update both Firestore and Auth profile
    try {
        await updateProfile(auth.currentUser, { displayName: `${data.firstName} ${data.lastName}` });
        
        const entityName = `${data.firstName} ${data.lastName}`;
        updateDocumentNonBlocking(firestore, auth, organizationId, userProfileDocRef, updatedData, entityName);
        
        toast({
          title: 'Profile Updated',
          description: 'Your name has been successfully updated.',
        });
    } catch (error: any) {
        console.error("Profile update error:", error);
        toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    }
  }

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>My Profile</CardTitle>
            <CardDescription>Manage your personal information.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" {...field} disabled /></FormControl>
                  <FormDescription>You cannot change your email address.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
