'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@relentify/ui";
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { ProfileSettingsForm } from '@/components/profile-settings-form';
import { PasswordSettingsForm } from '@/components/password-settings-form';
import { OrganizationSettingsForm } from '@/components/organization-settings-form';
import { UserManagement } from "@/components/settings/user-management";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@relentify/ui";
import { WorkflowSettings } from "@/components/settings/workflow-settings";
import { BankAccountSettings } from "@/components/settings/bank-account-settings";

export default function SettingsPage() {
    const { userProfile: currentUserProfile, isLoading: isCurrentUserLoading, isAdmin } = useUserProfile();

    if (isCurrentUserLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid gap-6">
                    <Card>
                        <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
                    </Card>
                    <Card>
                        <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
                    </Card>
                </div>
            </div>
        )
    }
    
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-semibold">Settings</h1>
            <Tabs defaultValue="profile" className="w-full">
                <TabsList className={cn("grid w-full", isAdmin ? "md:grid-cols-5" : "md:grid-cols-1")}>
                    <TabsTrigger value="profile">My Profile</TabsTrigger>
                    {isAdmin && <TabsTrigger value="organization">Organization</TabsTrigger>}
                    {isAdmin && <TabsTrigger value="users">User Management</TabsTrigger>}
                    {isAdmin && <TabsTrigger value="workflows">Workflows</TabsTrigger>}
                    {isAdmin && <TabsTrigger value="bank-accounts">Bank Accounts</TabsTrigger>}
                </TabsList>
                <TabsContent value="profile" className="mt-6">
                    <div className="grid gap-6">
                        {currentUserProfile && <ProfileSettingsForm userProfile={currentUserProfile} />}
                        <PasswordSettingsForm />
                    </div>
                </TabsContent>
                {isAdmin && (
                    <>
                        <TabsContent value="organization" className="mt-6">
                            <OrganizationSettingsForm />
                        </TabsContent>
                        <TabsContent value="users" className="mt-6">
                            <UserManagement />
                        </TabsContent>
                        <TabsContent value="workflows" className="mt-6">
                             <WorkflowSettings />
                        </TabsContent>
                         <TabsContent value="bank-accounts" className="mt-6">
                             <BankAccountSettings />
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    );
}
