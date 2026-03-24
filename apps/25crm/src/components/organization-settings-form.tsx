'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

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
import { useAuth, useFirestore, useMemoFirebase, useStorage } from '@/firebase';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@relentify/ui';
import React, { useEffect, useState } from 'react';
import { useUserProfile } from '@/hooks/use-user-profile';
import Image from 'next/image';
import { UploadCloud } from 'lucide-react';
import { Progress } from '@relentify/ui';
import { useOrganization } from '@/hooks/use-organization';
import { Switch } from '@relentify/ui';
import { Label } from '@relentify/ui';

// Schema for the name update part
const orgFormSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
});
type OrgFormValues = z.infer<typeof orgFormSchema>;

export function OrganizationSettingsForm() {
  const firestore = useFirestore();
  const storage = useStorage();
  const auth = useAuth();
  const { toast } = useToast();
  const { userProfile } = useUserProfile();
  const { organization, isLoading: isLoadingOrg } = useOrganization();
  const organizationId = userProfile?.organizationId;

  // State for logo upload
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const form = useForm<OrgFormValues>({
    resolver: zodResolver(orgFormSchema),
  });

  useEffect(() => {
    if (organization) {
      form.reset({ name: organization.name });
      if (organization.logoUrl) {
          setPreviewUrl(organization.logoUrl);
      }
    }
  }, [organization, form]);
  
  useEffect(() => {
    // When a new file is selected, create a preview URL
    if (logoFile) {
        const objectUrl = URL.createObjectURL(logoFile);
        setPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    } else if (organization?.logoUrl) {
        setPreviewUrl(organization.logoUrl);
    } else {
        setPreviewUrl(null);
    }
  }, [logoFile, organization]);


  const orgDocRef = useMemoFirebase(() =>
    (firestore && organizationId) ? doc(firestore, `organizations`, organizationId) : null
  , [firestore, organizationId]);

  const onNameSubmit = async (data: OrgFormValues) => {
    if (!orgDocRef || !auth || !organizationId) return;

    updateDocumentNonBlocking(firestore, auth, organizationId, orgDocRef, { name: data.name }, data.name);
    
    toast({
      title: 'Organization Name Updated',
      description: 'Your organization name has been successfully updated.',
    });
  }
  
  const handleLogoUpload = () => {
    if (!logoFile || !orgDocRef || !auth || !organizationId) return;

    setUploadProgress(0);
    const storageRef = ref(storage, `organizations/${organizationId}/branding/logo`);
    const uploadTask = uploadBytesResumable(storageRef, logoFile);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Logo upload failed:", error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
        setUploadProgress(null);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            updateDocumentNonBlocking(firestore, auth, organizationId, orgDocRef, { logoUrl: downloadURL }, "Organization Logo");
            toast({ title: 'Logo Uploaded', description: 'Your new logo has been saved.' });
            setUploadProgress(null);
            setLogoFile(null);
        });
      }
    );
  }

  const handleAiToggle = (enabled: boolean) => {
    if (!orgDocRef || !auth || !organizationId) return;
    updateDocumentNonBlocking(firestore, auth, organizationId, orgDocRef, { aiEnabled: enabled }, "AI Feature Setting");
    toast({
        title: 'AI Settings Updated',
        description: `AI features have been ${enabled ? 'enabled' : 'disabled'}.`,
    });
  }
  
  if (isLoadingOrg) {
    return (
      <div className="space-y-6">
        <Card>
            <CardHeader><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-full mt-2" /></CardHeader>
            <CardContent><Skeleton className="h-10 w-1/2" /></CardContent>
            <CardFooter className="border-t px-6 py-4"><Skeleton className="h-10 w-24" /></CardFooter>
        </Card>
         <Card>
            <CardHeader><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-full mt-2" /></CardHeader>
            <CardContent><Skeleton className="h-12 w-full" /></CardContent>
        </Card>
        <Card>
            <CardHeader><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-full mt-2" /></CardHeader>
            <CardContent><Skeleton className="h-48 w-full" /></CardContent>
            <CardFooter className="border-t px-6 py-4"><Skeleton className="h-10 w-28" /></CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <>
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onNameSubmit)}>
          <CardHeader>
            <CardTitle>Organization Name</CardTitle>
            <CardDescription>Update your organization's name.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Organization Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting ? 'Saving...' : 'Save Name'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>

    <Card>
        <CardHeader>
            <CardTitle>AI Features</CardTitle>
            <CardDescription>
                Enable or disable AI-powered features like content generation and analysis. This may require a separate subscription or API key.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                    <Label htmlFor="ai-switch">Enable AI Assistant</Label>
                </div>
                <Switch
                    id="ai-switch"
                    checked={organization?.aiEnabled || false}
                    onCheckedChange={handleAiToggle}
                />
            </div>
        </CardContent>
      </Card>

    <Card>
        <CardHeader>
            <CardTitle>Organization Logo</CardTitle>
            <CardDescription>Update your logo. It will be displayed in the sidebar. Recommended size: 128x128px.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="flex flex-col items-center justify-center w-full">
                <label htmlFor="logo-file-upload" className="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                    {previewUrl ? (
                         <Image src={previewUrl} alt="Logo preview" fill className="object-contain p-4 rounded-lg" />
                    ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                            <p className="text-sm text-center text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag</p>
                        </div>
                    )}
                    <Input id="logo-file-upload" type="file" accept="image/png, image/jpeg, image/gif, image/svg+xml" className="hidden" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} disabled={uploadProgress !== null} />
                </label>
            </div>
            <div className="text-sm text-muted-foreground">
                Your logo helps personalize the application for your team. It appears in the top-left corner of the sidebar.
            </div>
        </CardContent>
        {uploadProgress !== null && (
            <CardContent>
                <Progress value={uploadProgress} className="w-full" />
            </CardContent>
        )}
        <CardFooter className="border-t px-6 py-4">
            <Button onClick={handleLogoUpload} disabled={!logoFile || uploadProgress !== null}>
              {uploadProgress !== null ? `Uploading...` : 'Save Logo'}
            </Button>
        </CardFooter>
    </Card>
    </>
  );
}
