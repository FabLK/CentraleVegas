'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { Group } from '../../components/GroupsManager';
import { useSupabase } from '../supabase/context';

type GroupContextType = {
  currentGroupId: number | null;
  setCurrentGroupId: (id: number | null) => void;
  userGroups: Group[];
  setUserGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  loadUserGroups: (userId: string) => Promise<void>;
  isLoadingGroups: boolean;
};

const GroupContext = createContext<GroupContextType | undefined>(undefined);

// Helper functions to safely access localStorage
const getFromLocalStorage = (key: string): string | null => {
  try {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (error) {
    console.error('Error reading from localStorage:', error);
  }
  return null;
};

const setToLocalStorage = (key: string, value: string): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
};

const removeFromLocalStorage = (key: string): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error('Error removing from localStorage:', error);
  }
};

export function GroupProvider({ children }: { children: ReactNode }) {
  const [currentGroupId, setCurrentGroupId] = useState<number | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const supabase = useSupabase();

  // Load user groups from localStorage on mount
  useEffect(() => {
    // Load currentGroupId
    const savedGroupId = getFromLocalStorage('currentGroupId');
    if (savedGroupId) {
      // Handle the 'none' case explicitly
      if (savedGroupId === 'none') {
        setCurrentGroupId(null);
      } else {
        // Only parse as number if it's not 'none'
        const groupIdNumber = Number(savedGroupId);
        // Set to null if parsing results in NaN (e.g., invalid value stored)
        setCurrentGroupId(isNaN(groupIdNumber) ? null : groupIdNumber);
      }
    }

    // Load cached groups
    const savedGroups = getFromLocalStorage('userGroups');
    if (savedGroups) {
      try {
        const parsedGroups = JSON.parse(savedGroups);
        setUserGroups(parsedGroups);
      } catch (error) {
        console.error('Error parsing saved groups:', error);
        // Clear invalid data
        removeFromLocalStorage('userGroups');
      }
    }
  }, []);

  // Save currentGroupId to localStorage whenever it changes
  const handleSetCurrentGroupId = (id: number | null) => {
    setCurrentGroupId(id);
    if (id) {
      setToLocalStorage('currentGroupId', id.toString());
    } else {
      // When explicitly setting to null, store a special value instead of removing
      setToLocalStorage('currentGroupId', 'none');
    }
  };

  // Save userGroups to localStorage whenever they change
  useEffect(() => {
    if (userGroups.length > 0) {
      setToLocalStorage('userGroups', JSON.stringify(userGroups));
    } else {
      removeFromLocalStorage('userGroups');
    }
  }, [userGroups]);

  // Function to load user groups from the database and cache them
  const loadUserGroups = useCallback(async (userId: string) => {
    if (!userId) return;
    
    try {
      setIsLoadingGroups(true);
      
      // Get user memberships
      const { data: memberships, error: membershipError } = await supabase
        .from('UsersGroupMembership')
        .select('group')
        .eq('user', userId);
      
      if (membershipError) throw membershipError;
      
      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map(m => m.group);
        
        // Fetch group details
        const { data: groupsData, error: groupsError } = await supabase
          .from('Group')
          .select('id, name, created_at, created_by, is_publicly_joinable, description')
          .in('id', groupIds);
          
        if (groupsError) throw groupsError;

        // Fetch member counts for each group
        const groupCountsMap: { [key: number]: number } = {};
        for (const groupId of groupIds) {
          const { count, error: countError } = await supabase 
            .from('UsersGroupMembership')
            .select('*', { count: 'exact', head: true }) 
            .eq('group', groupId);

          if (countError) {
            console.warn(`Could not fetch count for group ${groupId}:`, countError);
            groupCountsMap[groupId] = 0;
          } else {
            groupCountsMap[groupId] = count ?? 0;
          }
        }

        // Combine group data with member counts
        const groupsWithCounts = groupsData.map(group => ({
          ...group,
          memberCount: groupCountsMap[group.id] ?? 0,
        }));
        
        // Sort groups alphabetically
        const sortedGroups = [...groupsWithCounts].sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        
        // Update state and cache
        setUserGroups(sortedGroups);
        
        // Check for saved group ID in localStorage
        const savedGroupId = getFromLocalStorage('currentGroupId');
        
        // If user explicitly selected "none", respect that choice
        if (savedGroupId === 'none') {
          setCurrentGroupId(null);
        }
        // If there's a valid saved group ID and it exists in the user's groups, use it
        else if (savedGroupId && savedGroupId !== 'none') {
          const groupIdNumber = Number(savedGroupId);
          const groupExists = sortedGroups.some(group => group.id === groupIdNumber);
          
          if (groupExists) {
            setCurrentGroupId(groupIdNumber);
          } else {
            // If saved group no longer exists, default to first group
            setCurrentGroupId(sortedGroups.length > 0 ? sortedGroups[0].id : null);
          }
        } 
        // Otherwise, if no group is selected and we have groups, select the first one
        else if (sortedGroups.length > 0 && !currentGroupId) {
          setCurrentGroupId(sortedGroups[0].id);
        }
      } else {
        setUserGroups([]);
        setCurrentGroupId(null);
      }
    } catch (error) {
      console.error('Error fetching user groups:', error);
      setUserGroups([]);
      setCurrentGroupId(null);
    } finally {
      setIsLoadingGroups(false);
    }
  }, [supabase, currentGroupId]);

  return (
    <GroupContext.Provider value={{ 
      currentGroupId, 
      setCurrentGroupId: handleSetCurrentGroupId,
      userGroups,
      setUserGroups,
      loadUserGroups,
      isLoadingGroups
    }}>
      {children}
    </GroupContext.Provider>
  );
}

export function useGroup() {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error('useGroup must be used within a GroupProvider');
  }
  return context;
} 