'use client'

import React, { useState, useEffect, use, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
import { Users, HandCoins, Trophy, Scale, ArrowLeft, Search, ShieldOff, Loader2, Share } from "lucide-react"
import { type ChartConfig } from "@/components/ui/chart"
import { motion, AnimatePresence } from "framer-motion"
import { formatDistanceToNow } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import Link from 'next/link'
import { Suspense } from 'react'
import { toast } from "sonner"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import Image from 'next/image'
import { useTranslation } from "react-i18next"

import { BetDrawer } from "@/components/BetDrawer"
import { BetOptions } from "@/components/BetOptions"
import { BetChart } from "@/components/BetChart"
import { BetLeaderboard } from "@/components/BetLeaderboard"
import { BetSocial } from "@/components/BetSocial"
import { useSupabase } from "@/lib/supabase/context"
import { useGroup } from '@/lib/group/context'
import { calculateMultiplier, calculateMultiplierHistory, DEFAULT_VIRTUAL_LIQUIDITY } from '@/lib/utils/bet-multiplier'

// Add these wrapper functions at the top
// Define types for the bet and option objects
type BetData = {
  id: string;
  amount: number;
  option: string;
  created_at: string;
  user?: string;
  multiplier?: number;
};

type OptionData = {
  id: string;
  title?: string;
  is_winning?: boolean;
};

function calcMultiplier(optionId: string, bets: BetData[], options: OptionData[]) {
  return calculateMultiplier(optionId, bets, options, DEFAULT_VIRTUAL_LIQUIDITY);
}

function calcMultiplierHistory(optionId: string, bets: BetData[], options: OptionData[]) {
  return calculateMultiplierHistory(optionId, bets, options, DEFAULT_VIRTUAL_LIQUIDITY);
}

// Define explicit types for the imported functions to help TypeScript
// type MultiplierCalculator = typeof calculateMultiplier;
// type HistoryCalculator = typeof calculateMultiplierHistory;

// Add this type definition near the top of the file, after the imports
type BettingOption = {
  id: string;
  time: string;
  betCount: number;
  totalPoints: number;
  percentage: number;
  latestMultiplier: number;
  isWinning?: boolean;
  multiplierHistory?: Array<{ bets: number; multiplier: number }>;
  userBet?: {
    amount: number;
    multiplier: number;
  };
};

// Add these type definitions after the BettingOption type
type UserData = {
  id: number;
  username: string;
};

type BettingOptionData = {
  id: string;
  title: string;
  is_winning?: boolean;
};

// First, extract the LoadingSkeleton component to the top level
const LoadingSkeleton = () => (
  <div className="container mx-auto py-2 sm:py-8 px-2 sm:px-6">
    <div className="max-w-7xl mx-auto">
      <Card className="w-full">
        <CardHeader className="p-3 sm:p-6">
          <div className="space-y-3">
            <div className="h-8 sm:h-12 bg-gray-200 rounded-lg animate-pulse w-3/4" />
            <div className="h-6 sm:h-8 bg-gray-200 rounded-lg animate-pulse w-1/4" />
            <div className="flex gap-2">
              <div className="h-6 bg-gray-200 rounded-lg animate-pulse w-24" />
              <div className="h-6 bg-gray-200 rounded-lg animate-pulse w-24" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-6 p-2 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="grid grid-cols-2 gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
            <div className="lg:col-span-2">
              <div className="h-[400px] bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
          <div className="h-24 bg-gray-200 rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    </div>
  </div>
)

// Move the main content into a separate component
function BetContent({ params }: { params: Promise<{ id: string }> }): React.JSX.Element {
  const { t, i18n } = useTranslation('BetPage');
  const supabase = useSupabase();
  const { setCurrentGroupId } = useGroup();
  const router = useRouter();
  
  // Unwrap the params promise
  const { id } = use(params)
  
  const [hoveredTime, setHoveredTime] = useState<string>()
  const [selectedTime, setSelectedTime] = useState<string>()
  const [betAmount, setBetAmount] = useState<number | undefined>(undefined)
  
  // Update the timeLeft state to include days
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  const [isEnding, setIsEnding] = useState(false);

  // Add state for the deadline itself
  const [deadline, setDeadline] = useState<string | null>(null);

  // Add new state for bet data
  const [bet, setBet] = useState<{
    title: string;
    timeSlots: Array<{
      id: string;
      time: string;
      betCount: number;
      totalPoints: number;
      percentage: number;
      latestMultiplier: number;
      isWinning?: boolean;
      multiplierHistory?: Array<{ bets: number; multiplier: number }>;
      userBet?: {
        amount: number;
        multiplier: number;
      };
    }>;
    recentActivity: Array<{
      user: { name: string; avatar: string };
      userId?: string; // Store actual user ID for unique bettor calculations
      time: string;
      timestamp: string;
      amount: number;
      isWinningBet?: boolean;
      multiplier: number;
    }>;
  }>({
    title: '',
    timeSlots: [],
    recentActivity: []
  });

  // Add new state for total bets
  const [totalBets, setTotalBets] = useState(0);


  const [userId, setUserId] = useState<string>('');

  // Add new states for game status
  const [isReferee, setIsReferee] = useState(false);
  const [gameStatus, setGameStatus] = useState<'active' | 'pending_decision' | 'decided'>('active');
  const [decidedAt, setDecidedAt] = useState<string | null>(null);
  const [refereeInfo, setRefereeInfo] = useState<{ id: string; username: string } | null>(null);

  // Add new loading state
  const [isContentLoading, setIsContentLoading] = useState(true);

  // Add new state for total hours
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [totalHours, setTotalHours] = useState<number>(24); // Default value

  // Add new states after the existing ones
  const [totalBetAmount, setTotalBetAmount] = useState(0);
  const [uniqueBettors, setUniqueBettors] = useState(0);
  const [averageBetAmount, setAverageBetAmount] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [highestBet, setHighestBet] = useState({ amount: 0, username: '' });

  // Add new state for referee's game count
  const [refereeGameCount, setRefereeGameCount] = useState<number>(0);

  // Add new state for decision loading
  const [isDecisionLoading, setIsDecisionLoading] = useState(false);
  const [decisionLoadingOptionId, setDecisionLoadingOptionId] = useState<string | undefined>();


  // Add a new state for interruption loading
  const [isInterruptionLoading, setIsInterruptionLoading] = useState(false);

  // Add a new state for creator info
  const [creatorInfo, setCreatorInfo] = useState<{ id: string; username: string } | null>(null);

  // Add new state for confirmation dialog
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [pendingDecisionOptionId, setPendingDecisionOptionId] = useState<string | undefined>();
  const [pendingDecisionOption, setPendingDecisionOption] = useState<BettingOption | undefined>();

  // Add a new state for blacklisted status
  const [isUserBlacklisted, setIsUserBlacklisted] = useState(false);

  // Add this state to track when chart data needs to be recalculated
  const [chartData, setChartData] = useState<Array<{bets: number; [key: string]: number}>>([]);

  // Add a new state for group ID
  const [groupId, setGroupId] = useState<number | undefined>(undefined);

  // Add states for error handling
  const [notFound, setNotFound] = useState(false);
  const [notAuthorized, setNotAuthorized] = useState(false);

  // Add this after existing imports
  const [showBetConfirmation, setShowBetConfirmation] = React.useState(false);
  const [betConfirmationAmount, setBetConfirmationAmount] = React.useState<number>(0);
  const [betConfirmationMultiplier, setBetConfirmationMultiplier] = React.useState<number>(0);
  
  // Add state to control BetDrawer opening
  const [showBetDrawer, setShowBetDrawer] = useState(false);

  // Add this after the handlePlaceBet function or create it if it doesn't exist
  const handleBetSuccess = (amount: number, multiplier: number) => {
    // Set confirmation data
    setBetConfirmationAmount(amount);
    setBetConfirmationMultiplier(multiplier);
    setShowBetConfirmation(true);
    
    // Hide after animation completes
    setTimeout(() => {
      setShowBetConfirmation(false);
    }, 3000);
  };

  // Handle share functionality
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/bet/${id}`;
    
    // Try native share API first (mobile-friendly)
    if (navigator.share) {
      try {
        await navigator.share({
          title: bet.title,
          text: t('Découvrez ce pari:'),
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed, fall back to copy
      }
    }
    
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t('Lien copié dans le presse-papier'));
    } catch {
      // Final fallback: show the URL in a prompt
      window.prompt(t('Copiez ce lien:'), shareUrl);
    }
  };

  // Update the useEffect where you fetch user data
  useEffect(() => {
    const fetchData = async () => {
      setIsContentLoading(true);
      // Reset deadline on each fetch start
      setDeadline(null);
      try {
        // Combine user and points queries into a single parallel request
        const [userResponse, gameResponse] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from('BettingGame')
            .select(`
              id,
              title,
              deadline,
              decided_at,
              referee,
              created_by,
              group,
              Users!BettingGame_referee_fkey (
                id,
                username
              ),
              Creator:Users!BettingGame_created_by_fkey (
                id,
                username
              ),
              BettingOption (
                id,
                title,
                is_winning,
                Bets (
                  id,
                  amount,
                  user,
                  created_at,
                  multiplier,
                  Users!inner (
                    id,
                    username
                  )
                )
              )
            `)
            .eq('id', id)
            .single()
        ]);

        const { data: { user }, error: userError } = userResponse;
        if (userError || !user) {
          console.error('Error fetching user:', userError);
          setIsContentLoading(false);
          return;
        }

        // Check if game data exists
        if (!gameResponse.data || gameResponse.error) {
          console.error('Error: No game data found', gameResponse.error);
          setNotFound(true);
          setIsContentLoading(false);
          return;
        }

        // Set the group ID from the game data
        const groupId = gameResponse.data.group;
        setGroupId(groupId);
        setCurrentGroupId(groupId);

        // Check if user is member of the group
        const { count, error: membershipError } = await supabase
          .from('UsersGroupMembership')
          .select('*', { count: 'exact', head: true })
          .eq('user', user.id)
          .eq('group', groupId);

        if (membershipError || count === 0) {
          console.error('User is not a member of the group:', membershipError);
          setNotAuthorized(true);
          setIsContentLoading(false);
          return;
        }

        setUserId(user.id);

        // Check if user is blacklisted from this game
        const { count: blacklistCount, error: blacklistCheckError } = await supabase
          .from('UsersExcludedFrom')
          .select('*', { count: 'exact', head: true }) // Check count efficiently
          .eq('game', id)
          .eq('user', user.id);

        if (blacklistCheckError) {
           console.error('Error checking blacklist:', blacklistCheckError);
           // Decide how to handle this error, e.g., assume not blacklisted or show an error
           setIsUserBlacklisted(false); // Assuming not blacklisted on error for safety
        } else {
           // If count is greater than 0, the user is blacklisted
           setIsUserBlacklisted(blacklistCount !== null && blacklistCount > 0);
        }



        const { data: game, error: gameError } = gameResponse;
        if (gameError) {
          console.error('Error fetching game:', gameError);
          setIsContentLoading(false);
          return;
        }

        // ***** Set the deadline state here *****
        setDeadline(game.deadline);

        // Set referee status and info
        setIsReferee(user.id === game.referee);
        setRefereeInfo(game.Users && Array.isArray(game.Users) ? game.Users[0] : game.Users || null);
        setDecidedAt(game.decided_at);

        // Fetch referee's game count
        if (game.referee) {
          const { data: refereeGames, error: refereeGamesError } = await supabase
            .from('BettingGame')
            .select('id')
            .eq('referee', game.referee);
            
          if (!refereeGamesError) {
            setRefereeGameCount(refereeGames?.length || 0);
          }
        }

        // Determine game status (re-calculate based on potentially updated deadline)
        const now = new Date();
        const deadlineDate = new Date(game.deadline); // Use the fetched deadline directly

        // Determine game status logic remains the same using deadlineDate
        if (game.decided_at) {
          setGameStatus('decided');
        } else if (now > deadlineDate) {
          setGameStatus('pending_decision');
        } else {
          setGameStatus('active');
          // Removed initial timeLeft calculation from here
        }

        // Process all betting data in a single pass
        const allBets = game.BettingOption.flatMap(option => 
          option.Bets.map(bet => ({
            ...bet,
            option: option.id // Add option ID to each bet
          }))
        );
        
        const totalBetsCount = allBets.length;
        const totalGamePoints = allBets.reduce((sum, bet) => sum + bet.amount, 0);
        const uniqueUsers = new Set(allBets.map(bet => bet.user)).size;
        const averageBet = totalGamePoints / totalBetsCount || 0;
        const highest = allBets.reduce((max, bet) => {
          // More explicitly handle the type of Users with type guards
          let username = 'Anonymous';
          if (Array.isArray(bet.Users) && bet.Users.length > 0) {
            username = bet.Users[0]?.username || 'Anonymous';
          } else if (bet.Users && typeof bet.Users === 'object' && 'username' in bet.Users) {
            username = bet.Users.username as string;
          }
          
          return bet.amount > max.amount ? { amount: bet.amount, username } : max;
        }, { amount: 0, username: '' });

        // Update all stats at once
        setTotalBets(totalBetsCount);
        setTotalBetAmount(totalGamePoints);
        setUniqueBettors(uniqueUsers);
        setAverageBetAmount(averageBet);
        setHighestBet(highest);

        // Transform timeSlots data
        const timeSlots = game.BettingOption.map(option => {
          // Find ALL user bets for this option instead of just one
          const optionUserBets = allBets.filter(bet => 
            bet.user === user.id && 
            bet.option === option.id
          );

          const optionBets = option.Bets || [];
          const totalPoints = optionBets.reduce((sum, bet) => sum + bet.amount, 0);
          const percentage = totalGamePoints > 0 ? Math.round((totalPoints / totalGamePoints) * 100) : 0;

          // Calculate latest multiplier using the utility function
          const latestMultiplier = calcMultiplier(
            option.id,
            allBets,
            game.BettingOption
          );

          // Calculate multiplier history using the utility function
          const multiplierHistory = calcMultiplierHistory(
            option.id, 
            allBets,
            game.BettingOption
          );

          // Format the multiplier history for the chart
          const formattedHistory = multiplierHistory.map((item, index) => ({
            bets: index,
            multiplier: item.multiplier
          }));

          // Only compute userBet if there are bets for this user on this option
          let userBet;
          if (optionUserBets.length > 0) {
            // Sum up all bet amounts
            const totalBetAmount = optionUserBets.reduce((sum, bet) => sum + bet.amount, 0);
            
            // For user bets, use the stored multiplier values
            const weightedMultiplier = optionUserBets.reduce((sum, bet) => {
              // Use stored multiplier if available, otherwise fallback to calculation
              const betMultiplier = bet.multiplier || 2.0;
              return sum + (bet.amount * betMultiplier);
            }, 0) / totalBetAmount;
            
            userBet = {
              amount: totalBetAmount,
              multiplier: weightedMultiplier
            };
          }

          return {
            id: option.id,
            time: option.title,
            betCount: optionBets.length,
            totalPoints,
            percentage,
            latestMultiplier,
            isWinning: option.is_winning,
            multiplierHistory: formattedHistory,
            userBet
          };
        });

        // Process recent activity using already fetched data
        const recentActivity = allBets
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 100)
          .map(bet => {
            const option = game.BettingOption.find(opt => opt.id === bet.option);
            
            // Fix this part - Users is not an array but a direct object 
            let username = 'Anonymous';
            if (Array.isArray(bet.Users) && bet.Users.length > 0) {
              username = bet.Users[0]?.username || 'Anonymous';
            } else if (bet.Users && typeof bet.Users === 'object' && 'username' in bet.Users) {
              username = bet.Users.username as string;
            }

            // Use the same pattern for userId
            let userId = 0;
            if (Array.isArray(bet.Users) && bet.Users.length > 0) {
              userId = bet.Users[0]?.id || 0;
            } else if (bet.Users && typeof bet.Users === 'object' && 'id' in bet.Users) {
              userId = bet.Users.id as number;
            }
            
            // Directly use the stored multiplier from the database
            // No fallback calculation needed as requested
            const betMultiplier = bet.multiplier || 2.0; // Default to 2.0 if somehow missing
            
            return {
              user: {
                name: username,
                avatar: `/avatars/${userId % 5 + 1}.png`
              },
              userId: bet.user, // Store the actual user ID for unique bettor calculations
              time: option?.title || '',
              timestamp: bet.created_at,
              amount: bet.amount,
              isWinningBet: option?.is_winning || false,
              multiplier: betMultiplier
            };
          });

        // Calculate total hours
        const gameCreatedAt = new Date();
        gameCreatedAt.setHours(gameCreatedAt.getHours() - 24); // Default to 24 hours ago if not available
        const totalHoursDiff = Math.ceil((deadlineDate.getTime() - gameCreatedAt.getTime()) / (1000 * 60 * 60));
        setTotalHours(totalHoursDiff);

        // Update bet state
        setBet({
          title: game.title,
          timeSlots,
          recentActivity
        });

        // Set creator info
        if (Array.isArray(game.Creator)) {
          setCreatorInfo(game.Creator.length > 0 ? game.Creator[0] : null);
        } else {
          setCreatorInfo(game.Creator || null);
        }

        // Process multiplier history data for chart
        const processedChartData: Array<{bets: number; [key: string]: number}> = [];
        
        // Get maximum history length from all options to normalize data
        const maxHistoryLength = Math.max(
          ...timeSlots.map(slot => (slot.multiplierHistory?.length || 0))
        );
        
        if (maxHistoryLength > 0) {
          // Create data points for each bet index
          for (let i = 0; i < maxHistoryLength; i++) {
            const dataPoint: {bets: number; [key: string]: number} = { bets: i };
            
            // Add data for each time slot
            timeSlots.forEach(slot => {
              if (slot.multiplierHistory && slot.multiplierHistory[i]) {
                // Store inverse of multiplier as probability (1/x)
                const probability = 1 / slot.multiplierHistory[i].multiplier;
                dataPoint[slot.time] = Number(probability.toFixed(3));
              }
            });
            
            processedChartData.push(dataPoint);
          }
        }
        
        // Set chart data
        setChartData(processedChartData);

        // Set loading to false after all data is processed
        setIsContentLoading(false);

      } catch (error) {
        console.error('Error in fetchData:', error);
        setIsContentLoading(false);
        // Ensure deadline is null on error
        setDeadline(null);
      }
    };

    fetchData();
    // Keep existing dependencies: If ID changes, refetch everything including deadline
  }, [id, supabase, setCurrentGroupId]);

  // ***** Update the timer useEffect *****
  useEffect(() => {
    // Only run the timer if the game is active and we have a deadline
    if (gameStatus !== 'active' || !deadline) {
      // Ensure timer is stopped and state is reset if status changes or deadline missing
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      setIsEnding(false);
      return; // Don't start the interval
    }

    let intervalId: NodeJS.Timeout | undefined = undefined;

    const startTimer = () => {
      const deadlineDate = new Date(deadline);

      const updateTimer = () => {
        const now = new Date();
        const diff = deadlineDate.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
          setIsEnding(false);
          // Game might have ended, consider setting status to pending_decision
          // Or rely on the subscription / next fetch to update status
          if (intervalId) clearInterval(intervalId);
          // Check if status needs update after timer ends
          if (gameStatus === 'active') {
             setGameStatus('pending_decision'); // Update status locally if timer expires
          }
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
        setIsEnding(days === 0 && hours === 0 && minutes < 5);
      };

      // Update immediately
      updateTimer();

      // Then update every second
      intervalId = setInterval(updateTimer, 1000);
    };

    startTimer();

    // Clean up the interval when the effect re-runs or component unmounts
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };

  }, [deadline, gameStatus]); // Add deadline and gameStatus as dependencies

  // Calculate color helper function that uses rank instead of absolute multiplier values
  const getColorForMultiplier = (multiplier: number, minMultiplier: number, maxMultiplier: number, isWinning: boolean = false, rank?: number, totalOptions?: number) => {
    // If game is decided and this is the winning option, return green
    if (gameStatus === 'decided' && isWinning) {
      return "#10b981" // Green color for winning option
    }
    
    // Theme-matching colors - Higher probability (lower multiplier) = stronger blue
    const highProbabilityColor = "#0047AB"  // Strong blue for high probability
    const lowProbabilityColor = "#8a8ba6"   // Light gray for low probability
    
    // If rank is provided, use rank-based coloring
    if (rank !== undefined && totalOptions && totalOptions > 1) {
      // Normalize by rank (0 = highest probability, 1 = lowest probability)
      const normalizedRank = rank / (totalOptions - 1);
      
      // Apply non-linear scaling to emphasize the top options
      const scaledValue = Math.pow(1 - normalizedRank, 0.7);
      
      // Linear interpolation between colors based on rank
      const r = Math.round(parseInt(lowProbabilityColor.slice(1,3), 16) * (1 - scaledValue) + 
                          parseInt(highProbabilityColor.slice(1,3), 16) * scaledValue)
      const g = Math.round(parseInt(lowProbabilityColor.slice(3,5), 16) * (1 - scaledValue) + 
                          parseInt(highProbabilityColor.slice(3,5), 16) * scaledValue)
      const b = Math.round(parseInt(lowProbabilityColor.slice(5,7), 16) * (1 - scaledValue) + 
                          parseInt(highProbabilityColor.slice(5,7), 16) * scaledValue)
      
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }
    
    // Fallback to original multiplier-based coloring
    // Handle edge case where all multipliers are equal
    if (minMultiplier === maxMultiplier) {
      return highProbabilityColor; // Use high probability color for all
    }
    
    // Normalize the multiplier inversely (lower multiplier = higher probability)
    const range = maxMultiplier - minMultiplier
    const normalizedValue = 1 - ((multiplier - minMultiplier) / range)
    
    // Ensure the value is between 0 and 1 (defensive programming)
    const clampedValue = Math.max(0, Math.min(1, normalizedValue))
    
    // Apply non-linear scaling to emphasize differences
    const scaledValue = Math.pow(clampedValue, 0.7)
    
    // Linear interpolation between colors
    const r = Math.round(parseInt(lowProbabilityColor.slice(1,3), 16) * (1 - scaledValue) + 
                        parseInt(highProbabilityColor.slice(1,3), 16) * scaledValue)
    const g = Math.round(parseInt(lowProbabilityColor.slice(3,5), 16) * (1 - scaledValue) + 
                        parseInt(highProbabilityColor.slice(3,5), 16) * scaledValue)
    const b = Math.round(parseInt(lowProbabilityColor.slice(5,7), 16) * (1 - scaledValue) + 
                        parseInt(highProbabilityColor.slice(5,7), 16) * scaledValue)
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  // Update the chart config to use rank-based coloring
  const chartConfig = (() => {
    const slots = bet.timeSlots.filter(slot => slot.multiplierHistory && slot.multiplierHistory.length > 0)
    
    // Handle edge case with no data
    if (slots.length === 0) {
      return {
        bets: {
          label: "Probabilités"
        }
      } as ChartConfig
    }
    
    // Get last multiplier for each slot and sort by probability (inverse of multiplier)
    const lastMultipliers = slots.map(slot => ({
      time: slot.time,
      lastMultiplier: slot.multiplierHistory?.[slot.multiplierHistory.length - 1]?.multiplier || 2.0,
      isWinning: slot.isWinning || false
    })).sort((a, b) => a.lastMultiplier - b.lastMultiplier); // Sort by multiplier (ascending = higher probability first)
    
    // Find min and max multipliers
    const minMultiplier = Math.min(...lastMultipliers.map(s => s.lastMultiplier))
    const maxMultiplier = Math.max(...lastMultipliers.map(s => s.lastMultiplier))
    
    return slots.reduce((acc, slot) => {
      const lastMultiplier = slot.multiplierHistory?.[slot.multiplierHistory.length - 1]?.multiplier || 2.0
      
      // Find the rank of this slot (0 = highest probability)
      const rank = lastMultipliers.findIndex(s => s.time === slot.time)
      const totalOptions = lastMultipliers.length
      
      const baseColor = getColorForMultiplier(
        lastMultiplier, 
        minMultiplier, 
        maxMultiplier, 
        slot.isWinning,
        rank,
        totalOptions
      )
      
      // Calculate opacity also based on rank
      // Higher rank (lower index) = higher opacity
      let opacity = 1
      
      // If game is decided, make winning option most visible, others more transparent
      if (gameStatus === 'decided') {
        opacity = slot.isWinning ? 1 : 0.3
      } else if (totalOptions > 1) {
        // Scale opacity by rank but keep a minimum of 0.4 so all lines are visible
        opacity = 0.4 + ((totalOptions - 1 - rank) / (totalOptions - 1) * 0.6)
      }
      
      return {
        ...acc,
        [slot.time]: {
          label: slot.time,
          color: baseColor,
          opacity: opacity
        }
      }
    }, {
      bets: {
        label: "Probabilités"
      }
    } as ChartConfig)
  })()

  // Helper function to get the multiplier for display
  const getDisplayMultiplier = (slot: { time: string; totalPoints: number; }) => {
    const selectedSlot = bet.timeSlots.find(s => s.time === slot.time);
    if (!selectedSlot) return 2.0;
    return selectedSlot.latestMultiplier;
  }

  // Calculate potential win
  const potentialWin = betAmount ? (betAmount * getDisplayMultiplier(bet.timeSlots.find(s => s.time === selectedTime) || { time: "", totalPoints: 0 })) : 0

  // Update the handleRefereeDecision function
  const handleRefereeDecision = async (winningOptionId: string) => {
    try {
      // Don't close the confirmation dialog - instead show loading in it
      // setConfirmationDialogOpen(false); <- Remove this line
      
      // Set loading state
      setIsDecisionLoading(true);
      setDecisionLoadingOptionId(winningOptionId);
      

      // First, set all options for this game to false
      const { error: resetError } = await supabase
        .from('BettingOption')
        .update({ is_winning: false })
        .eq('game', id);

      if (resetError) throw resetError;

      // Then set the winning option to true
      const { error: optionError } = await supabase
        .from('BettingOption')
        .update({ is_winning: true })
        .eq('id', winningOptionId);

      if (optionError) throw optionError;

      // Start a transaction to update the game and winning option
      const { error: updateError } = await supabase
        .from('BettingGame')
        .update({ 
          decided_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Fetch ALL bets for this game, including multipliers
      const { data: allGameBets, error: betsError } = await supabase
        .from('Bets')
        .select(`
          id,
          amount,
          user,
          option,
          created_at,
          multiplier
        `)
        .eq('game', id);

      if (betsError) throw betsError;

      // Fetch all options for this game
      const {error: optionsError } = await supabase
        .from('BettingOption')
        .select('id')
        .eq('game', id);

      if (optionsError) throw optionsError;

      // Create a map to track each user's points changes
      const userPointsChanges: Record<string, number> = {};

      // Process each bet to calculate point changes
      for (const bet of allGameBets) {
        const userId = bet.user;
        
        // Directly use the stored multiplier from the database
        const betMultiplier = bet.multiplier || 2.0; // Default to 2.0 if somehow missing
        
        if (!userPointsChanges[userId]) {
          userPointsChanges[userId] = 0;
        }
        
        if (bet.option === winningOptionId) {
          // For winning bets: add only the profit (not the original bet amount)
          const profit = bet.amount * (betMultiplier - 1);
          userPointsChanges[userId] += profit;
        } else {
          // For losing bets: subtract the bet amount
          userPointsChanges[userId] -= bet.amount;
        }
      }

      // Update each user's balance
      for (const userId in userPointsChanges) {
        // Get user's current balance
        const { data: currentBalance, error: balanceError } = await supabase
          .from('PointsHistory')
          .select('amount')
          .eq('user', userId)
          .eq('group', groupId)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (balanceError) {
          console.error(`Error getting balance for user ${userId}:`, balanceError);
          continue; // Skip this user but continue with others
        }

        const newBalance = (currentBalance?.amount || 0) + Math.round(userPointsChanges[userId]);

        // Add points to user's balance with a single update
        const { error: pointsError } = await supabase
          .from('PointsHistory')
          .insert({
            user: userId,
            amount: newBalance, // Store the new total balance
            timestamp: new Date().toISOString(),
            group: groupId
          });

        if (pointsError) {
          console.error(`Error updating points for user ${userId}:`, pointsError);
        }
      }

      // Calculate 10% commission for the creator
      // The creator receives 10% of all bet points as compensation for creating and managing the game
      const totalGameBetAmount = allGameBets.reduce((sum, bet) => sum + bet.amount, 0);
      const creatorCommission = Math.round(totalGameBetAmount * 0.1); // 10% of total bets
      
      // Get creator's current balance
      const { data: creatorBalance, error: creatorBalanceError } = await supabase
        .from('PointsHistory')
        .select('amount')
        .eq('user', creatorInfo?.id) // Use creator's ID
        .eq('group', groupId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();
        
      if (!creatorBalanceError) {
        const newCreatorBalance = (creatorBalance?.amount || 0) + creatorCommission;
        
        // Add commission to creator's balance
        const { error: creatorPointsError } = await supabase
          .from('PointsHistory')
          .insert({
            user: creatorInfo?.id, // Use creator's ID
            amount: newCreatorBalance,
            timestamp: new Date().toISOString(),
            group: groupId
          });
          
        if (creatorPointsError) {
          console.error('Error updating creator points:', creatorPointsError);
        } else {
          toast.success(t("Le créateur a reçu ${creatorCommission} points de commission (10% des paris)", { creatorCommission }));
        }
      } else {
        console.error('Error getting creator balance:', creatorBalanceError);
      }

      // Get a list of unique users who placed bets on this game
      const uniqueUserIds = [...new Set(allGameBets.map(bet => bet.user))];
      
      // Add notifications for all users who placed bets
      const notificationEntries = uniqueUserIds
        .filter(bettorId => bettorId !== userId) // Exclude the referee (current user) from notifications
        .map(bettorId => ({
          user: bettorId,
          game: id
        }));
      
      // Insert notifications in batches if there are many users
      if (notificationEntries.length > 0) {
        const { error: notificationError } = await supabase
          .from('DecisionNotification')
          .insert(notificationEntries);
        
        if (notificationError) {
          console.error('Error creating decision notifications:', notificationError);
        }
      }

      // Don't reset loading state or close dialog - wait for real-time update to handle that
      // The dialog will be closed when we get real-time update in the subscription
      
      // Local UI updates will be handled by the real-time subscription
      
    } catch (error) {
      console.error('Error updating game decision:', error);
      // Reset loading state on error and close dialog
      setIsDecisionLoading(false);
      setDecisionLoadingOptionId(undefined);
      setConfirmationDialogOpen(false);
      toast.error(t("Une erreur est survenue lors de l'enregistrement de la décision"));
    }
  };

  // Add a new function to open the confirmation dialog
  const confirmDecision = (optionId: string) => {
    if (uniqueBettors < 2) {
      toast.error(t("Au moins 2 parieurs différents sont nécessaires pour décider du résultat"));
      return;
    }
    
    // Find the option details for display in the dialog
    const option = bet.timeSlots.find(slot => slot.id === optionId);
    setPendingDecisionOptionId(optionId);
    setPendingDecisionOption(option);
    setConfirmationDialogOpen(true);
  };

  const betRef = useRef(bet);
  useEffect(() => {
    betRef.current = bet;
  }, [bet]);

  // Update the live subscription handler
  useEffect(() => {
    if (!id || !groupId) return;

    // Create two separate channels for different types of updates
    const betsChannel = supabase
      .channel(`bets-changes-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Bets',
          filter: `game=eq.${id}`,
        },
        async (payload) => {
          try {
            // Fetch the complete bet data with user information
            const { data: newBetData, error } = await supabase
              .from('Bets')
              .select(`
                id,
                amount,
                user,
                option,
                created_at,
                multiplier,
                Users!inner (
                  id,
                  username
                ),
                BettingOption!inner (
                  id,
                  title,
                  is_winning
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (error) throw error;
            
            // Type-safe access to properties without type assertion
            if (!newBetData) return;
            
            const currentBet = betRef.current;
            
            // Directly use the stored multiplier from the database
            const betMultiplier = newBetData.multiplier || 2.0; // Default to 2.0 if somehow missing
            
            // Extract user data safely
            let username = 'Anonymous';
            let userId = 1;
            
            if (newBetData.Users) {
              // Handle both array and single object formats
              if (Array.isArray(newBetData.Users) && newBetData.Users.length > 0) {
                const userData = newBetData.Users[0] as unknown as UserData;
                username = userData?.username || 'Anonymous';
                userId = userData?.id || 1;
              } else if (typeof newBetData.Users === 'object') {
                const userData = newBetData.Users as unknown as UserData;
                username = userData?.username || 'Anonymous';
                userId = userData?.id || 1;
              }
            }
            
            // Extract option data safely
            let optionTitle = '';
            let isWinning = false;
            
            if (newBetData.BettingOption) {
              // Handle both array and single object formats
              if (Array.isArray(newBetData.BettingOption) && newBetData.BettingOption.length > 0) {
                const optionData = newBetData.BettingOption[0] as unknown as BettingOptionData;
                optionTitle = optionData?.title || '';
                isWinning = !!optionData?.is_winning;
              } else if (typeof newBetData.BettingOption === 'object') {
                const optionData = newBetData.BettingOption as unknown as BettingOptionData;
                optionTitle = optionData?.title || '';
                isWinning = !!optionData?.is_winning;
              }
            }
            
            // Create the new activity entry
            const newActivity = {
              id: newBetData.id,
              user: {
                name: username,
                avatar: `/avatars/${Number(userId) % 5 + 1}.png`
              },
              userId: newBetData.user, // Store the actual user ID for unique bettor calculations
              time: optionTitle,
              timestamp: newBetData.created_at,
              amount: newBetData.amount,
              isWinningBet: isWinning,
              multiplier: betMultiplier
            };
            
            console.log("New bet detected:", newActivity);
            
            // Create a list of all bets including the new one for calculations
            const allCurrentBets = [
              // Include existing bets from recentActivity (mapping back to original structure)
              ...currentBet.recentActivity.map(a => ({
                 id: `temp-${a.timestamp}-${Math.random()}`, // Generate unique temporary ID
                 amount: a.amount,
                 option: currentBet.timeSlots.find(s => s.time === a.time)?.id || '', // Map time back to option ID
                 created_at: a.timestamp,
                 multiplier: a.multiplier, // Keep the multiplier
                 user: a.userId || 'unknown' // Use the actual user ID for proper unique bettor calculations
              })),
              // Add the new bet
              {
                id: newBetData.id,
                amount: newBetData.amount,
                user: newBetData.user, // Keep user ID if needed later
                option: newBetData.option,
                created_at: newBetData.created_at,
                multiplier: newBetData.multiplier // Keep the multiplier
              }
            ];

            // Update the bet state
            setBet(prev => {
              // First update the total points and bet count for the specific option that received the bet
              const updatedSlots = prev.timeSlots.map(slot => {
                if (slot.id === newBetData.option) {
                  // Update total points and bet count for this slot
                  return {
                    ...slot,
                    betCount: slot.betCount + 1,
                    totalPoints: slot.totalPoints + newBetData.amount,
                  };
                }
                return slot;
              });

              // Now calculate the new total points for the entire game based on updated slots
              const newTotalGamePoints = updatedSlots.reduce((sum, slot) => sum + slot.totalPoints, 0);

              // Recalculate percentages, multipliers and history for ALL slots
              const slotsWithRecalculatedData = updatedSlots.map(slot => {
                 // Recalculate percentage based on new total game points
                 const percentage = newTotalGamePoints > 0
                   ? Math.round((slot.totalPoints / newTotalGamePoints) * 100)
                   : 0;

                 // Recalculate latest multiplier
                 const latestMultiplier = calcMultiplier(
                   slot.id,
                   allCurrentBets, // Use the full list of bets
                   prev.timeSlots // Pass current options for structure
                 );

                 // Recalculate multiplier history
                 const multiplierHistory = calcMultiplierHistory(
                   slot.id,
                   allCurrentBets, // Use the full list of bets
                   prev.timeSlots // Pass current options for structure
                 );

                // Format the multiplier history for the chart
                const formattedHistory = multiplierHistory.map((item, index) => ({
                  bets: index,
                  multiplier: item.multiplier
                }));


                 return {
                   ...slot,
                   percentage: percentage,
                   latestMultiplier: latestMultiplier,
                   multiplierHistory: formattedHistory,
                   // userBet might need recalculation if user placed multiple bets
                   // We are leaving userBet update to a full refetch for now
                 };
               });


              // Adjust percentages to sum to 100 (if necessary)
              const percentageSum = slotsWithRecalculatedData.reduce((sum, slot) => sum + slot.percentage, 0);
               if (percentageSum !== 100 && slotsWithRecalculatedData.length > 0) {
                 // Find the slot with the largest percentage to adjust
                 const slotWithLargestPercentage = slotsWithRecalculatedData.reduce(
                   (prev, current) => (current.percentage > prev.percentage ? current : prev),
                   slotsWithRecalculatedData[0]
                 );
                 slotWithLargestPercentage.percentage += (100 - percentageSum);
               }

               // Calculate new chart data right here within the setBet callback
               const maxHistoryLength = Math.max(
                 ...slotsWithRecalculatedData.map(slot => (slot.multiplierHistory?.length || 0))
               );

               const processedChartData: Array<{bets: number; [key: string]: number}> = [];

               if (maxHistoryLength > 0) {
                 // Create data points for each bet index
                 for (let i = 0; i < maxHistoryLength; i++) {
                   const dataPoint: {bets: number; [key: string]: number} = { bets: i };

                   // Add data for each time slot
                   slotsWithRecalculatedData.forEach(slot => {
                     if (slot.multiplierHistory && slot.multiplierHistory[i]) {
                       // Store inverse of multiplier as probability (1/x)
                       const probability = 1 / slot.multiplierHistory[i].multiplier;
                       dataPoint[slot.time] = Number(probability.toFixed(3));
                     }
                   });
                   processedChartData.push(dataPoint);
                 }
               }

               // Update chart data state immediately with the new data
               setChartData(processedChartData);

              return {
                ...prev,
                timeSlots: slotsWithRecalculatedData,
                recentActivity: [newActivity, ...prev.recentActivity].slice(0, 100) // Limit recent activity
              };
            });


            // Update total stats based on the full list of bets
            setTotalBets(allCurrentBets.length);
            setTotalBetAmount(allCurrentBets.reduce((sum, bet) => sum + bet.amount, 0)); // Recalculate total amount
            // Recalculate unique bettors based on the full list
            const uniqueUsers = new Set(allCurrentBets.map(bet => bet.user)).size;
            setUniqueBettors(uniqueUsers);

          } catch (error) {
            console.error("Error processing new bet:", error);
          }
        }
      )
      .subscribe();



    // Modify the game channel to watch all games in the same group
    const gameChannel = supabase
      .channel(`game-changes-${id}`) // Use stable identifier
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'BettingGame',
          filter: `id=eq.${id}`, // Filter only by current game id for more precise updates
        },
        async (payload) => {
          try {
            console.log("Game update detected:", payload);
            // Check if deadline was changed (which happens when referee closes betting)
            if (payload.new.deadline !== payload.old.deadline) {
              console.log("Deadline changed:", { 
                old: payload.old.deadline, 
                new: payload.new.deadline 
              });
              
              const now = new Date();
              const newDeadline = new Date(payload.new.deadline);
              
              // If the deadline is now in the past, update game status
              if (newDeadline <= now) {
                console.log("Betting closed by referee - status changing to pending_decision");
                
                // Update game status to pending_decision
                setGameStatus('pending_decision');
                
                // Reset timer
                setTimeLeft({
                  days: 0,
                  hours: 0,
                  minutes: 0,
                  seconds: 0
                });
                
                // Show toast notification
                toast.info(t("Les paris ont été clôturés par l'arbitre"));
              }
            }
            
            // Handle decided_at changes
            if (payload.new.decided_at && !payload.old.decided_at) {
              console.log("Game decided:", payload.new.decided_at);
              setGameStatus('decided');
              setDecidedAt(payload.new.decided_at);
              
              // Reset decision loading state and close confirmation dialog when update received
              setIsDecisionLoading(false);
              setDecisionLoadingOptionId(undefined);
              setConfirmationDialogOpen(false);
              
              // Show toast for game decision
              toast.success(t("Le résultat a été décidé!"));
            }

          } catch (error) {
            console.error("Error processing game update:", error);
          }
        }
      )
      .subscribe();

    // Add another channel for option updates
    const optionChannel = supabase
      .channel(`option-changes-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'BettingOption',
          filter: `game=eq.${id}`,
        },
        async (payload) => {
          console.log("Option update detected:", payload);
          // If an option was marked as winning
          if (payload.new.is_winning && !payload.old.is_winning) {
            // Find the winning option details
            const winningOptionId = payload.new.id;
            
            // Update both timeSlots and recentActivity
            setBet(prev => {
              // First find the winning slot's title/time
              const winningSlot = prev.timeSlots.find(slot => slot.id === winningOptionId);
              if (!winningSlot) {
                console.error("Could not find winning slot with id:", winningOptionId);
                return prev;
              }
              
              const winningTime = winningSlot.time;
              console.log("Winning option found:", { id: winningOptionId, time: winningTime });
              
              // Debug: check all activity times
              console.log("Activity times:", prev.recentActivity.map(a => ({ time: a.time, matches: a.time === winningTime })));
              
              // Update the UI with both timeSlots and recentActivity
              return {
                ...prev,
                timeSlots: prev.timeSlots.map(slot => ({
                  ...slot,
                  isWinning: slot.id === winningOptionId
                })),
                // Also update the recentActivity to reflect the winning option
                recentActivity: prev.recentActivity.map(activity => {
                  // Normalize comparison by trimming whitespace and ignoring case
                  const activityTime = activity.time.trim().toLowerCase();
                  const winningSlotTime = winningTime.trim().toLowerCase();
                  
                  // Try different matching approaches - exact match, substring match, or similar text
                  const isExactMatch = activityTime === winningSlotTime;
                  const isSubstringMatch = activityTime.includes(winningSlotTime) || winningSlotTime.includes(activityTime);
                  
                  // Log matches for debugging
                  if (isExactMatch) {
                    console.log(`Exact match: "${activity.time}" is winning`);
                  } else if (isSubstringMatch) {
                    console.log(`Substring match: "${activity.time}" ~ "${winningTime}"`);
                  }
                  
                  // Use exact match first, then substring match as fallback
                  const isMatch = isExactMatch || isSubstringMatch;
                  
                  return {
                    ...activity,
                    isWinningBet: isMatch
                  };
                })
              };
            });
          }
        }
      )
      .subscribe();

    // Clean up subscriptions on unmount
    return () => {
      supabase.removeChannel(betsChannel);
      supabase.removeChannel(gameChannel);
      supabase.removeChannel(optionChannel);
    };
  }, [id, supabase, groupId, userId, t]);



  // Add this useEffect before the conditional return statement
  useEffect(() => {
    if (selectedTime && gameStatus === 'active' && !isUserBlacklisted) {
      setShowBetDrawer(true);
    }
  }, [selectedTime, gameStatus, isUserBlacklisted]);

  // Then keep your conditional return
  if (notFound || notAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] w-full px-4">
        <Card className="max-w-md w-full mx-auto bg-gradient-to-br from-white via-slate-50/80 to-slate-100/50 border-0 shadow-2xl shadow-slate-300/60 rounded-3xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-2xl flex items-center justify-center">
                <Search className="h-8 w-8 text-amber-600" />
              </div>
            </div>
            <CardTitle className="text-slate-900 font-bold">{t("Page introuvable")}</CardTitle>
            <CardDescription className="text-slate-600 leading-relaxed">
              {t("La page que vous cherchez n'existe pas ou vous n'avez pas l'autorisation d'y accéder.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-slate-500 text-sm leading-relaxed text-center">
              {t("Si vous cherchiez un pari, il est possible qu'il ait été supprimé, que vous n'ayez pas les droits d'accès nécessaires, ou que vous ayez utilisé un lien incorrect.")}
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={() => router.push('/')}
              className="w-full bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-medium py-3 rounded-2xl shadow-md shadow-blue-500/25 border-0"
              variant="default"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("Retour à l'accueil")}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <>
      {isContentLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="container mx-auto py-2 sm:py-8 px-2 sm:px-6">
          {isReferee && gameStatus === 'active' && (
            <div className="max-w-7xl mx-auto mb-4 sm:mb-6">
              <div className="w-full bg-gradient-to-br from-white/90 via-slate-50/80 to-blue-50/60 backdrop-blur-sm border border-slate-200/50 shadow-xl shadow-slate-300/50 rounded-2xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/15 flex items-center justify-center flex-shrink-0 border border-blue-200/40 shadow-sm">
                      <Scale className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm sm:text-base font-semibold text-slate-900">{t("Vous êtes l'arbitre")}</span>
                      <span className="text-xs sm:text-sm text-slate-600">{t("Vous pouvez clôturer les paris à tout moment")}</span>
                    </div>
                  </div>
                  <motion.button 
                    className="w-full sm:w-auto shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-xs sm:text-sm font-medium py-2 sm:py-2 px-3 sm:px-4 rounded-2xl transition-all duration-200 flex items-center justify-center gap-1"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      try {
                        setIsInterruptionLoading(true);
                        const { error } = await supabase
                          .from('BettingGame')
                          .update({ 
                            deadline: new Date().toISOString() 
                          })
                          .eq('id', id);
                        
                        if (error) throw error;
                        
                        // Update local state immediately to provide instant feedback
                        setGameStatus('pending_decision');
                        setTimeLeft({
                          days: 0,
                          hours: 0,
                          minutes: 0,
                          seconds: 0
                        });
                        
                        // No need to force reload - the realtime subscription will handle updates
                        // for other clients and the page is already updated for current client
                        setIsInterruptionLoading(false);
                      } catch (error) {
                        console.error('Error interrupting game:', error);
                        toast.error(t("Une erreur est survenue lors de la clôture des paris"));
                        setIsInterruptionLoading(false);
                      }
                    }}
                    disabled={isInterruptionLoading}
                  >
                    {isInterruptionLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                        <span>{t("Clôture en cours...")}</span>
                      </>
                    ) : (
                      <>
                        <ShieldOff className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span>{t("Clôturer les paris")}</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </div>
          )}
          <div className="max-w-7xl mx-auto">
            <Card className="w-full relative bg-gradient-to-br from-white via-white to-slate-50/30 shadow-2xl shadow-slate-300/60 border-0 rounded-3xl">
              <CardHeader className="p-4 sm:p-8">
                <div className="flex flex-col gap-4 sm:gap-6">
                  <div className="flex justify-between items-start gap-3 sm:gap-4">
                    <div className="flex flex-col gap-1 sm:gap-0.5 flex-1 min-w-0">
                      <CardTitle className="text-xl sm:text-4xl max-w-full break-normal break-words hyphens-auto text-slate-900 font-bold">
                        {bet.title}
                      </CardTitle>
                      {creatorInfo && (
                        <p className="text-xs sm:text-sm text-slate-500">
                          {t("Créé par")} <Link href={`/profile/${creatorInfo.username}`} className="font-medium hover:underline text-blue-600 hover:text-blue-700">{creatorInfo.username}</Link>
                        </p>
                      )}
                    </div>
                    
                    {/* Share Button */}
                    <motion.button
                      onClick={handleShare}
                      className="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 bg-gradient-to-b from-slate-100/80 to-slate-200/60 hover:from-slate-200/80 hover:to-slate-300/60 border border-slate-200/60 hover:border-slate-300/80 rounded-2xl transition-all duration-200 flex-shrink-0 shadow-sm"
                      aria-label={t("Partager le pari")}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Share className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" />
                    </motion.button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-3 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                  <BetOptions 
                    bettingOptions={bet.timeSlots}
                    selectedTime={selectedTime}
                    setSelectedTime={setSelectedTime}
                    setHoveredTime={setHoveredTime}
                    gameStatus={gameStatus}
                    isReferee={isReferee}
                    onRefereeDecision={confirmDecision}
                    isDecisionLoading={isDecisionLoading}
                    decisionLoadingOptionId={decisionLoadingOptionId}
                    uniqueBettors={uniqueBettors}
                    gameId={id}
                    isUserBlacklisted={isUserBlacklisted}
                  />

                  {gameStatus === 'decided' ? (
                    <BetLeaderboard 
                      participants={bet.recentActivity.map(activity => {
                        const pointsWon = activity.isWinningBet 
                          ? Math.round(activity.amount * (activity.multiplier - 1)) 
                          : 0;
                        
                        const avatarPathMatch = activity.user.avatar.match(/\/avatars\/(\d+)\.png/);
                        const avatarNumber = avatarPathMatch ? parseInt(avatarPathMatch[1]) : 1;
                        
                        return {
                          userId: avatarNumber,
                          username: activity.user.name,
                          amount: activity.amount,
                          multiplier: activity.multiplier,
                          isWinner: activity.isWinningBet === true,
                          pointsWon: pointsWon,
                          pointsLost: activity.isWinningBet ? 0 : activity.amount,
                          timeOption: activity.time
                        };
                      })}
                      winningOption={bet.timeSlots.find(slot => slot.isWinning)?.time || ''}
                      gameStatus={gameStatus}
                      totalBetAmount={totalBetAmount}
                    />
                  ) : (
                    <BetChart 
                      timeSlots={bet.timeSlots}
                      selectedTime={selectedTime}
                      hoveredTime={hoveredTime}
                      chartData={chartData}
                      chartConfig={chartConfig}
                      gameStatus={gameStatus}
                    />
                  )}
                </div>

                <div className="space-y-8">
                  {/* Stats - Now in its own container */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                    {/* Participants Stats */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-col relative overflow-hidden p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white via-slate-50/40 to-slate-100/20 border border-slate-200/40 shadow-xl shadow-slate-200/50"
                    >
                      <div className="absolute -right-2 sm:-right-4 -top-2 sm:-top-4 opacity-8">
                        <Users className="h-8 w-8 sm:h-16 sm:w-16 text-slate-400/20" />
                      </div>
                      <div className="flex flex-col gap-1 sm:gap-1.5 z-10">
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wide">{t("Parieurs")}</span>
                        <div className="flex items-baseline gap-1 sm:gap-1.5">
                          <span className="text-lg sm:text-2xl lg:text-3xl font-bold text-slate-900">{uniqueBettors}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] sm:text-xs font-medium text-slate-600 bg-slate-100/80 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                              {totalBets} {t("paris")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* Points Stats */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="flex flex-col relative overflow-hidden p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white via-slate-50/40 to-slate-100/20 border border-slate-200/40 shadow-xl shadow-slate-200/50"
                    >
                      <div className="absolute -right-2 sm:-right-4 -top-2 sm:-top-4 opacity-8">
                        <HandCoins className="h-8 w-8 sm:h-16 sm:w-16 text-slate-400/20" />
                      </div>
                      <div className="flex flex-col gap-1 sm:gap-1.5 z-10">
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wide">{t("Points")}</span>
                        <div className="flex items-baseline gap-1 sm:gap-1.5">
                          <span className="text-lg sm:text-2xl lg:text-3xl font-bold text-slate-900">{totalBetAmount}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] sm:text-xs font-medium text-slate-600 bg-slate-100/80 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                              {t("moy.")} {Math.round(averageBetAmount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* Time/Status Stats */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                      className={`flex flex-col relative overflow-hidden p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl ${
                        gameStatus === 'active' 
                          ? isEnding 
                            ? "bg-gradient-to-br from-white via-slate-50/40 to-slate-100/20 border border-slate-200/40 shadow-slate-200/50" 
                            : "bg-gradient-to-br from-white via-slate-50/40 to-slate-100/20 border border-slate-200/40 shadow-slate-200/50"
                          : "bg-gradient-to-br from-white via-slate-50/40 to-slate-100/20 border border-slate-200/40 shadow-slate-200/50"
                      }`}
                    >
                      {gameStatus === 'active' ? (
                        <>
                          <div className="absolute -right-2 sm:-right-4 -top-2 sm:-top-4 opacity-8">
                            <svg className="h-8 w-8 sm:h-16 sm:w-16" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="9" stroke="#64748b30" strokeWidth="2" />
                              <path 
                                d="M12 7V12L15 15" 
                                stroke="#64748b30" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <div className="flex flex-col gap-1 sm:gap-1.5 z-10">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <span className="text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wide">{t("Temps restant")}</span>
                              <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isEnding ? "bg-slate-400" : "bg-slate-500"} animate-pulse`}></div>
                            </div>
                            <div className="flex items-baseline">
                              <span className="text-lg sm:text-2xl lg:text-3xl font-bold text-slate-900">
                                {timeLeft.days > 0 ? `${timeLeft.days}j ` : ''}
                                {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}
                              </span>
                              <span className="text-[10px] sm:text-xs text-slate-500 ml-1">:{String(timeLeft.seconds).padStart(2, '0')}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="absolute -right-2 sm:-right-4 -top-2 sm:-top-4 opacity-8">
                            <Trophy className="h-8 w-8 sm:h-16 sm:w-16 text-slate-400/20" />
                          </div>
                          <div className="flex flex-col gap-1 sm:gap-1.5 z-10">
                            <span className="text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wide">
                              {gameStatus === 'pending_decision' ? t('Décision en attente') : t('Pari terminé')}
                            </span>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-sm sm:text-base lg:text-xl font-bold text-slate-900">
                                {gameStatus === 'pending_decision' 
                                  ? t('Résultat imminent') 
                                  : `${t("Depuis")} ${formatDistanceToNow(new Date(decidedAt!), { addSuffix: false, locale: i18n.language === 'fr' ? fr : enUS })}`}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                    
                    {/* Referee Stats */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.3 }}
                      className="flex flex-col relative overflow-hidden p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white via-slate-50/40 to-slate-100/20 border border-slate-200/40 shadow-xl shadow-slate-200/50"
                    >
                      <div className="absolute -right-2 sm:-right-4 -top-2 sm:-top-4 opacity-8">
                        <Scale className="h-8 w-8 sm:h-16 sm:w-16 text-slate-400/20" />
                      </div>
                      <div className="flex flex-col gap-1 sm:gap-1.5 z-10">
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wide">{t("Arbitre")}</span>
                        <div className="flex flex-col">
                          <Link 
                            href={`/profile/${refereeInfo?.username}`} 
                            className="text-sm sm:text-base lg:text-xl font-bold text-slate-900 hover:text-slate-700 transition-colors truncate leading-tight"
                          >
                            {refereeInfo?.username || 'N/A'}
                          </Link>
                          <span className="text-[10px] sm:text-xs font-medium text-slate-600 bg-slate-100/80 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full w-fit">
                            {refereeGameCount} {t("paris arbitrés")}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                  
                  {/* BetSocial - Display second on mobile, second on desktop */}
                  {(gameStatus === 'active' || gameStatus === 'pending_decision') && (
                    <BetSocial
                      recentActivity={bet.recentActivity}
                      gameStatus={gameStatus}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Add BetDrawer component */}
          {gameStatus === 'active' && !isUserBlacklisted && (
            <BetDrawer
              open={showBetDrawer}
              onOpenChange={(open) => {
                setShowBetDrawer(open);
                if (!open) setSelectedTime(undefined);
              }}
              betAmount={betAmount}
              setBetAmount={setBetAmount}
              potentialWin={potentialWin}
              gameId={id}
              optionId={bet.timeSlots.find(slot => slot.time === selectedTime)?.id || ''}
              userId={userId}
              groupId={Number(groupId) || 0}
              onBetPlaced={handleBetSuccess}
            />
          )}

          {/* Add the confirmation dialog */}
          <Dialog open={confirmationDialogOpen} onOpenChange={isDecisionLoading ? undefined : setConfirmationDialogOpen} >
            <DialogContent className="sm:max-w-md bg-gradient-to-b from-white to-slate-50/80 border-0 shadow-2xl shadow-slate-400/60 rounded-3xl" fullScreenOnMobile={false}>
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl text-amber-600 flex items-center gap-2 font-bold">
                  <Trophy className="h-5 w-5 sm:h-6 sm:w-6" />
                  {isDecisionLoading ? t("Enregistrement en cours...") : t("Confirmer la décision")}
                </DialogTitle>
              </DialogHeader>
              <div className="bg-gradient-to-r from-amber-50/80 to-yellow-50/60 p-4 sm:p-5 rounded-2xl border border-amber-200/40 my-3">
                <p className="text-amber-800 font-medium">
                  <span className="font-semibold">{pendingDecisionOption?.time}</span> 
                  {isDecisionLoading ? ` ${t("est en cours d'enregistrement comme option gagnante")}` : ` ${t("option gagnante ?")}`}
                </p>
              </div>
              <DialogFooter className="sm:justify-between flex flex-col sm:flex-row gap-3">
                {isDecisionLoading ? (
                  <div className="flex justify-center items-center w-full py-3">
                    <Loader2 className="h-5 w-5 animate-spin mr-2 text-amber-600" />
                    <span className="text-slate-700 font-medium">{t("Traitement en cours...")}</span>
                  </div>
                ) : (
                  <>
                    <button
                      className="px-5 py-3 bg-gradient-to-b from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 rounded-2xl transition-all duration-200 font-medium shadow-sm"
                      onClick={() => setConfirmationDialogOpen(false)}
                    >
                      {t("Annuler")}
                    </button>
                    <button
                      className="px-5 py-3 bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-md shadow-amber-500/25"
                      onClick={() => pendingDecisionOptionId && handleRefereeDecision(pendingDecisionOptionId)}
                    >
                      <Trophy className="h-5 w-5" />
                      {t("Confirmer")}
                    </button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Bet confirmation animation */}
          <AnimatePresence>
            {showBetConfirmation && (
              <motion.div 
                className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <motion.div 
                  className="absolute inset-0 bg-slate-500/20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                />
                
                <motion.div
                  className="bg-gradient-to-b from-white to-slate-50 rounded-2xl p-6 shadow-xl border border-amber-500/30 max-w-xs w-full text-center relative overflow-hidden"
                  initial={{ scale: 0.6, y: 30, opacity: 0 }}
                  animate={{ 
                    scale: [0.6, 1.1, 1],
                    y: [30, -10, 0],
                    opacity: [0, 1, 1]
                  }}
                  exit={{ 
                    scale: [1, 0.9, 0.6],
                    y: [0, 10, 20],
                    opacity: [1, 0.5, 0]
                  }}
                  transition={{ 
                    duration: 0.6,
                    times: [0, 0.6, 1],
                    ease: [0.16, 1, 0.3, 1]
                  }}
                >
                  {/* Subtle background glow */}
                  <motion.div 
                    className="absolute -inset-1 bg-gradient-to-r from-amber-500/10 to-amber-400/5 opacity-0"
                    animate={{ 
                      opacity: [0, 0.7, 0.4],
                      scale: [0.95, 1.05, 1]
                    }}
                    transition={{
                      duration: 2,
                      times: [0, 0.4, 1],
                      ease: "easeOut"
                    }}
                  />
                  
                  {/* Success indicator */}
                  <motion.div 
                    className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full flex items-center justify-center relative"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ 
                      scale: [0, 1.2, 1],
                      opacity: [0, 1, 1]
                    }}
                    transition={{ 
                      duration: 0.5,
                      times: [0, 0.6, 1],
                      ease: [0.16, 1, 0.3, 1]
                    }}
                  >
                    {/* Pulse effect behind icon */}
                    <motion.div
                      className="absolute inset-0 rounded-full bg-amber-400"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ 
                        opacity: [0, 0.2, 0],
                        scale: [0.8, 1.4, 1.8]
                      }}
                      transition={{
                        duration: 1.5,
                        delay: 0.3,
                        ease: "easeOut",
                        repeat: 1,
                        repeatDelay: 0.5
                      }}
                    />
                    
                    <svg 
                      viewBox="0 0 24 24" 
                      className="w-10 h-10 text-white relative z-10"
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="3"
                    >
                      <motion.path 
                        d="M5 13l4 4L19 7" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ 
                          pathLength: { 
                            delay: 0.25, 
                            duration: 0.6, 
                            ease: "easeOut"
                          },
                          opacity: { 
                            duration: 0.1, 
                            delay: 0.25 
                          }
                        }}
                      />
                    </svg>
                  </motion.div>
                  
                  {/* Title */}
                  <motion.h2 
                    className="text-xl font-bold text-slate-800 mb-5"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ 
                      opacity: [0, 1, 1],
                      y: [15, -5, 0]
                    }}
                    transition={{ 
                      duration: 0.5,
                      times: [0, 0.6, 1],
                      ease: [0.16, 1, 0.3, 1],
                      delay: 0.35 
                    }}
                  >
                    {t("Pari placé !")}
                  </motion.h2>
                  
                  {/* Amount */}
                  <motion.div
                    className="flex items-center justify-center gap-2 mb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.45, duration: 0.2 }}
                  >
                    <motion.div
                      initial={{ scale: 0.5, rotate: -15 }}
                      animate={{ 
                        scale: [0.5, 1.2, 1],
                        rotate: [-15, 5, 0]
                      }}
                      transition={{ 
                        duration: 0.6,
                        times: [0, 0.6, 1],
                        ease: [0.16, 1, 0.3, 1],
                        delay: 0.5
                      }}
                    >
                      <Image 
                        src="/coin.png" 
                        alt="Points" 
                        width={32} 
                        height={32}
                        className="w-8 h-8"
                      />
                    </motion.div>
                    <motion.span 
                      className="text-3xl font-bold text-slate-900"
                      initial={{ x: -15, opacity: 0 }}
                      animate={{ 
                        x: [-15, 5, 0],
                        opacity: [0, 1, 1]
                      }}
                      transition={{ 
                        duration: 0.5,
                        times: [0, 0.6, 1],
                        ease: [0.16, 1, 0.3, 1],
                        delay: 0.55 
                      }}
                    >
                      {betConfirmationAmount}
                    </motion.span>
                  </motion.div>
                  
                  {/* Multiplier */}
                  <motion.div
                    className="bg-slate-100 rounded-xl p-3 relative overflow-hidden border border-slate-200"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ 
                      opacity: [0, 1, 1],
                      y: [15, -5, 0]
                    }}
                    transition={{ 
                      duration: 0.5,
                      times: [0, 0.6, 1],
                      ease: [0.16, 1, 0.3, 1],
                      delay: 0.6 
                    }}
                  >
                    {/* Subtle highlight/glow on the multiplier card */}
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-amber-400/15 to-amber-500/5"
                      animate={{ 
                        x: ["-100%", "100%"],
                        opacity: [0, 0.8, 0],
                      }}
                      transition={{
                        duration: 2.5,
                        delay: 0.7,
                        ease: "easeInOut",
                        repeat: 1,
                        repeatDelay: 0.3
                      }}
                    />
                    
                    <div className="text-slate-600 text-sm">{t("Multiplicateur")}</div>
                    <motion.div
                      className="text-2xl font-bold text-amber-500"
                      initial={{ scale: 0.9 }}
                      animate={{ 
                        scale: [0.9, 1.2, 1],
                        opacity: [0.5, 1, 1]
                      }}
                      transition={{ 
                        duration: 0.6,
                        times: [0, 0.6, 1],
                        ease: [0.16, 1, 0.3, 1],
                        delay: 0.7
                      }}
                    >
                      ×{betConfirmationMultiplier.toFixed(1)}
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  )
}

// Main page component becomes very simple
export default function BetPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <BetContent params={params} />
    </Suspense>
  )
}
