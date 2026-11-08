'use client'

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Clock, Trophy, AlertCircle, Crown, Scale } from "lucide-react"
import { Bet, BetActivity } from "@/types/bet"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"

interface BetCardProps {
  bet: Bet & {
    totalPoints: number;
    isMostPopular?: boolean;
    isHighestStakes?: boolean;
    isNewGame?: boolean;
    hasWhalebet?: boolean;
    isCompetitive?: boolean;
    recentActivity: number | BetActivity[];
    isExpired: boolean;
    isDecided: boolean;
    decidedAt: string | null;
    status: 'active' | 'expired' | 'decided';
    isUserReferee?: boolean;
  }
  isUserReferee?: boolean;
}

export function BetCard({ bet, isUserReferee }: BetCardProps) {
  const { t } = useTranslation('BetCard')
  const [timeLeft, setTimeLeft] = useState(() => {
    const diff = new Date(bet.endDate).getTime() - new Date().getTime();
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000)
    };
  });

  useEffect(() => {
    // Determine update interval based on remaining time
    const getUpdateInterval = () => {
      if (timeLeft.days > 0) return 60000; // Update every minute if days remaining
      if (timeLeft.hours > 0) return 30000; // Update every 30 seconds if hours remaining
      return 1000; // Update every second if minutes/seconds remaining
    };

    const timer = setInterval(() => {
      const diff = new Date(bet.endDate).getTime() - new Date().getTime();
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      });
    }, getUpdateInterval());

    return () => clearInterval(timer);
  }, [bet.endDate, timeLeft.days, timeLeft.hours]);

  const hasBets = bet.timeSlots.some(slot => slot.points > 0);


  // Calculate remaining time percentage for progress bar
  const calculateTimeProgress = () => {
    const now = new Date().getTime();
    const end = new Date(bet.endDate).getTime();
    const start = end - (7 * 24 * 60 * 60 * 1000); // Assuming a maximum of 7 days duration
    const elapsed = now - start;
    const total = end - start;
    
    // Return percentage of time elapsed (capped between 0-100)
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };

  // Get urgency class based on time remaining
  const getUrgencyClass = () => {
    if (timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes < 30) {
      return 'text-orange-600';
    } else if (timeLeft.days === 0 && timeLeft.hours < 6) {
      return 'text-amber-600';
    } else {
      return 'text-blue-600';
    }
  };

  // Determine if this card should have the referee highlight
  const needsRefereeDecision = bet.status === 'expired' && isUserReferee;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94], // iOS-like bezier curve
        opacity: { duration: 0.3 }
      }}
      className="w-full"
    >
      <Card className={cn(
        "w-full max-w-[calc(100vw-2rem)] sm:max-w-md group transition-all duration-500",
        "border-0 hover:scale-[1.015] flex flex-col backdrop-blur-sm",
        // Mobile-first stronger shadows, then subtle on desktop
        "shadow-[0_6px_25px_rgba(0,0,0,0.12)] sm:shadow-[0_4px_20px_rgba(0,0,0,0.06)]",
        "hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] sm:hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]",
        needsRefereeDecision 
          ? 'bg-gradient-to-br from-amber-50/90 via-amber-25/80 to-orange-50/60 border border-amber-200/30' 
          : bet.status === 'active'
            ? `bg-gradient-to-br from-white/95 via-slate-25/90 to-blue-25/70 border border-slate-200/20 ${bet.isNewGame 
                ? 'shadow-[0_8px_30px_rgba(99,102,241,0.15)] sm:shadow-[0_6px_28px_rgba(99,102,241,0.08)]' 
                : ''}`
            : bet.status === 'expired'
              ? 'bg-gradient-to-br from-yellow-25/80 via-amber-25/70 to-orange-25/60 border border-yellow-200/25'
              : 'bg-gradient-to-br from-slate-25/85 via-gray-25/80 to-slate-50/70 border border-slate-200/25',
        "min-h-[200px] relative rounded-[20px] overflow-hidden" // iOS-style generous corner radius
      )}>
        
        {bet.status === 'decided' && (
          <>
            <div className="absolute inset-0 backdrop-blur-[1px] bg-gradient-to-br from-slate-50/60 via-white/40 to-slate-100/50 z-5 pointer-events-none rounded-[20px]"></div>
            
            {/* Subtle grey trophy overlay in the center */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.08 }}
              transition={{ 
                duration: 0.8, 
                delay: 0.2,
                ease: "easeOut"
              }}
              className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
            >
              <Trophy className="w-32 h-32 text-slate-400" />
            </motion.div>
          </>
        )}

        {/* Add overlay for referee decision required */}
        {needsRefereeDecision && (
          <>
            <div className="absolute inset-0 backdrop-blur-[1px] bg-gradient-to-br from-amber-50/70 via-orange-25/50 to-amber-100/60 z-5 pointer-events-none rounded-[20px]"></div>
            
            {/* Subtle scales of justice overlay in the center */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.1 }}
              transition={{ 
                duration: 0.8, 
                delay: 0.2,
                ease: "easeOut"
              }}
              className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
            >
              <Scale className="w-28 h-28 text-amber-400" />
            </motion.div>
          </>
        )}

        {/* Add overlay for expired games (non-referee) */}
        {bet.status === 'expired' && !isUserReferee && (
          <>
            <div className="absolute inset-0 backdrop-blur-[1px] bg-gradient-to-br from-yellow-50/70 via-amber-25/50 to-yellow-100/60 z-5 pointer-events-none rounded-[20px]"></div>
            
            {/* Subtle hourglass/clock overlay in the center */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.1 }}
              transition={{ 
                duration: 0.8, 
                delay: 0.2,
                ease: "easeOut"
              }}
              className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
            >
              <Clock className="w-28 h-28 text-yellow-400" />
            </motion.div>
          </>
        )}

        {bet.status === 'active' && (
          <div className="absolute inset-0 bg-gradient-to-b from-blue-25/15 to-transparent z-5 pointer-events-none overflow-hidden rounded-[20px]">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400/30 to-transparent"></div>
          </div>
        )}

        <CardHeader className={cn(
          "pb-5 px-5 pt-5 flex-shrink-0 relative z-20",
          needsRefereeDecision ? 'text-amber-900' : ''
        )}>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <CardTitle className={cn(
                "text-lg sm:text-xl font-semibold leading-tight tracking-tight overflow-hidden",
                needsRefereeDecision ? 'text-amber-900' : 'text-slate-900'
              )}>
                <div className="line-clamp-2 [&:has(+*)]:after:content-['...']">
                  {bet.title}
                </div>
              </CardTitle>
            </div>
            
            <div className="flex flex-wrap gap-2.5">
              {bet.status !== 'decided' && (
                <>
                  {bet.isNewGame && (
                    <Badge variant="outline" className={cn(
                      "transition-all duration-300 backdrop-blur-sm border-0 shadow-md sm:shadow-sm font-medium text-xs",
                      needsRefereeDecision 
                        ? 'bg-amber-100/80 text-amber-800 hover:bg-amber-150/90' 
                        : bet.status === 'expired'
                          ? 'bg-yellow-100/80 text-yellow-800 hover:bg-yellow-150/90'
                          : 'bg-gradient-to-r from-pink-50/90 to-rose-50/90 text-pink-700 hover:from-pink-100/90 hover:to-rose-100/90'
                    )}>
                      <span className="mr-1">🎲</span>{t('Nouveau')}
                    </Badge>
                  )}
                  {bet.status === 'active' && bet.totalBettors > 0 && (
                    <Badge variant="outline" className={cn(
                      "transition-all duration-300 backdrop-blur-sm border-0 shadow-md sm:shadow-sm font-medium text-xs",
                      needsRefereeDecision 
                        ? 'bg-amber-100/80 text-amber-800 hover:bg-amber-150/90' 
                        : bet.isNewGame
                          ? 'bg-gradient-to-r from-indigo-50/90 to-blue-50/90 text-indigo-700 hover:from-indigo-100/90 hover:to-blue-100/90'
                          : 'bg-gradient-to-r from-blue-50/90 to-sky-50/90 text-blue-700 hover:from-blue-100/90 hover:to-sky-100/90'
                    )}>
                      <Users className="w-3.5 h-3.5 mr-1" />
                      {bet.totalBettors}
                    </Badge>
                  )}
                  {bet.isMostPopular && (
                    <Badge variant="outline" className={cn(
                      "transition-all duration-300 backdrop-blur-sm border-0 shadow-md sm:shadow-sm font-medium text-xs",
                      needsRefereeDecision 
                        ? 'bg-amber-100/80 text-amber-800 hover:bg-amber-150/90' 
                        : bet.status === 'expired'
                          ? 'bg-yellow-100/80 text-yellow-800 hover:bg-yellow-150/90'
                          : bet.isNewGame
                            ? 'bg-gradient-to-r from-indigo-50/90 to-purple-50/90 text-indigo-700 hover:from-indigo-100/90 hover:to-purple-100/90'
                            : 'bg-gradient-to-r from-blue-50/90 to-indigo-50/90 text-blue-700 hover:from-blue-100/90 hover:to-indigo-100/90'
                    )}>
                      <span className="mr-1">👑</span>{t('Populaire')}
                    </Badge>
                  )}
                  {bet.isHighestStakes && (
                    <Badge variant="outline" className={cn(
                      "transition-all duration-300 backdrop-blur-sm border-0 shadow-md sm:shadow-sm font-medium text-xs",
                      needsRefereeDecision 
                        ? 'bg-amber-100/80 text-amber-800 hover:bg-amber-150/90' 
                        : bet.status === 'expired'
                          ? 'bg-yellow-100/80 text-yellow-800 hover:bg-yellow-150/90'
                          : bet.isNewGame
                            ? 'bg-gradient-to-r from-emerald-50/90 to-green-50/90 text-emerald-700 hover:from-emerald-100/90 hover:to-green-100/90'
                            : 'bg-gradient-to-r from-green-50/90 to-emerald-50/90 text-green-700 hover:from-green-100/90 hover:to-emerald-100/90'
                    )}>
                      <span className="mr-1">💰</span>{t('Grosses mises')}
                    </Badge>
                  )}
                  {bet.hasWhalebet && (
                    <Badge variant="outline" className={cn(
                      "transition-all duration-300 backdrop-blur-sm border-0 shadow-md sm:shadow-sm font-medium text-xs",
                      needsRefereeDecision 
                        ? 'bg-amber-100/80 text-amber-800 hover:bg-amber-150/90' 
                        : bet.status === 'expired'
                          ? 'bg-yellow-100/80 text-yellow-800 hover:bg-yellow-150/90'
                          : bet.isNewGame
                            ? 'bg-gradient-to-r from-violet-50/90 to-purple-50/90 text-violet-700 hover:from-violet-100/90 hover:to-purple-100/90'
                            : 'bg-gradient-to-r from-purple-50/90 to-violet-50/90 text-purple-700 hover:from-purple-100/90 hover:to-violet-100/90'
                    )}>
                      <span className="mr-1">🐋</span>{t('Baleine')}
                    </Badge>
                  )}
                  {bet.isCompetitive && (
                    <Badge variant="outline" className={cn(
                      "transition-all duration-300 backdrop-blur-sm border-0 shadow-md sm:shadow-sm font-medium text-xs",
                      needsRefereeDecision 
                        ? 'bg-amber-100/80 text-amber-800 hover:bg-amber-150/90' 
                        : bet.status === 'expired'
                          ? 'bg-yellow-100/80 text-yellow-800 hover:bg-yellow-150/90'
                          : bet.isNewGame
                            ? 'bg-gradient-to-r from-orange-50/90 to-red-50/90 text-orange-700 hover:from-orange-100/90 hover:to-red-100/90'
                            : 'bg-gradient-to-r from-red-50/90 to-orange-50/90 text-red-700 hover:from-red-100/90 hover:to-orange-100/90'
                    )}>
                      <span className="mr-1">🏃</span>{t('Match serré')}
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5 flex-grow flex flex-col">
          <div className="flex-grow"></div>
          <div className="space-y-4">
            <div className="flex flex-col gap-3.5">
              {bet.status === 'active' && hasBets && (
                <motion.div 
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.4, 
                    delay: 0.1,
                    ease: "easeOut"
                  }}
                  className={cn(
                    "px-4 py-3 rounded-2xl border-0 shadow-md sm:shadow-sm group-hover:shadow-lg sm:group-hover:shadow-md transition-all duration-300 backdrop-blur-sm",
                    needsRefereeDecision 
                      ? 'bg-amber-50/80' 
                      : 'bg-gradient-to-r from-slate-50/90 to-blue-25/80'
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-grow relative h-2">
                      <div className="absolute inset-0 rounded-full bg-slate-200/60"></div>
                      <motion.div 
                        className={cn(
                          "absolute left-0 top-0 bottom-0 rounded-full transition-all duration-300 shadow-sm",
                          needsRefereeDecision
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                            : timeLeft.days === 0 && timeLeft.hours === 0
                              ? 'bg-gradient-to-r from-orange-500 to-red-500' 
                              : timeLeft.days === 0 && timeLeft.hours < 1
                                ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                                : timeLeft.days === 0 && timeLeft.hours < 6
                                  ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                                  : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                        )}
                        initial={{ width: "5%" }}
                        animate={{ width: `${calculateTimeProgress()}%` }}
                        transition={{ 
                          duration: 0.7, 
                          delay: 0.3,
                          ease: "easeInOut"
                        }}
                      ></motion.div>
                    </div>
                    <div className={cn(
                      "flex items-center gap-2 text-sm font-semibold flex-shrink-0",
                      getUrgencyClass()
                    )}>
                      {timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes < 30 ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                      <span className="font-semibold">
                        {timeLeft.days > 0 ? (
                          `${timeLeft.days}j ${timeLeft.hours}h`
                        ) : timeLeft.hours > 0 ? (
                          `${timeLeft.hours}h ${timeLeft.minutes}m`
                        ) : (
                          `${timeLeft.minutes}m ${timeLeft.seconds}s`
                        )}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {(hasBets || bet.isDecided) && bet.status !== 'expired' && bet.status === 'decided' && (
                <motion.div 
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.4, 
                    delay: 0.15,
                    ease: "easeOut"
                  }}
                  className={cn(
                    "px-4 py-3 rounded-2xl border-0 shadow-sm flex items-center justify-between group-hover:shadow-md transition-all duration-300 backdrop-blur-sm",
                    needsRefereeDecision 
                      ? 'bg-amber-50/80' 
                      : 'bg-gradient-to-r from-emerald-50/90 to-green-50/80'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Crown className={cn(
                      "w-5 h-5", 
                      needsRefereeDecision ? 'text-amber-600' : 'text-emerald-600'
                    )} />
                    <span className={cn(
                      "font-semibold text-sm",
                      needsRefereeDecision ? 'text-amber-800' : 'text-emerald-700'
                    )}>
                      {t('Option gagnante')}
                    </span>
                  </div>
                  <span className={cn(
                    "font-bold text-sm px-3 py-1 rounded-full",
                    needsRefereeDecision 
                      ? 'text-amber-800 bg-amber-100/60' 
                      : 'text-emerald-700 bg-emerald-100/60'
                  )}>
                    {bet.timeSlots.find(slot => slot.isWinner)?.time}
                  </span>
                </motion.div>
              )}

              {!hasBets && bet.status === 'active' && (
                <motion.div 
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.4, 
                    delay: 0.15,
                    ease: "easeOut"
                  }}
                  className={cn(
                    "flex items-center gap-3 text-sm px-4 py-3 rounded-2xl border-0 shadow-sm group-hover:shadow-md transition-all duration-300 backdrop-blur-sm",
                    bet.isNewGame 
                      ? 'text-rose-700 bg-gradient-to-r from-rose-50/90 to-pink-50/80' 
                      : 'text-indigo-700 bg-gradient-to-r from-indigo-50/90 to-blue-50/80'
                  )}
                >
                  <Trophy className={cn(
                    "w-5 h-5 flex-shrink-0",
                    bet.isNewGame ? 'text-rose-600' : 'text-indigo-600'
                  )} />
                  <span className="font-semibold">{t('Soyez le premier à parier !')}</span>
                </motion.div>
              )}

              {bet.status === 'expired' && isUserReferee && (
                <motion.div 
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.4, 
                    delay: 0.15,
                    ease: "easeOut"
                  }}
                  whileHover={{ scale: 1.01 }}
                  className="flex items-center gap-3 text-sm text-amber-800 bg-gradient-to-r from-amber-50/90 to-orange-50/80 px-4 py-3 rounded-2xl border-0 shadow-md sm:shadow-sm backdrop-blur-sm"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
                  <span className="font-semibold">{t('Vous êtes l\'arbitre !')}</span>
                </motion.div>
              )}

              {bet.status === 'expired' && !isUserReferee && (
                <motion.div 
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.4, 
                    delay: 0.15,
                    ease: "easeOut"
                  }}
                  className="flex items-center gap-3 text-sm text-yellow-800 bg-gradient-to-r from-yellow-50/90 to-amber-50/80 px-4 py-3 rounded-2xl border-0 shadow-md sm:shadow-sm backdrop-blur-sm"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-yellow-600" />
                  <span className="font-semibold">{t('En attente de la décision de l\'arbitre')}</span>
                </motion.div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}