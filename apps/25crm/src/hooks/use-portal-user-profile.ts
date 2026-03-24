'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

interface PortalUserProfile {
    organizationId: string;
    contactId: string;
    email: string;
    firstName: string;
    lastName: string;
}

export function usePortalUserProfile() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const portalProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'portalUserProfiles', user.uid) : null),
    [firestore, user]
  );
  
  const { data: portalUserProfile, isLoading: isLoadingProfile, error: profileError } = useDoc<PortalUserProfile>(portalProfileRef);

  return {
    portalUserProfile,
    isLoading: isAuthLoading || isLoadingProfile,
    error: profileError,
  };
}
