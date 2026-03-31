'use client'

import { useSharedAuth } from '@/hooks/use-shared-auth'

export function useUserProfile() {
  const { user, isUserLoading, error } = useSharedAuth()

  const userProfile = user ? {
    uid: user.id,
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.userType === 'sole_trader' || user.userType === 'admin' ? 'Admin' : 'Staff',
    organizationId: user.activeEntityId,
    activeEntityId: user.activeEntityId,
  } : null

  return {
    userProfile,
    isAdmin: user?.userType === 'sole_trader' || user?.userType === 'admin',
    isLoading: isUserLoading,
    error,
  }
}
