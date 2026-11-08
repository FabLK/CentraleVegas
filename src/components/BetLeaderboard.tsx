'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Crown, ArrowUp, ArrowDown, Minus, ChevronDown, X, Sparkles, Medal, Flame, TrendingUp } from "lucide-react"
import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "react-i18next"

interface BetParticipant {
  userId: string | number;
  username: string;
  amount: number;
  multiplier: number;
  isWinner: boolean;
  pointsWon: number;
  pointsLost?: number;
  timeOption: string;
  timestamp?: string;
}

interface BetLeaderboardProps {
  participants: BetParticipant[]
  winningOption: string
  gameStatus: 'active' | 'pending_decision' | 'decided'
  totalBetAmount: number
}

export function BetLeaderboard({
  participants
}: BetLeaderboardProps) {
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [dialogUser, setDialogUser] = useState<(BetParticipant & { netProfit?: number, bets?: BetParticipant[] }) | null>(null);
  const { t } = useTranslation('BetLeaderboard');

  // Process and sort participants only when necessary
  const processedParticipants = useMemo(() => {
    if (!participants || participants.length === 0) {
      return [];
    }
    
    // Group by user and calculate total wins/losses
    const userMap = new Map<string, BetParticipant & { netProfit?: number, bets?: BetParticipant[] }>();
    
    participants.forEach(participant => {
      const existingUser = userMap.get(participant.username);
      
      if (existingUser) {
        // Update existing user stats
        existingUser.amount += participant.amount;
        
        if (participant.isWinner) {
          existingUser.pointsWon += participant.pointsWon;
          existingUser.isWinner = true;
        } else {
          existingUser.pointsLost = (existingUser.pointsLost || 0) + participant.amount;
        }
        
        // Add bet to user's bet history
        if (!existingUser.bets) {
          existingUser.bets = [];
        }
        existingUser.bets.push(participant);
      } else {
        // Add new user with default values
        userMap.set(participant.username, {
          ...participant,
          pointsLost: participant.isWinner ? 0 : participant.amount,
          bets: [participant]
        });
      }
    });
    
    // Convert map to array and calculate net profit
    const userList = Array.from(userMap.values()).map(user => ({
      ...user,
      netProfit: user.pointsWon - (user.pointsLost || 0)
    }));
    
    // Sort by net profit (highest first)
    return userList.sort((a, b) => 
      // First by net profit
      (b.netProfit ?? 0) - (a.netProfit ?? 0) || 
      // Then by win status (winners first)
      (b.isWinner ? 1 : 0) - (a.isWinner ? 1 : 0) ||
      // Then by total bet amount
      b.amount - a.amount
    );
  }, [participants]);
  
  const toggleExpanded = (username: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(username)) {
      newExpanded.delete(username);
    } else {
      newExpanded.add(username);
    }
    setExpandedUsers(newExpanded);
  };
  
  const openUserDialog = (user: BetParticipant & { netProfit?: number, bets?: BetParticipant[] }) => {
    setDialogUser(user);
  };
  
  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return "Date inconnue";
    try {
      const date = new Date(timestamp);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return "Date invalide";
      }
      return formatDistanceToNow(date, { 
        addSuffix: true,
        locale: fr 
      });
    } catch (error) {
      console.error("Error formatting timestamp:", timestamp, error);
      return "Date invalide";
    }
  }
  
  return (
    <div className="lg:col-span-2">
      <Card className="p-0.5 sm:p-1 md:p-3 shadow-lg border-amber-200/50 dark:border-amber-800/30 overflow-hidden bg-gradient-to-b from-white to-amber-50/40 dark:from-gray-900 dark:to-amber-950/20">
        <CardContent className="p-0">
          {/* Simplified container without fixed height constraints */}
          <div className="w-full px-1.5 sm:px-3 overflow-visible">
            {processedParticipants.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3 sm:space-y-4 bg-white/80 dark:bg-gray-900/50 rounded-xl p-4 sm:p-8 border border-amber-200/30 dark:border-amber-800/20">
                <div className="w-12 h-12 sm:w-18 sm:h-18 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shadow-md">
                  <Trophy className="h-6 w-6 sm:h-9 sm:w-9 text-amber-400/70 dark:text-amber-500/70" />
                </div>
                <p className="text-muted-foreground text-sm sm:text-base font-medium">{t('Aucun parieur pour ce pari')}</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-4">
                {/* Simplified Top 3 users with medals display */}
                {processedParticipants.length > 0 && (
                  <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-2 sm:mb-4 p-2 sm:p-3 rounded-xl bg-gradient-to-b from-amber-50 to-white dark:from-gray-900/90 dark:to-gray-900/70 border border-amber-200/50 dark:border-amber-800/20 shadow-lg">
                    {/* Display top 3 players in order: 2nd, 1st, 3rd */}
                    {[1, 0, 2].map((posIndex) => {
                      const user = processedParticipants[posIndex];
                      if (!user) return <div key={`empty-${posIndex}`} className="flex flex-col items-center"></div>;
                      
                      // Position styling
                      const medal = posIndex === 0 
                        ? { icon: <Crown className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 text-yellow-500" />, color: "from-yellow-300 to-amber-400" }
                        : posIndex === 1 
                          ? { icon: <Medal className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400" />, color: "from-slate-200 to-slate-400" }
                          : { icon: <Medal className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-600" />, color: "from-amber-600 to-amber-700" };
                      
                      return (
                        <div
                          key={user.username}
                          className="flex flex-col items-center justify-start cursor-pointer"
                          onClick={() => openUserDialog(user)}
                        >
                          {/* Player avatar with medal */}
                          <div className={`mb-1 sm:mb-1.5 relative rounded-full p-1 sm:p-1.5 bg-gradient-to-r ${medal.color} shadow-lg`}>
                            <div className={`relative ${posIndex === 0 ? 'h-11 w-11 sm:h-16 sm:w-16' : 'h-9 w-9 sm:h-14 sm:w-14'} rounded-full overflow-hidden border-2 ${
                              posIndex === 0 ? 'border-yellow-200' : posIndex === 1 ? 'border-slate-200' : 'border-amber-500'
                            }`}>
                              <Avatar className="h-full w-full">
                                <AvatarImage 
                                  src={`/avatars/${Number(user.userId) % 5 + 1}.png`} 
                                  alt={user.username} 
                                />
                                <AvatarFallback className="text-base sm:text-xl font-bold">
                                  {user.username.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              
                              {/* Medal badge */}
                              <div className={`absolute -right-1 -top-1 rounded-full p-0.5 sm:p-1 bg-gradient-to-r ${medal.color} border-2 border-white shadow-md`}>
                                {medal.icon}
                              </div>
                            </div>
                          </div>
                          
                          {/* Username */}
                          <Link 
                            href={`/profile/${user.username}`}
                            className={`font-bold text-center hover:underline truncate max-w-full ${
                              posIndex === 0 ? 'text-xs sm:text-sm md:text-base text-amber-800 dark:text-amber-300' : 'text-xs sm:text-sm text-slate-800 dark:text-slate-200'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {user.username}
                          </Link>
                          
                          {/* Profit/loss indicator */}
                          <Badge className={`mt-0.5 sm:mt-1 py-0.5 px-1 sm:px-2 ${
                            user.netProfit > 0 
                              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                              : user.netProfit < 0 
                                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' 
                                : 'bg-gradient-to-r from-slate-400 to-slate-500 text-white'
                          }`}>
                            <div className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs">
                              {user.netProfit > 0 ? (
                                <>
                                  <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                  <span>+{user.netProfit}</span>
                                </>
                              ) : user.netProfit < 0 ? (
                                <>
                                  <ArrowDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                  <span>{user.netProfit}</span>
                                </>
                              ) : (
                                <>
                                  <Minus className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                  <span>0</span>
                                </>
                              )}
                              <Image src="/coin.png" width={10} height={10} className="object-contain sm:hidden" alt="Coins" />
                              <Image src="/coin.png" width={12} height={12} className="object-contain hidden sm:block" alt="Coins" />
                            </div>
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Remaining users with scrollable container */}
                {processedParticipants.length > 3 && (
                  <div className="bg-white/80 dark:bg-gray-900/50 rounded-xl shadow-lg border border-amber-200/50 dark:border-amber-800/20 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-50 via-amber-100 to-amber-50 dark:from-amber-900/20 dark:via-amber-800/20 dark:to-amber-900/20 mb-1 sm:mb-1.5 px-2 sm:px-3 py-1.5 sm:py-2.5 font-semibold text-xs sm:text-sm text-amber-800 dark:text-amber-300 flex items-center justify-between border-b border-amber-200/50 dark:border-amber-700/30">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
                        <span>{t('Autres Parieurs')}</span>
                      </div>
                      <div className="text-[10px] sm:text-xs text-amber-600/70 dark:text-amber-400/70">
                        {processedParticipants.length > 3 ? `${processedParticipants.length - 3} ${t('participant')}${processedParticipants.length - 3 > 1 ? t('s') : ''}` : ''}
                      </div>
                    </div>
                    
                    {/* Scrollable list of remaining users */}
                    <div className="space-y-1 sm:space-y-1.5 px-1.5 sm:px-2.5 pb-2 sm:pb-3.5 max-h-[250px] sm:max-h-[300px] overflow-y-auto">
                      {processedParticipants.slice(3).map((user, index) => (
                        <Collapsible
                          key={user.username}
                          open={expandedUsers.has(user.username)}
                          onOpenChange={() => toggleExpanded(user.username)}
                        >
                          <CollapsibleTrigger asChild>
                            <div 
                              className={`px-1.5 sm:px-2.5 py-1.5 sm:py-2 transition-all ${
                                expandedUsers.has(user.username) 
                                  ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30' 
                                  : 'border-transparent'
                              } hover:bg-amber-50/50 dark:hover:bg-amber-900/10 group rounded-lg cursor-pointer flex items-center justify-between border hover:border-amber-200/50 dark:hover:border-amber-800/30`}
                            >
                              <div className="flex items-center gap-1.5 sm:gap-2.5">
                                <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-900/50 dark:to-amber-800/50 text-amber-800 dark:text-amber-300 font-bold text-[10px] sm:text-xs shadow-sm">
                                  {index + 4}
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2 sm:gap-2.5">
                                  <Avatar className="h-6 w-6 sm:h-8 sm:w-8 md:h-9 md:w-9 ring-1 sm:ring-1.5 ring-amber-200/70 dark:ring-amber-700/50 group-hover:ring-amber-300 dark:group-hover:ring-amber-600/50 transition-all shadow-md">
                                    <AvatarImage 
                                      src={`/avatars/${Number(user.userId) % 5 + 1}.png`} 
                                      alt={user.username} 
                                    />
                                    <AvatarFallback className="bg-amber-100 dark:bg-amber-900/70 text-amber-800 dark:text-amber-300 font-semibold text-sm sm:text-base">
                                      {user.username.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex items-center">
                                    <Link 
                                      href={`/profile/${user.username}`}
                                      className="font-semibold hover:underline transition-all line-clamp-1 text-slate-800 dark:text-slate-200 text-xs sm:text-sm"
                                    >
                                      {user.username}
                                    </Link>
                                    <div className={`ml-1 sm:ml-1.5 flex items-center justify-center p-0.5 rounded-full transition-colors ${
                                      expandedUsers.has(user.username) 
                                        ? 'bg-amber-100 dark:bg-amber-900/50' 
                                        : 'bg-transparent'
                                    }`}>
                                      <ChevronDown className={`h-3 w-3 sm:h-3.5 sm:w-3.5 transition-transform ${
                                        expandedUsers.has(user.username) ? 'rotate-180 text-amber-600' : 'text-amber-400'
                                      }`} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center">
                                <div className="flex items-center">
                                  {user.netProfit > 0 ? (
                                    <div className="flex items-center px-1.5 sm:px-2 md:px-2.5 py-0.5 sm:py-1 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/30 rounded-full border border-green-200 dark:border-green-800/50 shadow-sm">
                                      <ArrowUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 text-green-500 mr-0.5" />
                                      <span className="text-green-600 dark:text-green-400 font-semibold text-[10px] sm:text-xs md:text-sm">+{user.netProfit}</span>
                                      <Image src="/coin.png" width={11} height={11} alt="Coins" className="object-contain ml-0.5 hidden sm:inline" />
                                      <Image src="/coin.png" width={10} height={10} alt="Coins" className="object-contain ml-0.5 sm:hidden" />
                                    </div>
                                  ) : user.netProfit < 0 ? (
                                    <div className="flex items-center px-1.5 sm:px-2 md:px-2.5 py-0.5 sm:py-1 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/30 rounded-full border border-red-200 dark:border-red-800/50 shadow-sm">
                                      <ArrowDown className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 text-red-500 mr-0.5" />
                                      <span className="text-red-600 dark:text-red-400 font-semibold text-[10px] sm:text-xs md:text-sm">{user.netProfit}</span>
                                      <Image src="/coin.png" width={11} height={11} alt="Coins" className="object-contain ml-0.5 hidden sm:inline" />
                                      <Image src="/coin.png" width={10} height={10} alt="Coins" className="object-contain ml-0.5 sm:hidden" />
                                    </div>
                                  ) : (
                                    <div className="flex items-center px-1.5 sm:px-2 md:px-2.5 py-0.5 sm:py-1 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-900/70 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                                      <Minus className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 text-slate-400 mr-0.5" />
                                      <span className="text-slate-600 dark:text-slate-400 font-semibold text-[10px] sm:text-xs md:text-sm">0</span>
                                      <Image src="/coin.png" width={11} height={11} alt="Coins" className="object-contain ml-0.5 hidden sm:inline" />
                                      <Image src="/coin.png" width={10} height={10} alt="Coins" className="object-contain ml-0.5 sm:hidden" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="bg-gradient-to-b from-amber-50/80 to-white dark:from-amber-900/10 dark:to-gray-900/60 rounded-b-lg px-1.5 sm:px-2.5 pt-1 sm:pt-1.5 pb-2 sm:pb-2.5 -mt-1 space-y-1 sm:space-y-1.5 border-x border-b border-amber-200/50 dark:border-amber-800/30 mb-1 sm:mb-1.5">
                              {user.bets?.map((bet, betIndex) => (
                                <div
                                  key={`${bet.username}-${betIndex}`}
                                  className={`flex items-center justify-between p-1.5 sm:p-2.5 rounded-lg text-[10px] sm:text-xs ${
                                    bet.isWinner 
                                      ? 'bg-gradient-to-r from-green-50 to-green-100/80 dark:from-green-900/20 dark:to-green-900/10 border border-green-200 dark:border-green-800/30 shadow-sm' 
                                      : 'bg-gradient-to-r from-red-50 to-red-100/80 dark:from-red-900/20 dark:to-red-900/10 border border-red-200 dark:border-red-800/30 shadow-sm'
                                  }`}
                                >
                                  <div className="min-w-0 truncate flex items-center gap-1 sm:gap-1.5">
                                    {bet.isWinner && <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500 dark:text-green-400" />}
                                    <div>
                                      <span className="font-medium">{bet.timeOption}</span>
                                      {bet.timestamp && (
                                        <>
                                          <span className="text-muted-foreground"> • </span>
                                          <span className="text-muted-foreground">{formatTimestamp(bet.timestamp)}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
                                    <div className="font-medium inline-flex items-center gap-0.5 sm:gap-1 bg-white/70 dark:bg-gray-900/50 px-1.5 sm:px-2 py-0.5 rounded-md shadow-sm border border-slate-200/70 dark:border-slate-700/50">
                                      {bet.amount}
                                      <Image src="/coin.png" width={11} height={11} alt="Coins" className="object-contain hidden sm:inline" />
                                      <Image src="/coin.png" width={10} height={10} alt="Coins" className="object-contain sm:hidden" />
                                    </div>
                                    <div className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-md shadow-sm ${
                                      bet.isWinner 
                                        ? 'bg-green-500 text-white font-medium' 
                                        : 'bg-red-500 text-white font-medium'
                                    }`}>
                                      <span>×{bet.multiplier.toFixed(1)}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Enhanced dialog for user details */}
          <Dialog open={!!dialogUser} onOpenChange={(open: boolean) => !open && setDialogUser(null)}>
            <DialogContent 
              className="!w-[95vw] sm:!w-auto sm:!min-w-[450px] sm:!max-w-[550px] bg-gradient-to-b from-amber-50 to-white dark:from-gray-900 dark:to-gray-950 border border-amber-200 dark:border-amber-800/50"
              onOpenAutoFocus={(e: Event) => e.preventDefault()}
              fullScreenOnMobile={false}
              hideCloseButton={true}
            >
              <DialogHeader className="pb-1.5 sm:pb-2 border-b border-amber-200/50 dark:border-amber-800/30">
                <DialogTitle className="flex items-center gap-2 sm:gap-3">
                  <div className="p-0.5 sm:p-1 bg-gradient-to-r from-amber-200 to-amber-300 dark:from-amber-700 dark:to-amber-800 rounded-full shadow-md">
                    <Avatar className="h-7 w-7 sm:h-9 sm:w-9 border-2 border-white dark:border-gray-800">
                      <AvatarImage 
                        src={dialogUser ? `/avatars/${Number(dialogUser.userId) % 5 + 1}.png` : ''} 
                        alt={dialogUser?.username || ''} 
                      />
                      <AvatarFallback className="text-sm sm:text-base font-bold bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                        {dialogUser?.username.charAt(0).toUpperCase() || ''}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm sm:text-base font-bold text-amber-800 dark:text-amber-300">{dialogUser?.username}</span>
                    {dialogUser?.netProfit !== undefined && (
                      <div className="flex items-center gap-1 text-xs sm:text-sm">
                        <span className="text-muted-foreground">{t('Résultat')}:</span>
                        <span className={`font-semibold ${
                          dialogUser.netProfit > 0 ? 'text-green-600 dark:text-green-400' : 
                          dialogUser.netProfit < 0 ? 'text-red-600 dark:text-red-400' : 
                          'text-slate-600 dark:text-slate-400'
                        }`}>
                          {dialogUser.netProfit > 0 ? '+' : ''}{dialogUser.netProfit}
                        </span>
                        <Image src="/coin.png" width={12} height={12} alt="Coins" className="object-contain hidden sm:inline" />
                        <Image src="/coin.png" width={11} height={11} alt="Coins" className="object-contain sm:hidden" />
                      </div>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-1 sm:space-y-1.5 py-1.5 sm:py-2 max-h-[60vh] overflow-y-auto">
                {dialogUser?.bets?.map((bet, betIndex) => (
                  <div
                    key={`${bet.username}-${betIndex}`}
                    className={`flex items-center justify-between p-2 sm:p-2.5 rounded-lg text-[10px] sm:text-xs md:text-sm ${
                      bet.isWinner 
                        ? 'bg-gradient-to-r from-green-50 to-green-100/80 dark:from-green-900/20 dark:to-green-900/10 border border-green-200 dark:border-green-800/30 shadow-sm' 
                        : 'bg-gradient-to-r from-red-50 to-red-100/80 dark:from-red-900/20 dark:to-red-900/10 border border-red-200 dark:border-red-800/30 shadow-sm'
                    }`}
                  >
                    <div className="min-w-0 truncate flex items-center gap-1.5 sm:gap-2">
                      {bet.isWinner && <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500 dark:text-green-400" />}
                      <div>
                        <span className="font-semibold">{bet.timeOption}</span>
                        {bet.timestamp && (
                          <>
                            <span className="text-muted-foreground"> • </span>
                            <span className="text-muted-foreground">{formatTimestamp(bet.timestamp)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
                      <div className="font-semibold inline-flex items-center gap-0.5 sm:gap-1 bg-white/70 dark:bg-gray-900/50 px-1.5 sm:px-2 py-0.5 rounded-md shadow-sm border border-slate-200/70 dark:border-slate-700/50">
                        {bet.amount}
                        <Image src="/coin.png" width={12} height={12} alt="Coins" className="object-contain hidden sm:inline" />
                        <Image src="/coin.png" width={11} height={11} alt="Coins" className="object-contain sm:hidden" />
                      </div>
                      <div className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-md shadow-sm ${
                        bet.isWinner 
                          ? 'bg-green-500 text-white font-medium' 
                          : 'bg-red-500 text-white font-medium'
                      }`}>
                        <span>×{bet.multiplier.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <DialogClose className="absolute right-2.5 sm:right-3.5 top-2.5 sm:top-3.5 rounded-full p-0.5 sm:p-1 bg-amber-100 dark:bg-amber-900/50 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                <X className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-800 dark:text-amber-200" />
                <span className="sr-only">{t('Fermer')}</span>
              </DialogClose>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
} 