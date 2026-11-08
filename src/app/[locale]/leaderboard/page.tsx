'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Search, Coins, Target, TrendingUp, Gauge, Dices as DiceIcon, StarIcon } from "lucide-react"
import { useSupabase } from "@/lib/supabase/context"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import Image from 'next/image'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { motion, AnimatePresence } from "framer-motion"
import GroupsManager from '@/components/GroupsManager'
import { getUser } from '@/lib/supabase/helpers'
import { useGroup } from '@/lib/group/context'
import { calculateMultiplier } from '@/lib/utils/bet-multiplier'
import { transformToAppUser } from '@/lib/utils/user-helpers'
import { useTranslation } from 'react-i18next'

interface UserLeaderboardData {
  id: string
  username: string
  totalPoints: number
  totalBets: number
  winRate: number
  avgBetAmount: number
  largestBet: number
  avgMultiplier: number
}

interface BettingOption {
  id: string
  is_winning: boolean | null
}

interface Bet {
  id: string
  user: string
  amount: number
  option: string
  created_at: string
  game: string
}

type SortCriterion = 'totalPoints' | 'winRate' | 'totalBets' | 'avgBetAmount' | 'largestBet' | 'avgMultiplier'

interface User {
  id: string
  email?: string
  app_metadata: {
    provider?: string
    [key: string]: unknown
  }
  user_metadata: {
    [key: string]: unknown
  }
  aud: string
  created_at: string
  [key: string]: unknown  // Add index signature for BaseUser compatibility
}



export default function LeaderboardPage() {
  const [users, setUsers] = useState<UserLeaderboardData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortCriterion, setSortCriterion] = useState<SortCriterion>('totalPoints')
  const [previousCriterion, setPreviousCriterion] = useState<SortCriterion>('totalPoints')
  const { currentGroupId, userGroups } = useGroup()
  const [user, setUser] = useState<User | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const supabase = useSupabase()
  const { t } = useTranslation('leaderboard')
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

  // Add useEffect to get current user
  useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await getUser(supabase);
        setUser(user as User | null);
      } catch (error) {
        console.error('Session check error:', error);
        setUser(null);
      }
    };
    checkUser();
  }, [supabase]);

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      setIsLoading(true)
      
      try {
        // First, get the list of users based on group membership
        let usersQuery = supabase
          .from('Users')
          .select('id, username')
          .eq('is_banned', false)

        // Always filter by group membership
        const { data: groupMembers, error: groupError } = await supabase
          .from('UsersGroupMembership')
          .select('user')
          .eq('group', currentGroupId)

        if (groupError) throw groupError

        // Get only the user IDs that are members of the group
        const memberUserIds = groupMembers?.map(member => member.user) || []
        usersQuery = usersQuery.in('id', memberUserIds)

        const { data: usersData, error: usersError } = await usersQuery

        if (usersError) throw usersError

        // Get all the betting games for the current group
        const { data: gamesData } = await supabase
          .from('BettingGame')
          .select('id, decided_at, group')
          .eq('group', currentGroupId)

        if (!gamesData) throw new Error('Failed to fetch games data')
        
        const gameIds = gamesData.map(game => game.id)
        
        // Get all options for these games
        const { data: optionsData } = await supabase
          .from('BettingOption')
          .select('id, game, is_winning')
          .in('game', gameIds)
        
        if (!optionsData) throw new Error('Failed to fetch options data')
        
        // Group options by game
        const optionsByGame: Record<string, BettingOption[]> = {}
        optionsData.forEach(option => {
          if (!optionsByGame[option.game]) {
            optionsByGame[option.game] = []
          }
          optionsByGame[option.game].push({ id: option.id, is_winning: option.is_winning })
        })
        
        // Get all bets for these games, ordered by creation time
        const { data: allBetsData } = await supabase
          .from('Bets')
          .select('id, user, amount, option, created_at, game')
          .in('game', gameIds)
          .order('created_at', { ascending: true })
        
        if (!allBetsData) throw new Error('Failed to fetch bets data')
        
        // Group bets by game
        const betsByGame: Record<string, Bet[]> = {}
        allBetsData.forEach(bet => {
          if (!betsByGame[bet.game]) {
            betsByGame[bet.game] = []
          }
          betsByGame[bet.game].push(bet)
        })

        // Process each user to get their stats
        const usersWithStats = await Promise.all(
          usersData.map(async (user) => {
            // Get latest points balance for the selected group
            const { data: pointsData } = await supabase
              .from('PointsHistory')
              .select('amount')
              .eq('user', user.id)
              .eq('group', currentGroupId)
              .order('timestamp', { ascending: false })
              .limit(1)

            const totalPoints = pointsData && pointsData.length > 0 ? pointsData[0].amount : 0

            // Get user's bets for this group
            const userBets = allBetsData.filter(bet => bet.user === user.id)
            
            // Calculate the multiplier for each bet
            const multipliers = userBets.map(userBet => {
              const gameBets = betsByGame[userBet.game]
              const options = optionsByGame[userBet.game]
              
              if (!gameBets || !options) return 0
              
              // Get only the bets made before this user bet
              const betTime = new Date(userBet.created_at).getTime()
              const previousBets = gameBets.filter(bet => 
                new Date(bet.created_at).getTime() < betTime
              )
              
              // Calculate the multiplier for this bet
              return calculateMultiplier(userBet.option, previousBets, options)
            })
            
            // Calculate statistics
            const totalBets = userBets.length
            
            const gamesMap = new Map(gamesData.map(game => [game.id, game]))
            
            const decidedBets = userBets.filter(bet => {
              const game = gamesMap.get(bet.game)
              return game && game.decided_at !== null
            })
            
            const winningBets = userBets.filter(bet => {
              const option = optionsData.find(opt => opt.id === bet.option)
              return option && option.is_winning === true
            }).length
            
            const winRate = decidedBets.length > 0 
              ? (winningBets / decidedBets.length) * 100 
              : 0
            
            const betAmounts = userBets.map(bet => bet.amount)
            
            const avgBetAmount = betAmounts.length > 0 
              ? betAmounts.reduce((sum, amount) => sum + amount, 0) / betAmounts.length 
              : 0
            
            const largestBet = betAmounts.length > 0 
              ? Math.max(...betAmounts) 
              : 0
            
            const avgMultiplier = multipliers.length > 0 
              ? multipliers.reduce((sum, mult) => sum + mult, 0) / multipliers.length 
              : 0

            return {
              id: user.id,
              username: user.username,
              totalPoints,
              totalBets,
              winRate,
              avgBetAmount,
              largestBet,
              avgMultiplier
            }
          })
        )

        setUsers(usersWithStats)
      } catch (error) {
        console.error('Error fetching leaderboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (currentGroupId) {
      fetchLeaderboardData()
    } else {
      setIsLoading(false)
    }
  }, [supabase, currentGroupId])

  // Sort users based on the selected criterion
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => b[sortCriterion] - a[sortCriterion])
  }, [users, sortCriterion])

  // Client-side filtering with useMemo
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return sortedUsers;
    return sortedUsers.filter(user => 
      user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedUsers, searchTerm]);

  // Calculate width percentages for each user based on current sort criterion
  const calculateWidths = useCallback((criterion: SortCriterion): Record<string, number> => {
    if (users.length === 0) return {};
    
    const maxVal = Math.max(...users.map(user => user[criterion]));
    if (maxVal === 0) return {};
    
    const widths: Record<string, number> = {};
    users.forEach(user => {
      widths[user.id] = (user[criterion] / maxVal) * 100;
    });
    
    return widths;
  }, [users]);

  // Current widths based on active sort criterion
  const currentWidths = useMemo(() => {
    return calculateWidths(sortCriterion);
  }, [calculateWidths, sortCriterion]);
  
  // Previous widths to animate from when changing criterion
  const previousWidths = useMemo(() => {
    return calculateWidths(previousCriterion);
  }, [calculateWidths, previousCriterion]);

  // Handle sort criterion change (with animation)
  const handleSortChange = (value: string) => {
    setPreviousCriterion(sortCriterion);
    setSortCriterion(value as SortCriterion);
  };

  // Get icon for current sort criterion
  const getSortIcon = (criterion: SortCriterion) => {
    switch (criterion) {
      case 'totalPoints': return <Coins className="h-full w-full" />
      case 'winRate': return <Trophy className="h-full w-full" />
      case 'totalBets': return <DiceIcon className="h-full w-full" />
      case 'avgBetAmount': return <Target className="h-full w-full" />
      case 'largestBet': return <TrendingUp className="h-full w-full" />
      case 'avgMultiplier': return <Gauge className="h-full w-full" />
      default: return <StarIcon className="h-full w-full" />
    }
  }

  // Get value display formatter based on criterion
  const formatValue = (user: UserLeaderboardData, criterion: SortCriterion) => {
    switch (criterion) {
      case 'totalPoints': return user.totalPoints.toLocaleString()
      case 'winRate': return `${user.winRate.toFixed(1)}%`
      case 'totalBets': return user.totalBets.toString()
      case 'avgBetAmount': return user.avgBetAmount.toFixed(0)
      case 'largestBet': return user.largestBet.toLocaleString()
      case 'avgMultiplier': return `${user.avgMultiplier.toFixed(1)}x`
      default: return user.totalPoints.toLocaleString()
    }
  }

  return (
    <div className="container mx-auto py-4 md:py-8 relative overflow-hidden min-h-screen px-2 sm:px-4 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-4xl mx-auto">
        {user && (
          <GroupsManager 
            user={transformToAppUser(user)!}
            isMobile={isMobile}
          />
        )}

        <AnimatePresence>
          {userGroups.length > 0 ? (
            currentGroupId ? (
              <motion.div
                key="leaderboard-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-0 shadow-xl backdrop-blur-xl bg-white/90 mt-6 rounded-2xl overflow-hidden">
                  <CardHeader className="border-b-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-6 md:p-8 backdrop-blur-sm">
                    <CardTitle className="flex items-center gap-3 text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">
                      <Trophy className="h-7 w-7 md:h-9 md:w-9 text-amber-500" />
                      {t('Classement')}
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="p-4 sm:p-6 md:p-8">
                    <AnimatePresence mode="wait">
                      {isLoading ? (
                        <motion.div 
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center py-16 space-y-6"
                        >
                          <motion.div 
                            className="rounded-full h-12 w-12 border-b-2 border-blue-500"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          ></motion.div>
                          <p className="text-gray-600 font-medium text-base">{t('Chargement du classement...')}</p>
                        </motion.div>
                      ) : users.length === 0 ? (
                        <motion.div 
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-center py-16"
                        >
                          <p className="text-gray-600 font-medium text-base">{t('Aucune donnée de classement disponible')}</p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="content"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-2.5 h-4 w-4 sm:left-4 sm:top-3 sm:h-4 sm:w-4 text-gray-400" />
                              <Input
                                type="text"
                                placeholder={t('Rechercher un utilisateur...')}
                                className="pl-9 sm:pl-11 h-9 sm:h-10 text-sm sm:text-base bg-gray-100/80 border-0 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/30 transition-all duration-200 font-medium placeholder:text-gray-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                              />
                            </div>
                            
                            <div className="flex gap-3 items-center whitespace-nowrap">
                              <Select 
                                value={sortCriterion} 
                                onValueChange={handleSortChange}
                              >
                                <SelectTrigger className="w-full sm:w-[200px] h-9 sm:h-10 text-sm sm:text-base bg-gray-100/80 border-0 rounded-xl hover:bg-gray-200/80 transition-all duration-200">
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    <motion.div
                                      key={sortCriterion}
                                      initial={{ scale: 0.8, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      transition={{ duration: 0.3 }}
                                      className="h-3 w-3 sm:h-4 sm:w-4"
                                    >
                                      {getSortIcon(sortCriterion)}
                                    </motion.div>
                                    <SelectValue placeholder={t('Critère de tri')} className="text-xs sm:text-base" />
                                  </div>
                                </SelectTrigger>
                                <SelectContent className="text-sm sm:text-base border-0 shadow-2xl rounded-2xl bg-white/95 backdrop-blur-xl">
                                  <SelectItem value="totalPoints">{t('Points totaux')}</SelectItem>
                                  <SelectItem value="winRate">{t('Taux de victoire')}</SelectItem>
                                  <SelectItem value="totalBets">{t('Nombre de paris')}</SelectItem>
                                  <SelectItem value="avgBetAmount">{t('Mise moyenne')}</SelectItem>
                                  <SelectItem value="largestBet">{t('Plus grosse mise')}</SelectItem>
                                  <SelectItem value="avgMultiplier">{t('Multiplicateur moyen')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-2 sm:space-y-3">
                            {filteredUsers.length === 0 ? (
                              <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-8"
                              >
                                <p className="text-gray-500 text-base font-medium">{t('Aucun utilisateur trouvé')}</p>
                              </motion.div>
                            ) : (
                              <AnimatePresence initial={false}>
                                {filteredUsers.map((user, index) => {
                                  // Find original index in sortedUsers to maintain global rank
                                  const originalIndex = sortedUsers.findIndex(u => u.id === user.id);
                                  
                                  return (
                                    <motion.div
                                      key={user.id}
                                      layout
                                      initial={{ opacity: 0, y: 20 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{
                                        opacity: { duration: 0.3 },
                                        layout: { duration: 0.3 },
                                        y: { duration: 0.3 },
                                        height: { duration: 0.3 },
                                        delay: index * 0.05 // Stagger effect
                                      }}
                                      className="relative group"
                                    >
                                      <div className="absolute inset-0 bg-gray-50/50 rounded-2xl shadow-sm">
                                        <motion.div 
                                          className={`h-full rounded-2xl ${
                                            originalIndex === 0 ? 'bg-gradient-to-r from-yellow-400/40 to-amber-300/60' : 
                                            originalIndex === 1 ? 'bg-gradient-to-r from-gray-200/40 to-gray-100/60' : 
                                            originalIndex === 2 ? 'bg-gradient-to-r from-amber-600/40 to-amber-400/60' : 
                                            'bg-gradient-to-r from-blue-100/40 to-indigo-100/60'
                                          }`}
                                          key={`${user.id}-width-${sortCriterion}`}
                                          initial={{ width: `${previousWidths[user.id] || 0}%` }}
                                          animate={{ width: `${currentWidths[user.id] || 0}%` }}
                                          transition={{ duration: 0.5, ease: "easeOut" }}
                                        />
                                      </div>
                                      <div className="relative flex items-center justify-between px-3 py-2 sm:px-4 sm:py-2 md:px-5 md:py-2">
                                        <div className="flex items-center gap-2 sm:gap-2 md:gap-3 flex-1">
                                          <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full 
                                            ${originalIndex === 0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-lg shadow-yellow-200/50' :
                                            originalIndex === 1 ? 'bg-gradient-to-br from-gray-200 to-gray-300 text-gray-700 shadow-lg shadow-gray-200/50' :
                                            originalIndex === 2 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-amber-900 shadow-lg shadow-amber-200/50' :
                                            'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800 shadow-md shadow-blue-100/50'} 
                                            text-center font-semibold text-sm sm:text-base`}>
                                            {originalIndex === 0 ? <Trophy className="h-3 w-3 sm:h-4 sm:w-4" /> : originalIndex + 1}
                                          </div>

                                          <div className="flex flex-1 items-center justify-between">
                                            <div className="font-medium text-sm sm:text-base md:text-lg">
                                              <Link 
                                                href={`/profile/${encodeURIComponent(user.username)}`} 
                                                className={`hover:opacity-70 transition-opacity duration-200 ${
                                                  originalIndex === 0 ? 'text-yellow-800 font-semibold' : 
                                                  originalIndex === 1 ? 'text-gray-600 font-semibold' : 
                                                  originalIndex === 2 ? 'text-amber-700 font-semibold' : 
                                                  'text-gray-900'
                                                }`}
                                              >
                                                {user.username}
                                              </Link>
                                              {originalIndex <= 2 && (
                                                <Badge className={`ml-2 text-xs font-medium px-2 py-1 rounded-full transition-colors duration-200 ${
                                                  originalIndex === 0 ? 'bg-yellow-100 text-yellow-800 border border-yellow-200 hover:bg-yellow-200 hover:border-yellow-300' : 
                                                  originalIndex === 1 ? 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 hover:border-gray-300' : 
                                                  'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 hover:border-amber-300'
                                                }`}>
                                                  {originalIndex === 0 ? t('Or') : originalIndex === 1 ? t('Argent') : t('Bronze')}
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <motion.div 
                                            className={`font-semibold text-sm sm:text-base md:text-lg ${
                                              originalIndex === 0 ? 'text-yellow-800' : 
                                              originalIndex === 1 ? 'text-gray-600' : 
                                              originalIndex === 2 ? 'text-amber-700' : 
                                              'text-gray-800'
                                            }`}
                                            key={`${user.id}-${sortCriterion}`}
                                            initial={{ scale: 1.2, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ duration: 0.3 }}
                                          >
                                            {formatValue(user, sortCriterion)}
                                            {sortCriterion === 'totalPoints' && (
                                              <Image src="/coin.png" alt="points" width={14} height={14} className="h-3 w-3 inline ml-1" />
                                            )}
                                          </motion.div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )
                                })}
                              </AnimatePresence>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="select-group-message"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center p-12 mt-8 bg-white/90 backdrop-blur-xl rounded-3xl shadow-lg"
              >
                <Trophy className="h-16 w-16 text-gray-400 mb-6" />
                <h3 className="text-xl font-medium text-gray-800 text-center">{t('Sélectionnez une salle pour voir le classement')}</h3>
              </motion.div>
            )
          ) : (
            <motion.div
              key="no-groups-message"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center p-12 mt-8 bg-white/90 backdrop-blur-xl rounded-3xl shadow-lg"
            >
              <Trophy className="h-16 w-16 text-gray-400 mb-6" />
              <h3 className="text-xl font-medium text-gray-800 text-center">{t('Aucune salle disponible')}</h3>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}