'use client';

import { useUser } from '@/firebase';

export function useUserProfile() {
  const { user, isUserLoading, userError } = useUser();

  const userProfile = user ? {
    uid: user.uid,
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.userType === 'sole_trader' ? 'Admin' : 'User', // Mock role mapping
    organizationId: user.activeEntityId,
    activeEntityId: user.activeEntityId,
    organizationName: (user as any).organizationName,
  } : null;

  return {
    userProfile,
    isAdmin: user?.userType === 'sole_trader' || user?.userType === 'admin',
    isLoading: isUserLoading,
    error: userError,
  };
}

    