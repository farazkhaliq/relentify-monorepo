'use client';

import { useState, useEffect, createContext, useContext } from 'react';

interface SharedUser {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  userType: string;
  activeEntityId: string | null;
  organizationId: string | null;
}

interface SharedAuthContextType {
  user: SharedUser | null;
  isUserLoading: boolean;
  error: any;
  refresh: () => Promise<void>;
}

const SharedAuthContext = createContext<SharedAuthContextType | undefined>(undefined);

export function SharedAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SharedUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  async function fetchUser() {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to fetch shared user:', err);
      setError(err);
      setUser(null);
    } finally {
      setIsUserLoading(false);
    }
  }

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <SharedAuthContext.Provider value={{ user, isUserLoading, error, refresh: fetchUser }}>
      {children}
    </SharedAuthContext.Provider>
  );
}

export function useSharedAuth() {
  const context = useContext(SharedAuthContext);
  if (context === undefined) {
    throw new Error('useSharedAuth must be used within a SharedAuthProvider');
  }
  return context;
}
