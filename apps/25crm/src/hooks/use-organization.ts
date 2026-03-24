'use client';

import { useUserProfile } from '@/hooks/use-user-profile';

export function useOrganization() {
  const { userProfile, isLoading: isLoadingProfile, error: profileError } = useUserProfile();

  const organization = userProfile?.organizationId ? {
    id: userProfile.organizationId,
    name: (userProfile as any).organizationName || 'My Organization',
    aiEnabled: true,
  } : null;

  return {
    organization,
    isLoading: isLoadingProfile,
    error: profileError,
  };
}
