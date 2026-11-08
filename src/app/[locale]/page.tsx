'use client';

import { BetCard } from '@/components/BetCard';
import { Bet } from '@/types/bet';
import Link from 'next/link';
import { useSupabase } from '@/lib/supabase/context';
import { useState, useEffect, useCallback } from 'react';
import { X, Filter, Search, Check, ChevronsUpDown,
  CircleDot, Clock, CheckCircle, User, Users, Eye, Gamepad2, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import CreateBetForm from '@/components/CreateBetForm';
import GroupsManager from '@/components/GroupsManager';
import { useGroup } from '@/lib/group/context'
import OnboardingAnimation from '@/components/OnboardingAnimation';
import { useUser } from '@/lib/user/context';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
// Import or declare the User interface that's used in other components
interface User {
  id: string;
  username: string;
}

// Define proper User interface that extends the basic User interface
interface AppUser extends User {
  [key: string]: unknown; // For any additional properties
}

export default function Home() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedFilterReferee, setSelectedFilterReferee] = useState<{id: string, username: string} | null>(null);
  const [isRefereeFilterOpen, setIsRefereeFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [referees, setReferees] = useState<{ id: string; username: string }[]>([]);
  
  // Add loading state for bets
  const [isLoadingBets, setIsLoadingBets] = useState(false);
  
  const supabase = useSupabase();
  const { currentGroupId, userGroups, loadUserGroups } = useGroup();
  const { user, isLoading, refreshUser } = useUser();
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Add state for status filter instead of badge filter
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);

  const { t } = useTranslation('home');
  
  // Define available status options
  const statusOptions = [
    { value: 'active', label: t('Actifs') },
    { value: 'expired', label: t('Expirés') },
    { value: 'decided', label: t('Terminés') }
  ];

  // Add state for tracking recent games count
  const [recentGamesCount, setRecentGamesCount] = useState(0);

  // Add state to track if the current user is banned
  const [isUserBanned, setIsUserBanned] = useState(false);

  // Add new state variable to track games where user is referee
  const [userRefereeGames, setUserRefereeGames] = useState<string[]>([]);

  // Add state for participation filter
  const [participationFilter, setParticipationFilter] = useState<string | null>(null);
  const [isParticipationFilterOpen, setIsParticipationFilterOpen] = useState(false);
  
  // Define participation filter options with clearer labels
  const participationOptions = [
    { value: 'played', label: t('Mes paris') },
    { value: 'not-played', label: t('Non joués') },
  ];


  // Add state to track the most recently added game
  const [mostRecentGameId, setMostRecentGameId] = useState<string | null>(null);

  const router = useRouter();

  const fetchReferees = useCallback(async (search: string) => {
    // Only fetch referees if we have a current group
    if (!currentGroupId) {
      setReferees([]);
      return;
    }

    // First, get all unique referee IDs from games in the current group
    const { data: games, error: gamesError } = await supabase
      .from('BettingGame')
      .select('referee')
      .eq('group', currentGroupId);

    if (gamesError) {
      setReferees([]);
      return;
    }

    // Get unique referee IDs
    const refereeIds = [...new Set(games.map(game => game.referee))];

    if (refereeIds.length === 0) {
      setReferees([]);
      return;
    }

    // Now fetch user details for these referees, filtered by search term
    const { data, error } = await supabase
      .from('Users')
      .select('id, username')
      .in('id', refereeIds)
      .ilike('username', `%${search}%`)
      .limit(5);

    setReferees(error ? [] : (data || []));
  }, [currentGroupId, supabase]);

  // Check if user has seen onboarding
  useEffect(() => {
    // Skip if user is loading or not available
    if (isLoading || !user) return;
    
    // Check onboarding status from user context
    setShowOnboarding(!user.has_seen_onboarding);
  }, [user, isLoading]);

  // Load user groups when user is available from context
  useEffect(() => {
    if (user) {
      loadUserGroups(user.id);
    }
  }, [user, loadUserGroups]);

  // Check if user is banned
  useEffect(() => {
    if (!user) return;
    
    setIsUserBanned(!!user.is_banned);
  }, [user]);

  // Replace checkRefereeStatus to use user from context
  const checkRefereeStatus = useCallback(async () => {
    if (!user || !currentGroupId) return;

    const { data: games, error } = await supabase
      .from('BettingGame')
      .select('id, referee, deadline, decided_at')
      .eq('group', currentGroupId);

    if (error) return;

    const userIsRefereeGameIds = games
      .filter(game => 
        game.referee === user.id && 
        !game.decided_at && 
        new Date(game.deadline) < new Date()
      )
      .map(game => game.id);

    setUserRefereeGames(userIsRefereeGameIds);
  }, [currentGroupId, supabase, user, setUserRefereeGames]);

  // Add useEffect to check referee status when user or group changes
  useEffect(() => {
    checkRefereeStatus();
  }, [checkRefereeStatus]);

  // Memoize fetchBets with useCallback
  const fetchBets = useCallback(async () => {
    // Only fetch bets if a group is selected
    if (!currentGroupId) {
      setBets([]);
      return;
    }
    
    setIsLoadingBets(true);
    
    let query = supabase
      .from('BettingGame')
      .select(`
        id,
        title,
        deadline,
        created_at,
        decided_at,
        referee,
        group,
        BettingOption (
          id,
          title,
          is_winning,
          Bets (
            id,
            user,
            amount,
            created_at
          )
        )
      `)
      .eq('group', currentGroupId);
    
    // Apply referee filter if selected
    if (selectedFilterReferee) {
      query = query.eq('referee', selectedFilterReferee.id);
    }
    
    // Apply title search filter if query exists
    if (searchQuery.trim()) {
      query = query.ilike('title', `%${searchQuery}%`);
    }
    
    const { data: games, error } = await query;

    if (error) return;

    // Count games created in the last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentGames = games.filter(game => new Date(game.created_at) > last24Hours);
    setRecentGamesCount(recentGames.length);

    const transformedBets: Bet[] = games.map(game => {
      const isExpired = new Date(game.deadline) < new Date();
      const isDecided = game.decided_at !== null;
      const totalPoints = game.BettingOption.reduce((sum, option) => 
        sum + option.Bets.reduce((betSum, bet) => betSum + bet.amount, 0), 0);

      // Check for recent bets (last hour)
      const recentBets = game.BettingOption.flatMap(opt => 
        opt.Bets.filter(bet => 
          new Date(bet.created_at) > new Date(Date.now() - 60 * 60 * 1000)
        )
      );

      // Check if game was created in the last 1 hour or has no bets
      const isNewGame = new Date(game.created_at) > new Date(Date.now() - 1 * 60 * 60 * 1000) || totalPoints === 0;

      // Check if there are any large bets (over 1000 points)
      const hasWhalebet = game.BettingOption.some(opt => 
        opt.Bets.some(bet => bet.amount >= 1000)
      );

      // Check if game has competitive betting (close percentages between options)
      const optionPercentages = game.BettingOption.map(opt => {
        const optionPoints = opt.Bets.reduce((sum, bet) => sum + bet.amount, 0);
        return totalPoints > 0 ? (optionPoints / totalPoints) : 0;
      });
      
      const isCompetitive = optionPercentages.length >= 2 && 
        Math.abs(optionPercentages[0] - optionPercentages[1]) < 0.1 && // Within 10%
        optionPercentages[0] > 0.2; // At least 20% on leading option

      // Add a flag to identify if the current user participated in this bet
      const userParticipated = user ? game.BettingOption.some(option => 
        option.Bets.some(bet => bet.user === user.id)
      ) : false;

      return {
        id: game.id,
        title: game.title,
        description: '',
        totalBettors: new Set(game.BettingOption.flatMap(opt => opt.Bets.map(bet => bet.user))).size,
        totalPoints,
        timeSlots: game.BettingOption.map(option => {
          const optionPoints = option.Bets.reduce((sum, bet) => sum + bet.amount, 0);
          return {
            time: option.title,
            betCount: option.Bets.length,
            percentage: totalPoints > 0 ? Math.round((optionPoints / totalPoints) * 100) : 0,
            points: optionPoints,
            isWinner: isDecided && option.is_winning
          };
        }),
        recentActivity: recentBets.length,
        endDate: game.deadline,
        status: isDecided ? 'decided' : (isExpired ? 'expired' : 'active'),
        isExpired,
        isDecided,
        decidedAt: game.decided_at,
        isNewGame,
        hasWhalebet,
        isCompetitive,
        createdAt: game.created_at,
        userParticipated,
        isUserReferee: userRefereeGames.includes(game.id),
      };
    });

    // Filter by status if selected
    let filteredBets = transformedBets;
    if (selectedStatus) {
      filteredBets = transformedBets.filter(bet => bet.status === selectedStatus);
    }

    // Apply participation filter if selected
    if (participationFilter === 'played' && user) {
      filteredBets = filteredBets.filter(bet => bet.userParticipated);
    } else if (participationFilter === 'not-played' && user) {
      filteredBets = filteredBets.filter(bet => !bet.userParticipated);
    }

    // Filter out expired/decided bets with no bettors before separating
    filteredBets = filteredBets.filter(bet => 
      bet.totalBettors > 0 || (!bet.isExpired && !bet.isDecided)
    );

    // 1. Separate bets into categories
    // Expired games without decision
    const expiredNotDecided = filteredBets.filter(bet => bet.isExpired && !bet.isDecided);
    // Active games
    const activeBets = filteredBets.filter(bet => !bet.isExpired && !bet.isDecided);
    // Decided games
    const decidedBets = filteredBets.filter(bet => bet.isDecided);

    // 2. Sort each category
    // Sort expired games by waiting time (oldest deadline first)
    expiredNotDecided.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

    // Change the sorting logic for active bets to display new ones first
    // Instead of sorting by total points first, sort primarily by creation time
    activeBets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const topActiveBets = activeBets.slice(0, 3); // These are now the 3 newest bets
    const remainingActiveBets = activeBets.slice(3);

    // No need for additional sorting of remainingActiveBets since they're already sorted by creation time

    // Sort decided games by decision time (most recent first)
    decidedBets.sort((a, b) => {
      if (a.decidedAt && b.decidedAt) {
        return new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime();
      }
      return 0;
    });

    // 3. Combine in the requested order
    const orderedBets = [
      ...expiredNotDecided,
      ...topActiveBets,
      ...remainingActiveBets,
      ...decidedBets
    ];

    // Find maximums for active bets (for the badges)
    const maxActiveBettors = Math.max(...activeBets.map(b => b.totalBettors));
    const maxActivePoints = Math.max(...activeBets.map(b => b.totalPoints));

    // Find maximums for inactive bets
    const inactiveBets = [...expiredNotDecided, ...decidedBets];
    const maxInactiveBettors = Math.max(...inactiveBets.map(b => b.totalBettors));
    const maxInactivePoints = Math.max(...inactiveBets.map(b => b.totalPoints));

    // Get all bet amounts for whale calculation
    const allBets = games.flatMap(game => 
      game.BettingOption.flatMap(opt => opt.Bets.map(bet => bet.amount))
    ).sort((a, b) => b - a); // Sort in descending order

    // Calculate whale threshold (95th percentile)
    const whaleThreshold = allBets.length > 0 
      ? allBets[Math.floor(allBets.length * 0.02)] // Get the value at 5th percentile from top
      : 0;

    // Update flags for each bet
    orderedBets.forEach(bet => {
      if (bet.isExpired || bet.isDecided) {
        // Inactive bets
        bet.isMostPopular = maxInactiveBettors > 0 && bet.totalBettors === maxInactiveBettors;
        bet.isHighestStakes = maxInactivePoints > 0 && bet.totalPoints === maxInactivePoints;
      } else {
        // Active bets
        bet.isMostPopular = maxActiveBettors > 0 && bet.totalBettors === maxActiveBettors;
        bet.isHighestStakes = maxActivePoints > 0 && bet.totalPoints === maxActivePoints;
      }
      
      // Find the game this bet corresponds to
      const game = games.find(g => g.id === bet.id);
      
      // Update whale detection to check individual bet amounts against threshold
      bet.hasWhalebet = game?.BettingOption.some(opt => 
        opt.Bets.some(bet => bet.amount >= whaleThreshold && whaleThreshold > 0)
      ) || false;
    });

    // After processing all the bet data and before setting state:
    // If we have a mostRecentGameId and it's already in the list, no need to update state again
    if (mostRecentGameId && orderedBets.some(bet => bet.id === mostRecentGameId)) {
      setMostRecentGameId(null); // Reset after we've handled it
    }
    
    setBets(orderedBets);
    setIsLoadingBets(false);
  }, [supabase, selectedFilterReferee, selectedStatus, searchQuery, participationFilter, mostRecentGameId, currentGroupId]);


  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  // Add useEffect to detect mobile screen size
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint is 640px in Tailwind
    };
    
    // Initial check
    checkIfMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Add handler for opening the referee filter
  const handleRefereeFilterOpenChange = (open: boolean) => {
    if (open) {
      // Fetch all referees when opening the dropdown (empty search string)
      fetchReferees('');
    }
    setIsRefereeFilterOpen(open);
  };

  // Add handler for referee filter selection
  const handleRefereeFilterSelect = (currentValue: string) => {
    const selectedReferee = referees.find(r => r.username === currentValue);
    if (selectedReferee) {
      setSelectedFilterReferee(selectedReferee);
    }
    setIsRefereeFilterOpen(false);
  };

  // Add a new function to clear all filters
  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedStatus(null);
    setSelectedFilterReferee(null);
    setParticipationFilter(null);
  };

  // Create a shared form component to avoid duplication
  const createBetForm = (
    <CreateBetForm 
      selectedGroupId={currentGroupId} 
      onSuccess={fetchBets}
      onCancel={() => setIsDialogOpen(false)}
      isMobile={isMobile}
    />
  );

  // Modify the useEffect for real-time updates to include bet changes
  useEffect(() => {
    // Skip if not authenticated or banned
    if (isUserBanned) return;
    
    // Only subscribe if a group is selected
    if (!currentGroupId) return;
    
    const channel = supabase
      .channel(`betting-games-updates-${currentGroupId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'BettingGame',
          filter: `group=eq.${currentGroupId}`
        }, 
        async (payload) => {
          // Get data about the newly created game
          const newGameId = payload.new.id;
          
          // Store the most recent game ID to avoid duplicates when we refresh
          setMostRecentGameId(newGameId);
          
          // Fetch fresh data to include the new game
          await fetchBets();
          
          // Don't show toast if user is the creator (check created_by field)
          if (user && payload.new.created_by === user.id) {
            return;
          }
          
          // Add a clickable toast notification
          toast(
            <div 
              className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => router.push(`/bet/${newGameId}`)}
            >
              <Gamepad2 className="h-5 w-5 text-green-500" />
              <div className="flex flex-col">
                <span className="font-medium">
                  Nouveau pari disponible
                </span>
                <span className="text-sm text-muted-foreground line-clamp-1">
                  {payload.new.title}
                </span>
              </div>
            </div>,
            {
              className: "new-game-notification interactive-toast",
              duration: 5000,
            }
          );
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'BettingGame',
        },
        async (payload) => {
          // Check if this is a decision update (decided_at changed from null to a value)
          if (payload.old.decided_at === null && payload.new.decided_at !== null) {
            // Refresh bets to update the UI
            await fetchBets();
            
            // Show toast notification for game decision
            toast(
              <div 
                className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => router.push(`/bet/${payload.new.id}`)}
              >
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div className="flex flex-col">
                  <span className="font-medium">
                    Pari terminé
                  </span>
                  <span className="text-sm text-muted-foreground line-clamp-1">
                    {payload.new.title}
                  </span>
                </div>
              </div>,
              {
                duration: 5000,
              }
            );
          }
          
          // Check if the game just expired (deadline passed)
          const now = new Date();
          const oldDeadline = new Date(payload.old.deadline);
          const newDeadline = new Date(payload.new.deadline);
          
          if (oldDeadline > now && newDeadline <= now) {
            // Refresh bets to update the UI
            await fetchBets();
            
            // Show toast notification for game expiration
            toast(
              <div 
                className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => router.push(`/bet/${payload.new.id}`)}
              >
                <Clock className="h-5 w-5 text-yellow-500" />
                <div className="flex flex-col">
                  <span className="font-medium">
                    Pari expiré
                  </span>
                  <span className="text-sm text-muted-foreground line-clamp-1">
                    {payload.new.title}
                  </span>
                </div>
              </div>,
              {
                duration: 5000,
              }
            );
          }
        }
      )
      // Add new subscription for bet changes
      .on('postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'Bets',
        },
        async () => {
          // Refresh bets to recalculate badges
          await fetchBets();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [supabase, isUserBanned, fetchBets, router, currentGroupId, user]); // Added user to dependencies

  // Update the useEffect to clear bets and handle loading state when currentGroupId changes
  useEffect(() => {
    if (currentGroupId) {
      fetchBets();
    } else {
      setBets([]);
    }
  }, [fetchBets, currentGroupId]);

  const handleOnboardingComplete = async () => {
    // Refresh user data to get the updated has_seen_onboarding flag
    await refreshUser();
    setShowOnboarding(false);
  };

  // Add loading indicator component
  const loadingIndicator = (
    <div className="col-span-full flex justify-center items-center py-10">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );

  

  return (
    <>
      {user && showOnboarding && (
        <OnboardingAnimation 
          userId={user.id} 
          onComplete={handleOnboardingComplete} 
        />
      )}
      
      <div className="container mx-auto py-4 sm:py-8 px-4 sm:px-6 bg-gray-50/30">
        {/* Group tabs - Use type assertion for compatible types */}
        <GroupsManager 
          user={user as AppUser}
          isMobile={isMobile}
        />

        {/* Only show bets section if a currentGroupId exists AND userGroups has items */}
        {currentGroupId && userGroups && userGroups.length > 0 && (
          <>
            {/* Desktop content - Keep this section */}
            <div className="hidden sm:block">              
              {/* Filters section */}
              <div className="mb-8">
                {/* Filter heading with toggle for mobile */}
                <div className="flex justify-between items-center mb-3">
                  {/* Only show this on desktop */}
                  <h2 className="text-lg font-medium items-center hidden sm:flex">

                    {(searchQuery || selectedStatus || selectedFilterReferee || participationFilter) && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({bets.length} {t('résultats')})
                      </span>
                    )}
                  </h2>
                  
                  {/* Mobile view: Just show results count */}
                  <div className="sm:hidden flex w-full">
                    {(searchQuery || selectedStatus || selectedFilterReferee || participationFilter) && (
                      <span className="text-sm text-muted-foreground self-center">
                        ({bets.length} {t('résultats')})
                      </span>
                    )}
                  </div>
                </div>

                {/* Active filters chips/badges */}
                {(searchQuery || selectedStatus || selectedFilterReferee || participationFilter) && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {searchQuery && (
                      <div className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium shadow-md transition-all focus:outline-none border-primary/30 bg-primary/8 text-primary hover:bg-primary/15 hover:shadow-lg backdrop-blur-sm">
                        <Search className="h-3 w-3 mr-1" /> &apos;{searchQuery}&apos;
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    
                    {selectedStatus && (
                      <div className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium shadow-md transition-all focus:outline-none border-primary/30 bg-primary/8 text-primary hover:bg-primary/15 hover:shadow-lg backdrop-blur-sm">
                        {selectedStatus === 'active' ? <CircleDot className="h-3 w-3 mr-1" /> : 
                         selectedStatus === 'expired' ? <Clock className="h-3 w-3 mr-1" /> : 
                         <CheckCircle className="h-3 w-3 mr-1" />}
                        {statusOptions.find(s => s.value === selectedStatus)?.label}
                        <button 
                          onClick={() => setSelectedStatus(null)}
                          className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    
                    {participationFilter && (
                      <div className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium shadow-md transition-all focus:outline-none border-primary/30 bg-primary/8 text-primary hover:bg-primary/15 hover:shadow-lg backdrop-blur-sm">
                        <User className="h-3 w-3 mr-1" />
                        {participationOptions.find(p => p.value === participationFilter)?.label}
                        <button 
                          onClick={() => setParticipationFilter(null)}
                          className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    
                    {selectedFilterReferee && (
                      <div className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium shadow-md transition-all focus:outline-none border-primary/30 bg-primary/8 text-primary hover:bg-primary/15 hover:shadow-lg backdrop-blur-sm">
                        <Scale className="h-3 w-3 mr-1" />
                        Arbitre: {selectedFilterReferee.username}
                        <button 
                          onClick={() => setSelectedFilterReferee(null)}
                          className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    
                    <button 
                      onClick={clearAllFilters}
                      className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm shadow-md transition-all focus:outline-none border-muted/50 bg-muted/30 hover:bg-muted/50 hover:text-accent-foreground hover:shadow-lg backdrop-blur-sm"
                    >
                      {t('Effacer tout')}
                    </button>
                  </div>
                )}

                {/* Filter controls - responsive design */}
                <div className="grid gap-3 transition-all duration-300 ease-in-out grid-rows-[1fr]">
                  <div className="overflow-visible transition-all duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 py-2">
                      {/* Search bar */}
                      <div className="relative flex-1">
                        <div className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 z-10 pointer-events-none">
                          <Search className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Input
                          placeholder={t('Rechercher un pari...')}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 w-full pr-8 h-10 focus-visible:ring-offset-2 border-input/40 shadow-md rounded-xl bg-white/70 backdrop-blur-sm hover:shadow-lg focus:shadow-lg transition-all duration-200"
                        />
                        {searchQuery && (
                          <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      
                      {/* Participation filter */}
                      <div className="w-full">
                        <Popover 
                          open={isParticipationFilterOpen} 
                          onOpenChange={setIsParticipationFilterOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isParticipationFilterOpen}
                              className="w-full h-10 justify-between relative shadow-md border-input/40 hover:border-input/60 focus-visible:ring-offset-2 hover:shadow-lg transition-all duration-200 rounded-xl bg-white/70 backdrop-blur-sm"
                            >
                              <div className="flex items-center truncate">
                                <User className="h-4 w-4 mr-2" />
                                {participationFilter 
                                  ? participationOptions.find(p => p.value === participationFilter)?.label 
                                  : t('Participation')}
                              </div>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              {participationFilter && (
                                <div className="absolute right-9 w-2 h-2 rounded-full bg-primary"></div>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-2xl border border-input/30 z-50 rounded-2xl bg-white/90 backdrop-blur-md" sideOffset={8} align="start">
                            <Command>
                              <CommandList>
                                <CommandGroup>
                                  <CommandItem
                                    onSelect={() => {
                                      setParticipationFilter(null);
                                      setIsParticipationFilterOpen(false);
                                    }}
                                    className="hover:bg-muted/80"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        participationFilter === null ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <Users className="h-4 w-4 mr-2" />
                                    {t('Tous les paris')}
                                  </CommandItem>
                                  {participationOptions.map((option) => (
                                    <CommandItem
                                      key={option.value}
                                      value={option.value}
                                      onSelect={(value) => {
                                        setParticipationFilter(value);
                                        setIsParticipationFilterOpen(false);
                                      }}
                                      className="hover:bg-muted/40 rounded-lg mx-1 transition-colors duration-150"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          participationFilter === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {option.value === 'played' ? <Gamepad2 className="h-4 w-4 mr-2" /> : 
                                       option.value === 'not-played' ? <Eye className="h-4 w-4 mr-2" /> : 
                                       <Users className="h-4 w-4 mr-2" />}
                                      {option.label}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Status filter */}
                      <div className="w-full">
                        <Popover 
                          open={isStatusFilterOpen} 
                          onOpenChange={setIsStatusFilterOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isStatusFilterOpen}
                              className="w-full h-10 justify-between relative shadow-md border-input/40 hover:border-input/60 focus-visible:ring-offset-2 hover:shadow-lg transition-all duration-200 rounded-xl bg-white/70 backdrop-blur-sm"
                            >
                              <div className="flex items-center truncate">
                                {selectedStatus === 'active' ? <CircleDot className="h-4 w-4 mr-2" /> : 
                                 selectedStatus === 'expired' ? <Clock className="h-4 w-4 mr-2" /> : 
                                 selectedStatus === 'decided' ? <CheckCircle className="h-4 w-4 mr-2" /> : 
                                 <Filter className="h-4 w-4 mr-2" />}
                                {selectedStatus ? statusOptions.find(s => s.value === selectedStatus)?.label : t('Statut')}
                              </div>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              {selectedStatus && (
                                <div className="absolute right-9 w-2 h-2 rounded-full bg-primary"></div>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-2xl border border-input/30 z-50 rounded-2xl bg-white/90 backdrop-blur-md" sideOffset={8} align="start">
                            <Command>
                              <CommandList>
                                <CommandGroup>
                                  <CommandItem
                                    onSelect={() => {
                                      setSelectedStatus(null);
                                      setIsStatusFilterOpen(false);
                                    }}
                                    className="hover:bg-muted/80"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedStatus === null ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <Filter className="h-4 w-4 mr-2" />
                                    {t('Tous les statuts')}
                                  </CommandItem>
                                  {statusOptions.map((status) => (
                                    <CommandItem
                                      key={status.value}
                                      value={status.value}
                                      onSelect={(value) => {
                                        setSelectedStatus(value);
                                        setIsStatusFilterOpen(false);
                                      }}
                                      className="hover:bg-muted/40 rounded-lg mx-1 transition-colors duration-150"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedStatus === status.value ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {status.value === 'active' ? <CircleDot className="h-4 w-4 mr-2" /> : 
                                       status.value === 'expired' ? <Clock className="h-4 w-4 mr-2" /> : 
                                       <CheckCircle className="h-4 w-4 mr-2" />}
                                      {status.label}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Referee filter */}
                      <div className="w-full">
                        <Popover 
                          open={isRefereeFilterOpen} 
                          onOpenChange={handleRefereeFilterOpenChange}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isRefereeFilterOpen}
                              className="w-full h-10 justify-between relative shadow-md border-input/40 hover:border-input/60 focus-visible:ring-offset-2 hover:shadow-lg transition-all duration-200 rounded-xl bg-white/70 backdrop-blur-sm"
                            >
                              <div className="flex items-center truncate">
                                <Scale className="h-4 w-4 mr-2" />
                                {selectedFilterReferee ? (
                                  <span className="truncate">{selectedFilterReferee.username}</span>
                                ) : t('Arbitre')}
                              </div>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              {selectedFilterReferee && (
                                <div className="absolute right-9 w-2 h-2 rounded-full bg-primary"></div>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-2xl border border-input/30 z-50 rounded-2xl bg-white/90 backdrop-blur-md" sideOffset={8} align="start">
                            <Command>
                              <CommandInput 
                                placeholder={t('Rechercher un arbitre...')} 
                                onValueChange={fetchReferees}
                                className="border-b border-input/30 rounded-t-2xl"
                              />
                              <CommandList>
                                <CommandItem
                                  onSelect={() => {
                                    setSelectedFilterReferee(null);
                                    setIsRefereeFilterOpen(false);
                                  }}
                                  className="hover:bg-muted/80"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedFilterReferee === null ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <Users className="h-4 w-4 mr-2" />
                                  {t('Tous les arbitres')}
                                </CommandItem>
                                <CommandEmpty>{t('Aucun arbitre trouvé.')}</CommandEmpty>
                                <CommandGroup>
                                  {referees.map((referee) => (
                                    <CommandItem
                                      key={referee.username}
                                      value={referee.username}
                                      onSelect={() => handleRefereeFilterSelect(referee.username)}
                                      className="hover:bg-muted/40 rounded-lg mx-1 transition-colors duration-150"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedFilterReferee?.username === referee.username ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <Scale className="h-4 w-4 mr-2" />
                                      {referee.username}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Bets grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3 gap-6 sm:gap-8">
                {isLoadingBets ? (
                  loadingIndicator
                ) : bets.length > 0 ? (
                  bets.map((bet) => (
                    <Link 
                      href={`/bet/${bet.id}`} 
                      key={bet.id} 
                      className="block h-full w-full" 
                      prefetch={true}
                    >
                      <BetCard 
                        bet={bet} 
                        isUserReferee={userRefereeGames.includes(bet.id)}
                      />
                    </Link>
                  ))
                ) : (
                  <div className="col-span-full text-center py-10">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gray-100/80 flex items-center justify-center mb-6 shadow-sm">
                      <Gamepad2 className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-700">{t('Aucun pari dans cette salle')}</h3>
                    <p className="text-gray-500 mt-2">{t('Créez un nouveau pari pour commencer')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile view */}
            <div className="sm:hidden">
              {/* Page heading without create bet button */}
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-xl font-bold">{t('Paris')}</h1>
              </div>
              
              {/* Filters section */}
              <div className="mb-8">
                {/* Filter heading with toggle for mobile */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex w-full">
                    {(searchQuery || selectedStatus || selectedFilterReferee || participationFilter) && (
                      <span className="text-sm text-muted-foreground self-center">
                        ({bets.length} {t('résultats')})
                      </span>
                    )}
                  </div>
                </div>

                {/* Active filters chips/badges */}
                {(searchQuery || selectedStatus || selectedFilterReferee || participationFilter) && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {searchQuery && (
                      <div className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium shadow-md transition-all focus:outline-none border-primary/30 bg-primary/8 text-primary hover:bg-primary/15 hover:shadow-lg backdrop-blur-sm">
                        <Search className="h-3 w-3 mr-1" /> &apos;{searchQuery}&apos;
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    
                    {selectedStatus && (
                      <div className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium shadow-md transition-all focus:outline-none border-primary/30 bg-primary/8 text-primary hover:bg-primary/15 hover:shadow-lg backdrop-blur-sm">
                        {selectedStatus === 'active' ? <CircleDot className="h-3 w-3 mr-1" /> : 
                         selectedStatus === 'expired' ? <Clock className="h-3 w-3 mr-1" /> : 
                         <CheckCircle className="h-3 w-3 mr-1" />}
                        {statusOptions.find(s => s.value === selectedStatus)?.label}
                        <button 
                          onClick={() => setSelectedStatus(null)}
                          className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    
                    {participationFilter && (
                      <div className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium shadow-md transition-all focus:outline-none border-primary/30 bg-primary/8 text-primary hover:bg-primary/15 hover:shadow-lg backdrop-blur-sm">
                        <User className="h-3 w-3 mr-1" />
                        {participationOptions.find(p => p.value === participationFilter)?.label}
                        <button 
                          onClick={() => setParticipationFilter(null)}
                          className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    
                    {selectedFilterReferee && (
                      <div className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium shadow-md transition-all focus:outline-none border-primary/30 bg-primary/8 text-primary hover:bg-primary/15 hover:shadow-lg backdrop-blur-sm">
                        <Scale className="h-3 w-3 mr-1" />
                        Arbitre: {selectedFilterReferee.username}
                        <button 
                          onClick={() => setSelectedFilterReferee(null)}
                          className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    
                    <button 
                      onClick={clearAllFilters}
                      className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm shadow-md transition-all focus:outline-none border-muted/50 bg-muted/30 hover:bg-muted/50 hover:text-accent-foreground hover:shadow-lg backdrop-blur-sm"
                    >
                      {t('Effacer tout')}
                    </button>
                  </div>
                )}

                {/* Filter controls for mobile - use same components from desktop with different layout */}
                <div className="grid gap-3 transition-all duration-200 ease-in-out grid-rows-[1fr]">
                  <div className="overflow-visible transition-all">
                    <div className="grid grid-cols-1 gap-3">
                      {/* Search bar already shown above */}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Bets grid for mobile */}
              <div className="grid grid-cols-1 gap-6">
                {isLoadingBets ? (
                  loadingIndicator
                ) : bets.length > 0 ? (
                  bets.map((bet) => (
                    <Link 
                      href={`/bet/${bet.id}`} 
                      key={bet.id} 
                      className="block h-full w-full" 
                      prefetch={true}
                    >
                      <BetCard 
                        bet={bet} 
                        isUserReferee={userRefereeGames.includes(bet.id)}
                      />
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-10">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gray-100/80 flex items-center justify-center mb-6 shadow-sm">
                      <Gamepad2 className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-700">{t('Aucun pari dans cette salle')}</h3>
                    <p className="text-gray-500 mt-2">{t('Créez un nouveau pari pour commencer')}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        
        {/* Dialog for creating bets */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent 
            className={cn(
              isMobile ? "max-w-full p-0 rounded-none" : "sm:max-w-[450px] flex flex-col max-h-[90vh] my-auto rounded-2xl shadow-2xl bg-white/95 backdrop-blur-md border-gray-200/50"
            )}
            hideCloseButton={true}
          >
            {isMobile ? (
              // Mobile version - full screen with scrollable content
              <div className="flex flex-col h-full">
                <DialogHeader className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur-md px-6 py-4 border-b border-gray-200/60">
                  <DialogTitle>{t('Créer un pari')}</DialogTitle>
                </DialogHeader>
                <div 
                  className="flex-1 overflow-y-auto px-4 pb-4 max-h-[calc(100dvh-58px)]" 
                >
                  {createBetForm}
                </div>
              </div>
            ) : (
              // Desktop version - standard dialog
              <>
                <DialogHeader>
                  <DialogTitle>{t('Créer un pari')}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto">
                  {createBetForm}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Floating Action Button for creating new bets */}
        <AnimatePresence>
          {currentGroupId && userGroups && userGroups.length > 0 && !isDialogOpen && (
            <FloatingActionButton
              text={t('Créer un pari')}
              subtext="10% cashback"
              onClick={() => {
                console.log('Opening dialog, fetching initial referees');
                fetchReferees('');
                setIsDialogOpen(true);
              }}
              disabled={isUserBanned || recentGamesCount >= 50}
              disabledTitle={
                isUserBanned 
                  ? t('Votre compte est suspendu') 
                  : (recentGamesCount >= 50 
                    ? t('Limite de 50 paris créés dans les dernières 24h atteinte') 
                    : "")
              }
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

