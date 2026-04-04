'use client'

import { useUserProfile } from '@/hooks/use-user-profile'

export function useOrganization() {
  const { userProfile, isLoading, error } = useUserProfile()

  const organization = userProfile?.activeEntityId ? {
    id: userProfile.activeEntityId,
    name: 'My Organization',
    aiEnabled: true,
  } : null

  return {
    organization,
    isLoading,
    error,
  }
}
