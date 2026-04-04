'use client';

import { Button } from '@relentify/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@relentify/ui';
import { ExternalLink } from 'lucide-react';

export function PasswordSettingsForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>Password management is handled by the Relentify Auth portal for security.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          To change your password, use the Auth portal. You can also use the forgot password flow if you need to reset it.
        </p>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <a href="https://auth.relentify.com/forgot-password" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Reset Password
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
