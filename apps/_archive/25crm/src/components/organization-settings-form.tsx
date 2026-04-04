'use client';

import { Button } from '@relentify/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@relentify/ui';
import { Input } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Label } from '@relentify/ui';
import { useOrganization } from '@/hooks/use-organization';

export function OrganizationSettingsForm() {
  const { organization, isLoading: isLoadingOrg } = useOrganization();

  if (isLoadingOrg) {
    return (
      <div className="space-y-6">
        <Card>
            <CardHeader><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-full mt-2" /></CardHeader>
            <CardContent><Skeleton className="h-10 w-1/2" /></CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Settings</CardTitle>
        <CardDescription>View your organization details. To make changes, contact your administrator.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label>Organization Name</Label>
          <Input value={organization?.name || 'My Organization'} disabled />
        </div>
        <p className="text-sm text-muted-foreground">
          Organization settings such as name, logo, and AI features are managed centrally. Contact support for changes.
        </p>
      </CardContent>
    </Card>
  );
}
