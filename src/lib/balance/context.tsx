'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSupabase } from '@/lib/supabase/context';
import { useUser } from '@/lib/user/context';

// Define the shape of the balance data
export interface BalanceData {
  totalBalance: number;
  blockedPoints: number;
  availableBalance: number;
  lastUpdated: Date;
}

// Define the shape of the context
interface BalanceContextType {
  balance: BalanceData | null;
  isLoading: boolean;
  error: Error | null;
  refetchBalance: () => Promise<void>;
  currentGroupId: number | null;
  setCurrentGroupId: (groupId: number | null) => void;
}

// Create context with default values
const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

// Provider component
export function BalanceProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentGroupId, setCurrentGroupId] = useState<number | null>(null);
  
  const supabase = useSupabase();
  const { user } = useUser();

  // Function to fetch balance data
  const fetchBalance = async () => {
    if (!user?.id || !currentGroupId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get user's current balance for this group
      const { data: pointsHistory, error: pointsError } = await supabase
        .from('PointsHistory')
        .select('amount')
        .eq('user', user.id)
        .eq('group', currentGroupId)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (pointsError) {
        throw new Error(`Error fetching points history: ${pointsError.message}`);
      }

      // If no points history, user has 0 balance
      const totalBalance = pointsHistory && pointsHistory.length > 0 
        ? pointsHistory[0].amount 
        : 0;
      
      // Get points blocked in active bets for this group
      const { data: activeBets, error: activeBetsError } = await supabase
        .from('Bets')
        .select(`
          amount,
          game,
          BettingGame!Bets_game_fkey(decided_at, group)
        `)
        .eq('user', user.id);

      if (activeBetsError) {
        throw new Error(`Error fetching active bets: ${activeBetsError.message}`);
      }

      // Calculate blocked points for this group
      const blockedPoints = activeBets
        .filter(bet => {
          // Access the first element if BettingGame is an array, otherwise use as is
          const gameData = Array.isArray(bet.BettingGame) ? bet.BettingGame[0] : bet.BettingGame;
          // Only count if game is not decided AND is in the current group
          return gameData?.decided_at === null && gameData?.group === currentGroupId;
        })
        .reduce((sum, bet) => sum + bet.amount, 0);

      // Update balance state
      setBalance({
        totalBalance,
        blockedPoints,
        availableBalance: Math.max(0, totalBalance - blockedPoints),
        lastUpdated: new Date()
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      console.error('Error fetching balance:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Effect to fetch initial data when user or group changes
  useEffect(() => {
    fetchBalance();
  }, [user?.id, currentGroupId]);

  // Set up real-time subscription for PointsHistory changes
  useEffect(() => {
    if (!user?.id || !currentGroupId) return;

    // Subscribe to changes in the PointsHistory table for this user and group
    const pointsHistoryChannel = supabase
      .channel(`balance-points-${user.id}-${currentGroupId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'PointsHistory',
          filter: `user=eq.${user.id}`
        }, 
        (payload) => {
          // Check if this change is for the current group
          const newData = payload.new as { group?: number, amount?: number } | null;
          if (newData && typeof newData === 'object' && newData.group === currentGroupId) {
            // Directly update balance with the new amount
            setBalance(prev => {
              if (!prev) return prev;
              const totalBalance = newData.amount || 0;
              return {
                ...prev,
                totalBalance,
                availableBalance: Math.max(0, totalBalance - prev.blockedPoints),
                lastUpdated: new Date()
              };
            });
          }
        }
      )
      .subscribe();

    // Clean up subscription on unmount or when dependencies change
    return () => {
      supabase.removeChannel(pointsHistoryChannel);
    };
  }, [user?.id, currentGroupId, supabase]);

  // Set up real-time subscription for Bets changes that affect blocked points
  useEffect(() => {
    if (!user?.id || !currentGroupId) return;

    // Subscribe to changes in the Bets table for this user
    const betsChannel = supabase
      .channel(`balance-bets-${user.id}-${currentGroupId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'Bets',
          filter: `user=eq.${user.id}`
        }, 
        async (payload) => {
          // Get the game information for this bet
          const bet = payload.new as { amount?: number, game?: number } | null;
          if (!bet || !bet.game) return;
          
          const { data: gameData } = await supabase
            .from('BettingGame')
            .select('decided_at, group')
            .eq('id', bet.game)
            .single();
            
          // Only update if this game is in the current group and not decided
          if (gameData?.group === currentGroupId && gameData?.decided_at === null) {
            // Update blocked points based on the type of event
            setBalance(prev => {
              if (!prev) return prev;
              
              // Calculate new blocked points based on event type
              let blockedPointsDelta = 0;
              if (payload.eventType === 'INSERT') {
                blockedPointsDelta = bet.amount || 0;
              } else if (payload.eventType === 'DELETE') {
                blockedPointsDelta = -(bet.amount || 0);
              } else if (payload.eventType === 'UPDATE') {
                const oldBet = payload.old as { amount?: number } | null;
                blockedPointsDelta = (bet.amount || 0) - (oldBet?.amount || 0);
              }
              
              const newBlockedPoints = Math.max(0, prev.blockedPoints + blockedPointsDelta);
              
              return {
                ...prev,
                blockedPoints: newBlockedPoints,
                availableBalance: Math.max(0, prev.totalBalance - newBlockedPoints),
                lastUpdated: new Date()
              };
            });
          }
        }
      )
      .subscribe();

    // Clean up subscription on unmount or when dependencies change
    return () => {
      supabase.removeChannel(betsChannel);
    };
  }, [user?.id, currentGroupId, supabase]);

  // Monitor BettingGame decided_at changes to unblock points
  useEffect(() => {
    if (!currentGroupId || !user?.id) return;

    // Subscribe to changes in the BettingGame table for games in this group
    const gamesChannel = supabase
      .channel(`balance-games-${currentGroupId}`)
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'BettingGame',
          filter: `group=eq.${currentGroupId}`
        }, 
        async (payload) => {
          // If a game was decided (decided_at changed from null to a value)
          const oldData = payload.old as { decided_at: string | null, id: number } | null;
          const newData = payload.new as { decided_at: string | null, id: number } | null;
          
          if (oldData?.decided_at === null && newData?.decided_at !== null && newData?.id) {
            // Find user's bets in this game that are now unblocked
            const { data: unblockingBets } = await supabase
              .from('Bets')
              .select('amount')
              .eq('user', user.id)
              .eq('game', newData.id);
              
            const totalUnblocked = unblockingBets?.reduce((sum, bet) => sum + (bet.amount || 0), 0) || 0;
            
            // Update balance to reflect unblocked points
            setBalance(prev => {
              if (!prev) return prev;
              const newBlockedPoints = Math.max(0, prev.blockedPoints - totalUnblocked);
              return {
                ...prev,
                blockedPoints: newBlockedPoints,
                availableBalance: Math.max(0, prev.totalBalance - newBlockedPoints),
                lastUpdated: new Date()
              };
            });
          }
        }
      )
      .subscribe();

    // Clean up subscription on unmount or when dependencies change
    return () => {
      supabase.removeChannel(gamesChannel);
    };
  }, [currentGroupId, user?.id, supabase]);

  return (
    <BalanceContext.Provider 
      value={{ 
        balance, 
        isLoading, 
        error, 
        refetchBalance: fetchBalance,
        currentGroupId,
        setCurrentGroupId
      }}
    >
      {children}
    </BalanceContext.Provider>
  );
}

// Hook to use the balance context
export function useBalance() {
  const context = useContext(BalanceContext);
  if (context === undefined) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }
  return context;
} 