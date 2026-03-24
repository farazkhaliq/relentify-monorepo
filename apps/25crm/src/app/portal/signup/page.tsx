'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, collection, writeBatch, query, where, getDocs, setDoc } from 'firebase/firestore';
import Link from 'next/link';

import { Button } from '@relentify/ui';
import {
  Card,
  CardContent,
  CardDescription,
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
import { useAuth, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

const signupFormSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

export default function PortalSignupPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: { organizationId: '', email: '', password: '' },
  });

  const onSubmit = async (data: SignupFormValues) => {
    try {
      // 1. Verify that a contact exists with this email for the given organization.
      const contactsRef = collection(firestore, `organizations/${data.organizationId}/contacts`);
      const q = query(contactsRef, where('email', '==', data.email));
      const contactSnap = await getDocs(q);

      if (contactSnap.empty) {
        toast({
            variant: 'destructive',
            title: 'Registration Failed',
            description: 'No contact found with this email for the provided organization ID. Please check your details or contact the agency.',
        });
        return;
      }
      
      const contactDoc = contactSnap.docs[0];
      const contactData = contactDoc.data();
      const contactId = contactDoc.id;

      // 2. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      
      // 3. Update their auth profile display name
      await updateProfile(user, {
        displayName: `${contactData.firstName} ${contactData.lastName}`,
      });

      // 4. Create the PortalUserProfile document to link auth to the contact record
      const portalProfileRef = doc(firestore, `portalUserProfiles`, user.uid);
      const portalProfileData = {
          organizationId: data.organizationId,
          contactId: contactId,
          email: data.email,
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          createdAt: serverTimestamp(),
      };
      
      await setDoc(portalProfileRef, portalProfileData);

      toast({
        title: 'Account Created',
        description: `Welcome! Your portal account has been created successfully.`,
      });

      // 5. Redirect to the portal dashboard
      router.push('/portal/dashboard');

    } catch (error: any) {
      console.error('Portal sign-up failed:', error);
      toast({
        variant: 'destructive',
        title: 'Sign-up Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Create your Portal Account</CardTitle>
        <CardDescription>
          If you are a tenant or landlord, use the Organization ID provided by your agency to sign up.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="organizationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization ID</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter the ID from your agency" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="m@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
        </Form>
        <div className="mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link href="/portal/login" className="underline">
            Login
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
