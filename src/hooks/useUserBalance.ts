'use client';

import { useBalance } from '@/lib/balance/context';
import { useEffect } from 'react';

/**
 * Custom hook for accessing user balance data with automatic group selection
 * 
 * @param groupId - The current group ID to track balance for
 * @param options - Optional configuration options
 * @returns Balance state and utility functions
 */
export function useUserBalance(groupId: number | null, options: { skipSync?: boolean } = {}) {
  const { 
    balance, 
    isLoading, 
    error, 
    refetchBalance, 
    currentGroupId, 
    setCurrentGroupId 
  } = useBalance();

  const { skipSync } = options;

  // Update the current group ID when it changes
  useEffect(() => {
    if (!skipSync && groupId !== currentGroupId) {
      setCurrentGroupId(groupId);
    }
  }, [groupId, currentGroupId, setCurrentGroupId, skipSync]);

  return {
    // Balance data
    totalBalance: balance?.totalBalance ?? 0,
    blockedPoints: balance?.blockedPoints ?? 0,
    availableBalance: balance?.availableBalance ?? 0,
    lastUpdated: balance?.lastUpdated ?? new Date(),
    
    // Status
    isLoading,
    error,
    
    // Utilities
    refetchBalance,
    
    // Raw data
    balanceData: balance,
  };
} 