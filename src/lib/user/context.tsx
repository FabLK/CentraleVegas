'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSupabase } from '@/lib/supabase/context';

// Define types for our user data
export interface UserData {
  id: string;
  username: string;
  bio?: string | null;
  is_banned?: boolean;
  has_seen_onboarding?: boolean;
  // Add other user fields here as needed
  [key: string]: unknown; // Add index signature for compatibility with BaseUser
}

interface UserContextType {
  user: UserData | null;
  isLoading: boolean;
  error: Error | null;
  refreshUser: () => Promise<void>;
}

// Create context with default values
const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: true,
  error: null,
  refreshUser: async () => {},
});

// Custom hook for accessing user context
export function useUser() {
  return useContext(UserContext);
}

// Provider component
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [needsFetch, setNeedsFetch] = useState(false);
  const supabase = useSupabase();

  // Wait for auth to be ready
  useEffect(() => {
    // Only run this in browser
    if (typeof window === 'undefined') return;

    const timeout = setTimeout(() => {
      setAuthReady(true);
    }, 500); // Give Supabase time to hydrate auth state from storage

    return () => clearTimeout(timeout);
  }, []);

  // Function to fetch user data
  const fetchUserData = async () => {
    if (!authReady) {
      console.log('Auth not ready yet, waiting...');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // First, get the current session to ensure we're checking against latest auth state
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw sessionError;
      }

      if (!session?.user) {
        setUser(null);
        console.log('No session found, user is not authenticated');
        return;
      }

      const authUser = session.user;
      console.log('Session found, fetching user data for ID:', authUser.id);

      // Get the user data from our Users table
      const { data: userData, error: userError } = await supabase
        .from('Users')
        .select('id, username, bio, is_banned, has_seen_onboarding')
        .eq('id', authUser.id)
        .single();

      if (userError) {
        throw userError;
      }

      // Cache the user data and update last fetch time
      console.log('User data fetched successfully:', userData?.username);
      setUser(userData);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error fetching user data'));
    } finally {
      setIsLoading(false);
    }
  };

  // Function to refresh user data
  const refreshUser = async () => {
    await fetchUserData();
  };

  // Check for an active session when the component mounts and auth is ready
  useEffect(() => {
    if (!authReady) return;

    const checkSession = async () => {
      try {
        console.log('Checking for existing session...');
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('Session found during initial check');
          await fetchUserData();
        } else {
          console.log('No session found during initial check');
          setUser(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Session check error:', error);
        setUser(null);
        setIsLoading(false);
      }
    };

    checkSession();
  }, [supabase, authReady]);

  // Set up auth state change listener after initial session check
  useEffect(() => {
    if (!authReady) return;

    console.log('Setting up auth state change listener');
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      
      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
        case 'PASSWORD_RECOVERY':
          if (session) {
            setNeedsFetch(true);
          }
          break;
        case 'SIGNED_OUT':
          setUser(null);
          setIsLoading(false);
          break;
        default:
          console.log(`Unhandled auth event: ${event}`);
          break;
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [supabase, authReady]);

  // Then use a separate effect to handle the fetch
  useEffect(() => {
    if (needsFetch) {
      fetchUserData();
      setNeedsFetch(false);
    }
  }, [needsFetch]);

  return (
    <UserContext.Provider value={{ user, isLoading, error, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
} 