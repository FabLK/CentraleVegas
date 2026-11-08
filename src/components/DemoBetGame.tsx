'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, HandCoins, Share, TrendingUp } from "lucide-react"
import { type ChartConfig } from "@/components/ui/chart"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import Image from 'next/image'
import { useTranslation } from "react-i18next"

import { BetDrawer } from "@/components/BetDrawer"
import { BetOptions } from "@/components/BetOptions"
import { BetChart } from "@/components/BetChart"
import { BetSocial } from "@/components/BetSocial"

// Define types locally since they are not exported from BetPage
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

type ChartDataPoint = {
  bets: number;
  [key: string]: number;
}

export function DemoBetGame() {
  const { t } = useTranslation('BetPage'); // Use BetPage translations for consistency
  
  const [selectedTime, setSelectedTime] = useState<string>()
  const [hoveredTime, setHoveredTime] = useState<string>()
  const [betAmount, setBetAmount] = useState<number | undefined>(undefined)
  const [showBetDrawer, setShowBetDrawer] = useState(false)
  const [showBetConfirmation, setShowBetConfirmation] = useState(false)
  const [betConfirmationAmount, setBetConfirmationAmount] = useState<number>(0)
  const [betConfirmationMultiplier, setBetConfirmationMultiplier] = useState<number>(0)
  
  // Fake user balance for demo
  const [userBalance, setUserBalance] = useState(1000)
  const [totalBalance] = useState(1000)
  const [blockedBalance, setBlockedBalance] = useState(0)

  // Initial Demo Data
  const [bet, setBet] = useState<{
    title: string;
    timeSlots: BettingOption[];
    recentActivity: Array<{
      user: { name: string; avatar: string };
      userId?: string;
      time: string;
      timestamp: string;
      amount: number;
      isWinningBet?: boolean;
      multiplier: number;
    }>;
  }>({
    title: t("demo_title"),
    timeSlots: [
      {
        id: "opt-1",
        time: t("demo_opt_1"),
        betCount: 42,
        totalPoints: 12500,
        percentage: 45,
        latestMultiplier: 2.2,
        isWinning: false,
        multiplierHistory: Array.from({ length: 20 }, (_, i) => ({ bets: i, multiplier: 2.2 + Math.sin(i/5) * 0.2 })),
      },
      {
        id: "opt-2",
        time: t("demo_opt_2"),
        betCount: 38,
        totalPoints: 10800,
        percentage: 35,
        latestMultiplier: 2.8,
        isWinning: false,
        multiplierHistory: Array.from({ length: 20 }, (_, i) => ({ bets: i, multiplier: 2.8 - Math.cos(i/5) * 0.3 })),
      },
      {
        id: "opt-3",
        time: t("demo_opt_3"),
        betCount: 15,
        totalPoints: 4500,
        percentage: 20,
        latestMultiplier: 5.0,
        isWinning: false,
        multiplierHistory: Array.from({ length: 20 }, (_, i) => ({ bets: i, multiplier: 5.0 + Math.sin(i/3) * 0.5 })),
      }
    ],
    recentActivity: [
      {
        user: { name: "Thomas", avatar: "/avatars/1.png" },
        time: t("demo_opt_1"),
        timestamp: new Date().toISOString(),
        amount: 500,
        multiplier: 2.2
      },
      {
        user: { name: "Sarah", avatar: "/avatars/2.png" },
        time: t("demo_opt_2"),
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        amount: 200,
        multiplier: 2.8
      },
      {
        user: { name: "Lucas", avatar: "/avatars/3.png" },
        time: t("demo_opt_3"),
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        amount: 100,
        multiplier: 5.0
      }
    ]
  })

  // Derived stats
  const totalBets = bet.timeSlots.reduce((acc, slot) => acc + slot.betCount, 0)
  const totalBetAmount = bet.timeSlots.reduce((acc, slot) => acc + slot.totalPoints, 0)
  const uniqueBettors = 85 // Fake number
  const averageBetAmount = Math.round(totalBetAmount / totalBets)

  // Chart Config
  const chartConfig = (() => {
    const slots = bet.timeSlots
    const chartData: Record<string, { label: string; color?: string }> = {
      bets: { label: t("Probabilités") }
    }
    
    slots.forEach(slot => {
       chartData[slot.time] = {
         label: slot.time,
         color: slot.id === "opt-1" ? "#10b981" : slot.id === "opt-2" ? "#3b82f6" : "#f59e0b",
       }
    })
    return chartData as ChartConfig
  })()

  // Chart Data Preparation
  const chartData: ChartDataPoint[] = Array.from({ length: 20 }, (_, i) => {
    const point: ChartDataPoint = { bets: i }
    bet.timeSlots.forEach(slot => {
      if (slot.multiplierHistory?.[i]) {
        point[slot.time] = 1 / slot.multiplierHistory[i].multiplier
      }
    })
    return point
  })

  // Handlers
  const handleBetSuccess = (amount: number, multiplier: number) => {
    // Set confirmation data
    setBetConfirmationAmount(amount);
    setBetConfirmationMultiplier(multiplier);
    setShowBetConfirmation(true);
    
    // Update local state to reflect bet
    setUserBalance(prev => prev - amount)
    setBlockedBalance(prev => prev + amount)
    
    // Fake update of game data
    const selectedSlotId = bet.timeSlots.find(s => s.time === selectedTime)?.id
    if (selectedSlotId) {
       setBet(prev => ({
         ...prev,
         timeSlots: prev.timeSlots.map(slot => {
           if (slot.id === selectedSlotId) {
             return {
               ...slot,
               betCount: slot.betCount + 1,
               totalPoints: slot.totalPoints + amount,
               userBet: {
                 amount: (slot.userBet?.amount || 0) + amount,
                 multiplier: multiplier
               }
             }
           }
           return slot
         }),
         recentActivity: [
           {
             user: { name: t("Vous"), avatar: "/avatars/4.png" },
             time: selectedTime || "",
             timestamp: new Date().toISOString(),
             amount: amount,
             multiplier: multiplier
           },
           ...prev.recentActivity.slice(0, 9)
         ]
       }))
    }

    // Hide after animation completes
    setTimeout(() => {
      setShowBetConfirmation(false);
      setSelectedTime(undefined); // Close drawer logic mostly
      setShowBetDrawer(false);
    }, 3000);
  };

  const handleShare = () => {
    toast.success(t('Lien copié dans le presse-papier'));
  };
  
  // Effects
  useEffect(() => {
    if (selectedTime) {
      setShowBetDrawer(true)
    }
  }, [selectedTime])

  // Get display multiplier for potential win calculation
  const getDisplayMultiplier = (slotTime: string) => {
    const slot = bet.timeSlots.find(s => s.time === slotTime);
    return slot ? slot.latestMultiplier : 2.0;
  }
  
  const potentialWin = betAmount ? (betAmount * getDisplayMultiplier(selectedTime || "")) : 0

  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto">
        <Card className="w-full relative bg-gradient-to-br from-white via-white to-slate-50/30 shadow-2xl shadow-slate-300/60 border-0 rounded-3xl overflow-hidden">
          {/* Demo Badge */}
          <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl z-20">
            DEMO
          </div>
          
          <CardHeader className="p-4 sm:p-8">
            <div className="flex flex-col gap-4 sm:gap-6">
              <div className="flex justify-between items-start gap-3 sm:gap-4">
                <div className="flex flex-col gap-1 sm:gap-0.5 flex-1 min-w-0">
                  <CardTitle className="text-xl sm:text-4xl max-w-full break-normal break-words hyphens-auto text-slate-900 font-bold">
                    {bet.title}
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-slate-500">
                    {t("Créé par")} <span className="font-medium text-blue-600">CentraleVegas</span>
                  </p>
                </div>
                
                {/* Share Button */}
                <motion.button
                  onClick={handleShare}
                  className="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 bg-gradient-to-b from-slate-100/80 to-slate-200/60 hover:from-slate-200/80 hover:to-slate-300/60 border border-slate-200/60 hover:border-slate-300/80 rounded-2xl transition-all duration-200 flex-shrink-0 shadow-sm"
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
                gameStatus={'active'}
                uniqueBettors={uniqueBettors}
                gameId={"demo-game"}
              />

              <BetChart 
                timeSlots={bet.timeSlots}
                selectedTime={selectedTime}
                hoveredTime={hoveredTime}
                chartData={chartData}
                chartConfig={chartConfig}
                gameStatus={'active'}
              />
            </div>

            <div className="space-y-8">
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                {/* Participants Stats */}
                <motion.div 
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
                          {t("moy.")} {averageBetAmount}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
                
                {/* Time Stats */}
                <motion.div 
                  className="flex flex-col relative overflow-hidden p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white via-slate-50/40 to-slate-100/20 border border-slate-200/40 shadow-slate-200/50"
                >
                  <div className="absolute -right-2 sm:-right-4 -top-2 sm:-top-4 opacity-8">
                    <svg className="h-8 w-8 sm:h-16 sm:w-16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="#64748b30" strokeWidth="2" />
                      <path d="M12 7V12L15 15" stroke="#64748b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="flex flex-col gap-1 sm:gap-1.5 z-10">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wide">{t("Temps restant")}</span>
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-500 animate-pulse"></div>
                    </div>
                    <div className="flex items-baseline">
                      <span className="text-lg sm:text-2xl lg:text-3xl font-bold text-slate-900">
                        2j 14:30
                      </span>
                      <span className="text-[10px] sm:text-xs text-slate-500 ml-1">:45</span>
                    </div>
                  </div>
                </motion.div>
                
                {/* Referee Stats */}
                <motion.div 
                  className="flex flex-col relative overflow-hidden p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white via-slate-50/40 to-slate-100/20 border border-slate-200/40 shadow-xl shadow-slate-200/50"
                >
                  <div className="absolute -right-2 sm:-right-4 -top-2 sm:-top-4 opacity-8">
                    <TrendingUp className="h-8 w-8 sm:h-16 sm:w-16 text-slate-400/20" />
                  </div>
                  <div className="flex flex-col gap-1 sm:gap-1.5 z-10">
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wide">{t("Cote Max")}</span>
                    <div className="flex flex-col">
                      <span className="text-lg sm:text-2xl lg:text-3xl font-bold text-slate-900">
                        5.0x
                      </span>
                      <span className="text-[10px] sm:text-xs font-medium text-slate-600 bg-slate-100/80 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full w-fit">
                        {t("demo_opt_3")}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
              
              <BetSocial
                recentActivity={bet.recentActivity}
                gameStatus={'active'}
              />
            </div>
          </CardContent>
        </Card>

        {/* Demo BetDrawer */}
        <BetDrawer
          open={showBetDrawer}
          onOpenChange={(open) => {
            setShowBetDrawer(open);
            if (!open) setSelectedTime(undefined);
          }}
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          potentialWin={potentialWin}
          gameId="demo-game"
          optionId={bet.timeSlots.find(slot => slot.time === selectedTime)?.id || ''}
          userId="demo-user"
          groupId={0}
          userBalance={userBalance}
          totalBalance={totalBalance}
          blockedBalance={blockedBalance}
          customPlaceBetHandler={async (amount, multiplier) => {
             // Simulate network delay
             await new Promise(resolve => setTimeout(resolve, 1000));
             handleBetSuccess(amount, multiplier);
          }}
        />

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
    </div>
  )
}
