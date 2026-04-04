'use client';

import { Button } from '@relentify/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@relentify/ui';
import { Input } from '@relentify/ui';
import { Label } from '@relentify/ui';

interface ProfileSettingsFormProps {
  userProfile: {
    id: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email: string;
  };
}

export function ProfileSettingsForm({ userProfile }: ProfileSettingsFormProps) {
  // Profile name is derived from fullName or firstName+lastName
  const displayName = userProfile.fullName || `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim();
  const nameParts = displayName.split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Profile</CardTitle>
        <CardDescription>Your personal information. To update your name, visit the auth portal.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>First Name</Label>
            <Input value={firstName} disabled />
          </div>
          <div className="grid gap-2">
            <Label>Last Name</Label>
            <Input value={lastName} disabled />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Email</Label>
          <Input type="email" value={userProfile.email} disabled />
          <p className="text-sm text-muted-foreground">You cannot change your email address.</p>
        </div>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button asChild variant="outline">
          <a href="https://auth.relentify.com/settings" target="_blank" rel="noopener noreferrer">
            Edit Profile on Auth Portal
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
