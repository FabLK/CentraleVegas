'use client';

import { useEffect, useState, use, useRef } from 'react';
import { useSupabase } from '@/lib/supabase/context';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import Image from 'next/image';
import { 
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { 
  Trophy, 
  Coins, 
  Target, 
  TrendingUp,
  Gauge,
  Dices as DiceIcon,
  Search,
  CheckCircle2,
  XCircle,
  Lock,
  Pencil,
  ChevronDown,
  TrendingDown,
  Users,
} from 'lucide-react';

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import GroupsManager from '@/components/GroupsManager';
import { useGroup } from '@/lib/group/context';
import { transformToAppUser, AppUser } from '@/lib/utils/user-helpers';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from '@/lib/utils';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useUser } from '@/lib/user/context';

interface UserStats {
  username: string;
  bio: string | null;
  totalBets: number;
  totalPoints: number;
  winRate: number;
  pointsHistory: Array<{
    timestamp: string;
    balance: number;
  }>;
  avgBetAmount: number;
  largestBet: number;
  avgMultiplier: number;
  blockedPoints?: number;
}

interface UserBet {
  id: string;
  amount: number;
  created_at: string;
  game: {
    id: string;
    title: string;
    deadline: string;
    decided_at: string | null;
  };
  option: {
    id: string;
    title: string;
    is_winning: boolean;
  };
  multiplier: number;
}

// Add this new interface for the raw data from Supabase
interface RawBetData {
  id: number;
  amount: number;
  created_at: string;
  multiplier: number;
  game: {
    id: number;
    title: string;
    deadline: string;
    decided_at: string | null;
  };
  option: {
    id: string;
    title: string;
    is_winning: boolean | null;
  };
}

// Add this new interface for grouped bets
interface GroupedBets {
  gameId: string;
  gameTitle: string;
  gameDeadline: string;
  gameDecidedAt: string | null;
  bets: UserBet[];
  totalAmount: number;
  isWinning: boolean | null;
  netProfit?: number;
}



// Update the NetProfitDisplay component to handle mixed results
function NetProfitDisplay({ amount, isWinning }: { amount: number; isWinning: boolean | null }) {
  // Round the amount to ensure it's an integer
  const roundedAmount = Math.round(amount);
  
  if (isWinning === null) {
    return (
      <span className="font-bold text-primary inline-flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs sm:text-sm">
        {roundedAmount}
        <Image src="/coin.png" alt="points" width={16} height={16} className="h-3 w-3 sm:h-4 sm:w-4" />
      </span>
    );
  }

  const isPositive = roundedAmount > 0;
  const isNegative = roundedAmount < 0;
  const absAmount = Math.abs(roundedAmount);

  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs sm:text-sm font-bold transition-colors",
      isPositive && "text-green-500 bg-green-500/10",
      isNegative && "text-red-500 bg-red-500/10",
      !isPositive && !isNegative && "text-primary bg-primary/10"
    )}>
      {isPositive && <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />}
      {isNegative && <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4" />}
      {!isPositive && !isNegative && <Image src="/coin.png" alt="points" width={16} height={16} className="h-3 w-3 sm:h-4 sm:w-4" />}
      <span>{absAmount.toLocaleString()}</span>
    </div>
  );
}

// Create a content component to handle the unwrapped params
function ProfileContent({ params }: { params: Promise<{ username: string }> }) {
  // Unwrap the params promise
  const { username: rawUsername } = use(params);
  const username = decodeURIComponent(rawUsername);
  
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userBets, setUserBets] = useState<UserBet[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabase = useSupabase();
  const [isBioDialogOpen, setIsBioDialogOpen] = useState(false);
  const [editedBio, setEditedBio] = useState("");
  const { user: currentUser } = useUser(); // Get current user from context
  const [profileUser, setProfileUser] = useState<{ id: string; username: string; bio: string | null } | null>(null);
  const { currentGroupId } = useGroup();
  const [isMobile, setIsMobile] = useState(false);
  const [isMemberOfCurrentGroup, setIsMemberOfCurrentGroup] = useState<boolean | null>(null);
  const { t } = useTranslation('profile');

  // Refs to track previous state for smarter loading logic
  const prevUsernameRef = useRef<string | null>(null);
  const prevGroupIdRef = useRef<number | null | undefined>(undefined); // Use undefined for initial state

  // Add useEffect to detect mobile screen size
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      const usernameChanged = username !== prevUsernameRef.current;
      // Group ID change is significant only after initial undefined state
      const groupIdChanged = prevGroupIdRef.current !== undefined && currentGroupId !== prevGroupIdRef.current;

      // Set loading/refreshing state based on what changed
      if (usernameChanged) {
        console.log("Username changed, setting isLoading=true");
        setIsLoading(true);
        setIsRefreshing(false);
        // Clear old data when username changes
        setUserStats(null);
        setUserBets([]);
        setProfileUser(null);
        setEditedBio("");
      } else if (groupIdChanged) {
        console.log("Group ID changed, setting isRefreshing=true");
        setIsRefreshing(true); // Use overlay for group changes
        setIsLoading(false);    // Avoid full skeleton
      } else if (prevGroupIdRef.current === undefined && !isLoading) {
        // Initial load sequence (before group context potentially updates)
        // Only set loading if it's not already true
        console.log("Initial load sequence, ensuring isLoading=true");
        setIsLoading(true);
        setIsRefreshing(false);
      }

      // Store current values for the next run's comparison *before* async calls
      const localCurrentGroupId = currentGroupId; // Capture stable value for this fetch run
      prevUsernameRef.current = username;
      prevGroupIdRef.current = localCurrentGroupId;

      console.log(`Fetching data for user: ${username}, group: ${localCurrentGroupId}`);

      // Fetch user details (only if profileUser is not set or username changed)
      let userData = profileUser;
      if (usernameChanged || !userData) {
          const { data: fetchedUserData, error: userError } = await supabase
              .from('Users')
              .select('id, username, bio')
              .eq('username', username)
              .single();

          if (userError || !fetchedUserData) {
              console.error("Error fetching user data or user not found:", userError);
              setIsLoading(false);
              setIsRefreshing(false);
              setUserStats(null); // Ensure stats are null if user not found
              setUserBets([]);
              setProfileUser(null);
              // Optionally show a toast or different error message
              return;
          }
          userData = fetchedUserData;
          setProfileUser(userData);
          setEditedBio(userData.bio || ""); // Initialize bio edit state when user data is fetched
      } else if (!editedBio && userData?.bio) {
          // Ensure editedBio is initialized if userData was already present but bio wasn't set
          setEditedBio(userData.bio);
      }


      // If no group is selected *at this point*, show base profile stats
      if (localCurrentGroupId === null) {
        console.log("No group selected, showing minimal stats");
        // Fetch points history even without a group? Decided against for now.
        setUserStats({
          username: userData.username,
          bio: userData.bio,
          totalBets: 0,
          totalPoints: 0, // Show 0 points if no group selected
          winRate: 0,
          pointsHistory: [],
          avgBetAmount: 0,
          largestBet: 0,
          avgMultiplier: 0,
          blockedPoints: 0 // Show 0 blocked points if no group selected
        });
        setUserBets([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      // --- Check group membership ---
      console.log(`Checking membership for user ${userData.id} in group ${localCurrentGroupId}`);
      const { data: membershipData, error: membershipError } = await supabase
        .from('UsersGroupMembership')
        .select('id')
        .eq('user', userData.id)
        .eq('group', localCurrentGroupId)
        .maybeSingle();

      if (membershipError) {
        console.error("Error checking group membership:", membershipError);
        toast.error(t('Erreur lors de la vérification de l\'appartenance au groupe.'));
        // Handle error state appropriately, maybe set userStats to null?
        setIsLoading(false);
        setIsRefreshing(false);
        setIsMemberOfCurrentGroup(null); // Indicate uncertainty or error
        return;
      }

      const isMember = membershipData !== null;
      setIsMemberOfCurrentGroup(isMember);
      console.log(`User ${isMember ? 'IS' : 'IS NOT'} a member of group ${localCurrentGroupId}`);

      if (!isMember) {
        console.log("User not in group, showing minimal stats for group context.");
        // Set stats reflecting non-membership within a group context
        setUserStats({
          username: userData.username,
          bio: userData.bio,
          totalBets: 0,
          totalPoints: 0, // Or perhaps display a specific message/state?
          winRate: 0,
          pointsHistory: [],
          avgBetAmount: 0,
          largestBet: 0,
          avgMultiplier: 0,
          blockedPoints: 0
        });
        setUserBets([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return; // Stop fetching group-specific data
      }

      // --- Fetch group-specific data (only if member) ---
      console.log(`Fetching group data for member in group: ${localCurrentGroupId}`);
      const [pointsHistoryResult, betsResult, blockedPointsResult] = await Promise.all([
        supabase
          .from('PointsHistory')
          .select('amount, timestamp')
          .eq('user', userData.id)
          .eq('group', localCurrentGroupId)
          .order('timestamp', { ascending: true }),
        supabase
          .from('Bets')
          .select(`
            id,
            amount,
            created_at,
            multiplier,
            game:BettingGame!inner (
              id,
              title,
              deadline,
              decided_at,
              group
            ),
            option:BettingOption (
              id,
              title,
              is_winning
            )
          `)
          .eq('user', userData.id)
          .eq('game.group', localCurrentGroupId)
          .order('created_at', { ascending: false }),
        // Optimized query for blocked points
        supabase
          .from('Bets')
          .select('amount, game:BettingGame!inner(decided_at, group)')
          .eq('user', userData.id)
          .eq('game.group', localCurrentGroupId)
          .is('game.decided_at', null)
      ]);

      // Process results and handle potential errors
      if (pointsHistoryResult.error) console.error("Error fetching points history:", pointsHistoryResult.error);
      if (betsResult.error) console.error("Error fetching bets:", betsResult.error);
      if (blockedPointsResult.error) console.error("Error fetching blocked points:", blockedPointsResult.error);

      const pointsHistory = pointsHistoryResult.data || [];
      const rawBets = (betsResult.data as unknown as RawBetData[]) || [];
      const blockedPointsData = blockedPointsResult.data || [];

      const totalBlocked = blockedPointsData.reduce((sum, bet) => sum + bet.amount, 0);

      // Transform the bets data
      const formattedBets: UserBet[] = rawBets.map((bet) => {
        // Added check for null option which can happen with RLS or deleted options
        const isWinning = bet.option ? bet.option.is_winning === true : false;
        const optionTitle = bet.option ? bet.option.title : t('Option supprimée');
        const optionId = bet.option ? bet.option.id : "deleted";

        return {
          id: String(bet.id),
          amount: bet.amount,
          created_at: bet.created_at,
          game: {
            id: String(bet.game.id),
            title: bet.game.title,
            deadline: bet.game.deadline,
            decided_at: bet.game.decided_at
          },
          option: {
            id: optionId,
            title: optionTitle,
            is_winning: isWinning
          },
          multiplier: bet.multiplier
        };
      });


      // --- Calculate statistics ---
      const currentBalance = pointsHistory.length > 0
        ? Math.round(pointsHistory[pointsHistory.length - 1].amount)
        : 0;

      const balanceHistory = pointsHistory.map(record => ({
        timestamp: new Date(record.timestamp).toISOString(),
        balance: Math.round(record.amount)
      }));

      // Use formattedBets for calculations
      const totalBets = formattedBets.length;
      const decidedBets = formattedBets.filter(bet => bet.game.decided_at !== null);
      // Ensure option exists before checking is_winning
      const winningBets = formattedBets.filter(bet => bet.option?.id !== 'deleted' && bet.option.is_winning === true).length;
      const winRate = decidedBets.length > 0 ? (winningBets / decidedBets.length) * 100 : 0;

      const avgBetAmount = totalBets > 0
        ? Math.round(formattedBets.reduce((sum, bet) => sum + bet.amount, 0) / totalBets)
        : 0;

      const largestBet = totalBets > 0
        ? Math.max(...formattedBets.map(bet => bet.amount))
        : 0;

      const avgMultiplier = totalBets > 0
        ? formattedBets.reduce((sum, bet) => sum + bet.multiplier, 0) / totalBets
        : 0;

      // Update state
      setUserStats({
        username: userData.username,
        bio: userData.bio,
        totalBets: totalBets,
        totalPoints: currentBalance,
        winRate: winRate,
        pointsHistory: balanceHistory,
        avgBetAmount: avgBetAmount,
        largestBet: largestBet,
        avgMultiplier: avgMultiplier,
        blockedPoints: totalBlocked
      });

      setUserBets(formattedBets);

      console.log("Fetch complete, setting loading states to false");
      setIsLoading(false);
      setIsRefreshing(false);
    };

    // Only run fetch if supabase client is available
    if (supabase) {
      fetchUserData().catch(error => {
        console.error("Error fetching user data:", error);
        toast.error(t('Erreur lors du chargement des données du profil.'));
        // Ensure loading states are turned off on error
        setIsLoading(false);
        setIsRefreshing(false);
        // Clear potentially partial data
        setUserStats(null);
        setUserBets([]);
        setProfileUser(null);
      });
    } else {
      console.log("Supabase client not ready, skipping fetch");
      // Keep loading true if supabase isn't ready yet
      if (!isLoading) setIsLoading(true);
      setIsRefreshing(false);
    }

    // Note: Removed handleEmptyBets function, logic is now inline

  }, [username, supabase, currentGroupId, isLoading, profileUser]); // Added isLoading and profileUser to dependencies for more robust state handling logic

  // Chart configuration - match the structure used in BetChart.tsx
  const chartConfig: ChartConfig = {
    balance: {
      label: "Nombre de points ",
      color: "hsl(var(--primary))",
    }
  };

  // Add this function to handle bio updates
  const handleBioUpdate = async () => {
    if (!currentUser) return;
    
    try {
      const { error } = await supabase
        .from('Users')
        .update({ bio: editedBio })
        .eq('username', username);

      if (error) throw error;

      // Update local state
      setUserStats(prev => prev ? { ...prev, bio: editedBio } : null);
      setIsBioDialogOpen(false);
      
      toast.success(t('Bio mise à jour avec succès'));
    } catch (error) {
      console.error('Error updating bio:', error);
      toast.error(t('Impossible de mettre à jour la bio'));
    }
  };

  // When fetching user data, initialize editedBio
  useEffect(() => {
    const bio = userStats?.bio ?? null;
    setEditedBio(bio || "");
  }, [userStats?.bio]);

  // Update the groupBetsByGame function to work with the new UserBet structure
  const groupBetsByGame = (bets: UserBet[]): GroupedBets[] => {
    const grouped = bets.reduce((acc, bet) => {
      const gameId = bet.game.id;
      if (!acc[gameId]) {
        acc[gameId] = {
          gameId,
          gameTitle: bet.game.title,
          gameDeadline: bet.game.deadline,
          gameDecidedAt: bet.game.decided_at,
          bets: [],
          totalAmount: 0,
          isWinning: null,
          netProfit: 0
        };
      }
      acc[gameId].bets.push(bet);
      acc[gameId].totalAmount += bet.amount;

      // Calculate net profit contribution *only* for decided games
      if (bet.game.decided_at) {
        const betProfit = bet.option.is_winning
          ? Math.round(bet.amount * (bet.multiplier - 1))
          : -bet.amount;
        // Ensure netProfit is initialized if it's the first decided bet for the game
        acc[gameId].netProfit = (acc[gameId].netProfit || 0) + betProfit;
      }

      return acc;
    }, {} as Record<string, GroupedBets>);

    // Now, determine isWinning based on the final netProfit for decided games
    Object.values(grouped).forEach(group => {
      if (group.gameDecidedAt) {
        // Round the final netProfit before comparison
        group.netProfit = Math.round(group.netProfit || 0);
        group.isWinning = group.netProfit > 0;
      }
    });

    return Object.values(grouped).sort((a, b) =>
      new Date(b.gameDeadline).getTime() - new Date(a.gameDeadline).getTime()
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 sm:py-8 animate-pulse">
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 sm:mb-12">
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-primary/10 animate-pulse"></div>
          <div className="space-y-4 flex-1">
            <div className="h-8 w-64 bg-primary/10 rounded animate-pulse"></div>
            <div className="h-4 w-full max-w-md bg-primary/5 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="grid gap-4 sm:gap-6 grid-cols-2 sm:grid-cols-3 mb-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-primary/5 animate-pulse shadow"></div>
          ))}
        </div>
        <div className="h-[300px] w-full rounded-2xl bg-primary/5 animate-pulse mb-8"></div>
        <div className="h-[400px] w-full rounded-2xl bg-primary/5 animate-pulse"></div>
      </div>
    );
  }

  if (!userStats) {
    return (
      <div className="container mx-auto p-8 flex flex-col items-center justify-center h-[60vh] text-center">
        <DiceIcon className="h-12 w-12 text-primary/50 mb-4" />
        <h1 className="text-2xl font-bold text-primary mb-2">{t('Utilisateur non trouvé')}</h1>
        <p className="text-muted-foreground max-w-md">{t('Nous n&apos;avons pas pu trouver l&apos;utilisateur que vous recherchez. Vérifiez le nom d&apos;utilisateur et réessayez.')}</p>
      </div>
    );
  }

  // Transform points history for chart - needs to match BetChart expectations
  const chartData = userStats.pointsHistory.map((record, index) => ({
    bets: index, // BetChart expects a 'bets' field for X-axis
    balance: record.balance // Remove the /100 conversion since we want actual points
  }));

  // Add this filter function
  const filteredBets = userBets.filter((bet) =>
    bet.game.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-10 max-w-6xl">
      {currentUser && transformToAppUser(currentUser) && (
        <GroupsManager 
          user={transformToAppUser(currentUser) as AppUser}
          isMobile={isMobile}
        />
      )}
      
      {!currentGroupId ? null : (
        isMemberOfCurrentGroup === false ? (
          // Display message if user is not part of the selected group
          <div className="flex flex-col items-center justify-center text-center py-10 sm:py-16 px-4">
            <Users className="h-10 w-10 sm:h-16 sm:w-16 text-primary/40 mb-3 sm:mb-5" />
            <h2 className="text-lg sm:text-2xl font-semibold text-primary/90 mb-1 sm:mb-2">{t('Non membre')}</h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-md">
              {t('L&apos;utilisateur')} <span className="font-medium text-primary/80">{userStats.username}</span> {t('ne fait pas partie de la salle sélectionnée.')}
            </p>
          </div>
        ) : isMemberOfCurrentGroup === true ? (
          <div className="space-y-6 sm:space-y-8 relative">
            {isRefreshing && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
                {/* Optional: Add a spinner or message here */}
              </div>
            )}
            
            <div className="relative p-4 sm:p-8 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10 shadow-lg border border-primary/10">
              <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8 text-center sm:text-left">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-lg border-2 border-white/20 backdrop-blur-sm">
                  <span className="text-3xl sm:text-4xl font-bold text-primary/90">
                    {userStats.username[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-4xl font-bold mb-2 text-primary/90">{userStats.username}</h1>
                  <div className="flex items-start w-full group relative">
                    <p className="text-sm sm:text-base break-all sm:break-normal overflow-hidden opacity-80 max-w-xl">
                      {userStats.bio || t('Aucune bio')}
                    </p>
                    {currentUser?.username === profileUser?.username && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 hover:bg-primary/10 ml-2 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity rounded-full"
                        onClick={() => setIsBioDialogOpen(true)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Bio Edit Dialog */}
            <Dialog open={isBioDialogOpen} onOpenChange={setIsBioDialogOpen}>
              <DialogContent 
                className="sm:max-w-[425px] p-4 pt-6 sm:pt-6 sm:p-6 flex flex-col max-h-[90vh] my-auto"
                fullScreenOnMobile={true}
              >
                <DialogHeader className="mb-4">
                  <DialogTitle>{t('Modifier la bio')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Textarea
                      value={editedBio}
                      onChange={(e) => setEditedBio(e.target.value)}
                      placeholder={t('Écrivez votre bio ici...')}
                      maxLength={60}
                      className="min-h-[120px] resize-none w-full transition-all duration-200 focus-visible:ring-offset-1 border-input/50 shadow-sm pr-12"
                    />
                    <div className="absolute right-3 bottom-3 text-xs font-medium rounded-full px-1.5 py-0.5 bg-muted/80 text-muted-foreground">
                      {editedBio.length}/60
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex justify-end gap-2 mt-4 pt-2 border-t border-border/40">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsBioDialogOpen(false);
                      setEditedBio(userStats.bio || "");
                    }}
                    className="transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                  >
                    {t('Annuler')}
                  </Button>
                  <Button 
                    onClick={handleBioUpdate}
                    className="shadow-md transition-all bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:shadow-lg"
                  >
                    {t('Enregistrer')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="grid gap-3 sm:gap-6 grid-cols-2 sm:grid-cols-3">
              {[
                { icon: <DiceIcon className="h-4 w-4 sm:h-5 sm:w-5" />, title: t('Paris joués'), value: userStats.totalBets.toLocaleString() },
                { 
                  icon: <Coins className="h-4 w-4 sm:h-5 sm:w-5" />, 
                  title: t('Points'), 
                  value: (
                    <div className="flex items-center gap-2 sm:gap-4">
                      <span className="text-2xl sm:text-4xl font-bold">{userStats.totalPoints.toLocaleString()}</span>
                      {(userStats.blockedPoints || 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="font-semibold text-sm sm:text-base">{userStats.blockedPoints?.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )
                },
                { 
                  icon: <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />, 
                  title: t('Taux de victoire'), 
                  value: (
                    <span className={cn(
                      "text-2xl sm:text-4xl font-bold",
                      userStats.winRate > 60 ? "text-green-500" : 
                      userStats.winRate < 30 ? "text-red-500" : ""
                    )}>
                      {userStats.winRate.toFixed(0)}%
                    </span>
                  )
                },
                { icon: <Target className="h-4 w-4 sm:h-5 sm:w-5" />, title: t('Mise moyenne'), value: Math.round(userStats.avgBetAmount).toLocaleString() },
                { icon: <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />, title: t('Mise la plus élevée'), value: userStats.largestBet.toLocaleString() },
                { icon: <Gauge className="h-4 w-4 sm:h-5 sm:w-5" />, title: t('Côte moyenne'), value: `${userStats.avgMultiplier.toFixed(1)}x` },
              ].map((stat, index) => (
                <Card key={index} className="overflow-hidden group border-primary/5 transition-all duration-300 hover:shadow-md hover:border-primary/20">
                  <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-sm sm:text-lg text-muted-foreground flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                      <span className="text-primary/70 group-hover:text-primary transition-colors">{stat.icon}</span>
                      {stat.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                    {typeof stat.value === 'string' ? (
                      <p className="text-2xl sm:text-4xl font-bold">{stat.value}</p>
                    ) : (
                      stat.value
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-primary/5 overflow-hidden shadow-sm">
              <CardHeader className="pt-2 pb-2 border-b border-primary/5 bg-accent/30">
                <CardTitle className="text-lg sm:text-2xl font-bold text-primary/90">{t('Progression des points')}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <div className="h-[200px] sm:h-[400px] w-full overflow-hidden rounded-xl">
                  {chartData.length <= 1 ? (
                    <div className="flex flex-col items-center justify-center h-full bg-primary/5 rounded-xl p-3 sm:p-4 text-center">
                      <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-6">{t('Aucun historique de transactions disponible')}</p>
                      {chartData.length === 1 && (
                        <div className="flex flex-col items-center p-3 sm:p-6 rounded-xl bg-card shadow-lg">
                          <span className="text-3xl sm:text-5xl font-bold text-primary">
                            {Math.round(chartData[0].balance).toLocaleString()}
                          </span>
                          <span className="text-sm sm:text-sm text-muted-foreground mt-1 sm:mt-3">Points</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ChartContainer config={chartConfig} className="w-full h-full">
                        <LineChart 
                          data={chartData}
                          margin={{ top: 20, right: 10, bottom: 20, left: 10 }}
                        >
                          <defs>
                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
                            </linearGradient>
                          </defs>
                          <XAxis 
                            dataKey="bets" 
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis 
                            domain={['dataMin', 'dataMax']}
                            scale="linear"
                            tickCount={6}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            width={50}
                            tickFormatter={(value) => `${value}`}
                            tick={{ fontSize: 12 }}
                          />
                          <ChartTooltip 
                            content={
                              <ChartTooltipContent 
                                labelKey="bets"
                                className="p-3 min-w-0 shadow-lg border border-primary/10 backdrop-blur-sm"
                                formatter={(value) => (
                                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="font-bold">{Math.round(Number(value)).toLocaleString()}</span>
                                    <Image src="/coin.png" alt="points" width={16} height={16} className="h-4 w-4" />
                                  </div>
                                )}
                              />
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="balance"
                            stroke={chartConfig.balance.color}
                            strokeWidth={3}
                            dot={false}
                            activeDot={{
                              stroke: "hsl(var(--primary))",
                              strokeWidth: 2,
                              r: 4,
                              fill: "white"
                            }}
                            yAxisId={0}
                            name="balance"
                            fill="url(#colorBalance)"
                          />
                        </LineChart>
                      </ChartContainer>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/5 overflow-hidden shadow-sm">
              <CardHeader className="pt-2 pb-2 border-b border-primary/5 bg-accent/30">
                <CardTitle className="text-lg sm:text-2xl font-bold text-primary/90">{t('Historique des paris')}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <div className="relative mb-3 sm:mb-6">
                  <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('Rechercher un pari...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 sm:pl-10 py-1.5 sm:py-2 text-xs sm:text-sm border-primary/10 focus-visible:ring-primary/30"
                  />
                </div>

                {filteredBets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 sm:py-10 text-center">
                    <DiceIcon className="h-8 w-8 sm:h-12 sm:w-12 text-primary/30 mb-2 sm:mb-4" />
                    <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">{t('Aucun pari trouvé')}</h3>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-md">
                      {searchQuery 
                        ? t('Aucun pari ne correspond à votre recherche. Essayez d\'autres termes.')
                        : t('Aucun pari n\'a été placé dans cette salle pour le moment.')}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[350px] sm:h-[450px] pr-1 sm:pr-4">
                    <div className="space-y-1.5 sm:space-y-2">
                      {groupBetsByGame(filteredBets).map((group) => (
                        <Collapsible key={group.gameId} className="w-full">
                          <CollapsibleTrigger className="w-full">
                            <div className={cn(
                              "flex items-center justify-between gap-2 sm:gap-4 p-1.5 sm:p-3 rounded-lg transition-all duration-300 hover:shadow-md relative",
                              "border border-transparent hover:border-primary/10 group",
                              group.gameDecidedAt
                                ? group.isWinning
                                  ? "bg-green-500/5 hover:bg-green-500/10"
                                  : "bg-red-500/5 hover:bg-red-500/10"
                                : "bg-accent/30 hover:bg-accent/50"
                            )}>
                              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                                <div className="flex flex-col items-start min-w-0">
                                  <a 
                                    href={`/bet/${group.gameId}`}
                                    className="text-xs sm:text-base font-semibold text-primary/90 hover:text-primary hover:underline cursor-pointer z-10 relative truncate max-w-[225px] sm:max-w-full"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {group.gameTitle}
                                  </a>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                                <NetProfitDisplay 
                                  amount={group.gameDecidedAt ? Math.round(group.netProfit || 0) : group.totalAmount} 
                                  isWinning={group.isWinning} 
                                />
                                {group.gameDecidedAt && (
                                  <div className="flex items-center">
                                    {group.isWinning ? (
                                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                                    ) : (
                                      <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                                    )}
                                  </div>
                                )}
                                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-1 sm:pt-2">
                            <div className="space-y-1 sm:space-y-2 pl-2 sm:pl-4">
                              {group.bets.map((bet) => (
                                <div
                                  key={bet.id}
                                  className={cn(
                                    "flex items-center justify-between gap-2 sm:gap-4 p-1.5 sm:p-3 rounded-lg transition-all duration-300 hover:shadow-md relative",
                                    "border border-transparent hover:border-primary/10",
                                    "bg-accent/20 hover:bg-accent/30"
                                  )}
                                >
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-xs sm:text-base truncate block">{bet.option.title}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                                    <span className="font-bold text-primary inline-flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs sm:text-sm">
                                      {bet.amount}
                                      <Image src="/coin.png" alt="points" width={16} height={16} className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </span>
                                    <span className="text-muted-foreground text-xs sm:text-sm whitespace-nowrap">x{bet.multiplier.toFixed(1)}</span>
                                    {bet.game.decided_at && (
                                      <div className="flex items-center">
                                        {bet.option.is_winning ? (
                                          <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                                        ) : (
                                          <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          // Optional: Display a loading or intermediate state while membership is checked
          <div className="flex justify-center items-center py-16">
             {/* You could put a spinner here if needed */}
          </div>
        )
      )}
    </div>
  );
}

// Main page component becomes a wrapper that uses Suspense
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  return (
    <Suspense fallback={
      <div className="container mx-auto p-4 sm:py-8 max-w-6xl">
        <div className="h-24 w-full rounded-xl bg-primary/5 animate-pulse mb-6"></div>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 mb-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-primary/5 animate-pulse"></div>
          ))}
        </div>
        <div className="h-[300px] rounded-xl bg-primary/5 animate-pulse mb-6"></div>
        <div className="h-[400px] rounded-xl bg-primary/5 animate-pulse"></div>
      </div>
    }>
      <ProfileContent params={params} />
    </Suspense>
  );
}
