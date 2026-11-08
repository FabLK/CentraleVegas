'use client'

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Trophy, LogOut, User, Lock, Users, UserPlus, Check, X, TrendingUp, TrendingDown, Menu, Database } from "lucide-react"
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/lib/supabase/context'
import { useState, useEffect, useCallback } from 'react'
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { useGroup } from '@/lib/group/context'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useUser } from '@/lib/user/context'
import { useUserBalance } from '@/hooks/useUserBalance'
import { isAdminUsername } from '@/lib/admin'
import { useTranslation } from 'react-i18next';

// Define types for our notifications
type DecisionNotification = {
  type: 'decision';
  id: string;
  gameId: string;
  title: string;
  decidedAt: string;
  winningOption: string;
  userWon: boolean;
  pointsWon: number;
};

type GroupJoinRequest = {
  type: 'groupJoinRequest';
  id: string;
  groupId: number;
  groupName: string;
  userId: string;
  username: string;
  message: string;
  createdAt: string;
};


// Component for the decisions dialog
function DecisionsDialog({ notifications, open, onOpenChange, onMarkAsRead }: { 
  notifications: DecisionNotification[], 
  open: boolean,
  onOpenChange: (open: boolean) => void,
  onMarkAsRead: (id: string) => void 
}) {
  const { t } = useTranslation('Navbar')
  // Calculate total profit/loss
  const totalProfitLoss = notifications.reduce((total, notification) => {
    return total + (notification.userWon ? notification.pointsWon : -notification.pointsWon);
  }, 0);

  // Animation states
  const [showTotal, setShowTotal] = useState(false);
  const [animatedResults, setAnimatedResults] = useState<string[]>([]);
  const [animatedAmount, setAnimatedAmount] = useState(0);
  const [showFinalColor, setShowFinalColor] = useState(false);
  
  // Reset animation states when dialog opens/closes
  useEffect(() => {
    if (open) {
      // Reset animation states
      setShowTotal(false);
      setAnimatedResults([]);
      setAnimatedAmount(0);
      setShowFinalColor(false);
      
      // Store all timeout IDs for proper cleanup
      const timeoutIds: NodeJS.Timeout[] = [];
      
      // Initial delay before starting animations
      const initialDelay = 300;
      
      // Base animation delay between items (will add randomness later)
      const baseDelay = 350;
      
      // Animate each result with slight randomness for natural feel
      notifications.forEach((notification, index) => {
        // Add slight randomness to the timing for a more natural feel
        const randomVariation = Math.floor(Math.random() * 80) - 40; // -40 to +40 ms variation
        
        const timer = setTimeout(() => {
          setAnimatedResults(prev => [...prev, notification.id]);
          
          // Only set the final states after the last notification has animated
          if (index === notifications.length - 1) {
            const finalTimer = setTimeout(() => {
              setShowTotal(true);
              
              // Slight delay before color change for better sequence
              setTimeout(() => {
                setShowFinalColor(true);
              }, 200);
            }, 450);
            timeoutIds.push(finalTimer);
          }
        }, initialDelay + (index * baseDelay) + randomVariation);
        
        timeoutIds.push(timer);
      });
      
      // Clean up all timeouts on unmount
      return () => {
        timeoutIds.forEach(id => clearTimeout(id));
      };
    } else {
      // Reset states when dialog closes
      setShowTotal(false);
      setAnimatedResults([]);
      setAnimatedAmount(0);
      setShowFinalColor(false);
    }
  }, [open, notifications.length]);

  // Growing number animation - smoother and more natural
  useEffect(() => {
    if (showTotal && totalProfitLoss !== 0) {
      // Use a smoother increment calculation that scales with the total
      const steps = 45; // Total animation steps
      let currentStep = 0;
      
      // Use requestAnimationFrame for smoother animation
      let animationFrameId: number;
      
      const updateNumber = () => {
        currentStep++;
        
        // Apply easing function for more natural movement
        // Using easeOutQuart for a nice acceleration then deceleration
        const progress = 1 - Math.pow(1 - currentStep / steps, 4);
        const easedValue = Math.round(totalProfitLoss * progress);
        
        setAnimatedAmount(easedValue);
        
        if (currentStep < steps) {
          animationFrameId = requestAnimationFrame(updateNumber);
        } else {
          // Ensure we end at exactly the right number
          setAnimatedAmount(totalProfitLoss);
        }
      };
      
      animationFrameId = requestAnimationFrame(updateNumber);
      
      return () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      };
    }
  }, [showTotal, totalProfitLoss]);

  // Function to clear all notifications
  const clearAllNotifications = () => {
    // Mark all notifications as read
    notifications.forEach(notification => {
      onMarkAsRead(notification.id);
    });
    
    // Close the dialog
    onOpenChange(false);
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:w-[380px] sm:max-w-[450px] md:w-[420px] lg:w-[450px] p-0 gap-0 overflow-hidden border-none shadow-2xl bg-white/95 backdrop-blur-xl rounded-3xl" fullScreenOnMobile={false}>
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: -30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.6, bounce: 0.25 }}
          className="rounded-3xl overflow-hidden bg-gradient-to-b from-white/98 to-white/95 backdrop-blur-xl"
        >
          {/* iOS-style header with total profit/loss */}
          <motion.div 
            className={cn(
              "relative overflow-hidden py-8 px-6",
              showFinalColor ? (
                totalProfitLoss >= 0 
                  ? "bg-gradient-to-br from-green-50/90 via-green-100/80 to-emerald-50/90" 
                  : "bg-gradient-to-br from-red-50/90 via-red-100/80 to-rose-50/90"
              ) : "bg-gradient-to-br from-slate-50/90 via-slate-100/80 to-gray-50/90"
            )}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* Subtle background pattern */}
            <motion.div 
              className="absolute inset-0 opacity-[0.03]"
              animate={{ opacity: [0.02, 0.04, 0.02] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            >
              <motion.div
                animate={{ 
                  rotate: showFinalColor ? 
                    (totalProfitLoss >= 0 ? [0, 2, 0, -1, 0] : [0, -2, 0, 1, 0]) : 
                    [0, 0, 0]
                }}
                transition={{ 
                  repeat: Infinity, 
                  repeatType: "mirror", 
                  duration: 8, 
                  ease: "easeInOut"
                }}
                className="absolute right-4 top-4 transform"
              >
                {showFinalColor ? (
                  totalProfitLoss >= 0 ? (
                    <TrendingUp className="w-24 h-24 text-green-400/20" />
                  ) : (
                    <TrendingDown className="w-24 h-24 text-red-400/20" />
                  )
                ) : (
                  <Trophy className="w-24 h-24 text-gray-400/20" />
                )}
              </motion.div>
            </motion.div>
            
            <DialogTitle className={cn(
              "font-semibold text-lg mb-6 flex items-center gap-3 relative z-10",
              showFinalColor ? (
                totalProfitLoss >= 0 
                  ? "text-green-800" 
                  : "text-red-800"
              ) : "text-gray-700"
            )}>
              <motion.div
                animate={{ 
                  rotate: [0, 6, 0, -4, 0],
                  scale: [1, 1.05, 1, 1.02, 1]
                }}
                transition={{ 
                  delay: 0.3, 
                  duration: 1.5, 
                  times: [0, 0.2, 0.5, 0.8, 1], 
                  type: "spring", 
                  stiffness: 100,
                  damping: 12
                }}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  showFinalColor ? (
                    totalProfitLoss >= 0 
                      ? "bg-green-100 text-green-600" 
                      : "bg-red-100 text-red-600"
                  ) : "bg-gray-100 text-gray-600"
                )}
              >
                <Trophy className="h-4 w-4" />
              </motion.div>
              <span>{t('Résultats des paris')}</span>
            </DialogTitle>
            
            {/* iOS-style total amount display */}
            <div className="flex flex-col items-center text-center relative z-10">
              <div className={cn(
                "text-sm font-medium mb-2",
                showFinalColor ? (
                  totalProfitLoss >= 0 
                    ? "text-green-700/80" 
                    : "text-red-700/80"
                ) : "text-gray-600"
              )}>
                {t('Montant total')}
              </div>
              
              {/* Animated total amount with growing number */}
              <AnimatePresence mode="wait">
                {showTotal ? (
                  <motion.div 
                    key="total-amount"
                    className={cn(
                      "text-3xl font-bold flex items-center gap-3 px-4 py-2 rounded-2xl backdrop-blur-sm",
                      showFinalColor ? (
                        totalProfitLoss >= 0 
                          ? "text-green-800 bg-white/40" 
                          : "text-red-800 bg-white/40"
                      ) : "text-gray-700 bg-white/40"
                    )}
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ 
                      opacity: 1, 
                      scale: [0.8, 1.05, 1],
                      y: [20, -4, 0]
                    }}
                    transition={{ 
                      duration: 0.8,
                      times: [0, 0.7, 1],
                      type: "spring", 
                      stiffness: 180,
                      damping: 12
                    }}
                  >
                    {animatedAmount >= 0 ? "+" : ""}
                    {animatedAmount.toLocaleString()}
                    <motion.div
                      initial={{ scale: 0.7, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.6, delay: 0.2, type: "spring", stiffness: 120 }}
                    >
                      <Image src="/coin.png" alt="points" width={28} height={28} className="h-7 w-7 min-w-7 min-h-7" />
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="loading-placeholder"
                    className="text-3xl font-bold flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/30 backdrop-blur-sm"
                    animate={{ 
                      opacity: [0.4, 0.6, 0.4]
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 2,
                      ease: "easeInOut"
                    }}
                  >
                    <div className="bg-white/40 rounded-xl h-9 w-20 flex items-center justify-center">
                      <motion.div
                        animate={{ 
                          opacity: [0.3, 0.7, 0.3],
                          scale: [0.95, 1.05, 0.95]
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 1.5, 
                          ease: "easeInOut"
                        }}
                        className="h-5 w-5 rounded-full bg-gray-400/60"
                      />
                    </div>
                    <Image src="/coin.png" alt="points" width={28} height={28} className="h-7 w-7 min-w-7 min-h-7 opacity-40" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
          
          {/* iOS-style notification list with cards */}
          <div className="max-h-[50vh] overflow-y-auto px-4 py-2">
            <div className="space-y-3">
              {notifications.map((notification) => {
                const isAnimated = animatedResults.includes(notification.id);
                
                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={isAnimated ? { 
                      opacity: 1, 
                      scale: 1,
                      y: 0
                    } : { 
                      opacity: 0, 
                      scale: 0.95,
                      y: 10
                    }}
                    transition={{ 
                      type: "spring",
                      stiffness: 140,
                      damping: 16,
                      mass: 0.8
                    }}
                    className={cn(
                      "bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden",
                      isAnimated ? "opacity-100" : "opacity-0"
                    )}
                  >
                    <div className={cn(
                      "h-1 w-full",
                      notification.userWon 
                        ? "bg-gradient-to-r from-green-400 to-emerald-400" 
                        : "bg-gradient-to-r from-red-400 to-rose-400"
                    )} />
                    
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <Link 
                            href={`/bet/${notification.gameId}`}
                            onClick={() => {
                              onOpenChange(false);
                              onMarkAsRead(notification.id);
                            }}
                            className="font-semibold text-gray-900 hover:text-blue-600 transition-colors text-sm block truncate"
                          >
                            {notification.title}
                          </Link>
                          
                          <div className="text-xs text-gray-500 mt-1 truncate">
                            {notification.winningOption}
                          </div>
                        </div>
                        
                        {isAnimated ? (
                          <motion.div 
                            className={cn(
                              "flex items-center gap-1.5 font-bold text-base ml-3 px-3 py-1.5 rounded-xl",
                              notification.userWon 
                                ? "text-green-700 bg-green-50" 
                                : "text-red-700 bg-red-50"
                            )}
                            initial={{ opacity: 0, scale: 0.7, x: 15 }}
                            animate={{ 
                              opacity: 1, 
                              scale: [0.7, 1.1, 1],
                              x: [15, -3, 0]
                            }}
                            transition={{ 
                              duration: 0.7,
                              times: [0, 0.6, 1],
                              type: "spring", 
                              stiffness: 160,
                              damping: 14
                            }}
                          >
                            {notification.userWon ? "+" : "-"}
                            {notification.pointsWon.toLocaleString()}
                          </motion.div>
                        ) : (
                          <div className="w-20 h-8 bg-gray-100 rounded-xl animate-pulse ml-3" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
          
          {/* iOS-style footer with action button */}
          <motion.div 
            className="p-6 bg-gradient-to-t from-white/90 to-white/70 backdrop-blur-sm border-t border-white/30"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: showTotal ? 1 : 0, y: showTotal ? 0 : 20 }}
            transition={{ 
              duration: 0.5, 
              delay: 0.3,
              ease: "easeOut"
            }}
          >
            <Button 
              className={cn(
                "w-full h-12 rounded-2xl font-semibold text-base shadow-lg transition-all duration-200 active:scale-95",
                showFinalColor ? (
                  totalProfitLoss >= 0 
                    ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-green-200" 
                    : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-200"
                ) : "bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white shadow-gray-200"
              )}
              onClick={clearAllNotifications}
              disabled={!showTotal}
            >
              <motion.div
                animate={{ scale: showTotal ? [1, 1.05, 1] : 1 }}
                transition={{ 
                  duration: 2, 
                  repeat: showTotal ? Infinity : 0, 
                  repeatDelay: 3,
                  ease: "easeInOut" 
                }}
                className="flex items-center gap-2"
              >
                <Check className="h-5 w-5" />
                <span>{t('Marquer comme lus')}</span>
              </motion.div>
            </Button>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

// Component for the group join requests dialog
function GroupRequestsDialog({ requests, open, onOpenChange, onHandleRequest }: { 
  requests: GroupJoinRequest[], 
  open: boolean,
  onOpenChange: (open: boolean) => void,
  onHandleRequest: (id: string, accept: boolean) => void 
}) {
  const { t } = useTranslation('Navbar')
  if (requests.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:w-[380px] sm:max-w-[450px] md:w-[420px] lg:w-[450px] p-0 gap-0 overflow-hidden border-primary/20 shadow-lg" fullScreenOnMobile={false}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0.35 }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="sticky top-0 z-10 bg-gradient-to-r from-background/95 via-background/90 to-primary/10 backdrop-blur-sm border-b border-primary/20 px-4 py-3"
          >
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base font-bold">
              <motion.div 
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="bg-gradient-to-r from-green-400 to-primary p-1.5 rounded-full"
              >
                <UserPlus className="h-4 w-4 text-white" />
              </motion.div>
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="bg-gradient-to-r from-primary to-green-500 bg-clip-text text-transparent"
              >
                {t('Demandes d\'adhésion')} ({requests.length})
              </motion.span>
            </DialogTitle>
          </motion.div>
          
          <ScrollArea className="max-h-[60vh] bg-[radial-gradient(circle_at_top_right,_var(--background),_var(--muted)/30)]">
            <div className="flex flex-col divide-y divide-primary/10">
              {requests.map((request, index) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + (index * 0.07), duration: 0.4, type: "spring" }}
                  className="py-3 px-4 hover:bg-primary/5 transition-all duration-200 group"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/profile/${encodeURIComponent(request.username)}`}
                          className="font-medium text-primary hover:underline whitespace-nowrap transition-colors"
                          onClick={() => onOpenChange(false)}
                        >
                          {request.username}
                        </Link>
                        <motion.span 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2 + (index * 0.07) + 0.1, duration: 0.3 }}
                          className="text-xs bg-muted/50 px-1.5 py-0.5 rounded-md text-muted-foreground whitespace-nowrap"
                        >
                          → {request.groupName}
                        </motion.span>
                      </div>
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 + (index * 0.07) + 0.2, duration: 0.3 }}
                        className="text-xs text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-md"
                      >
                        {new Date(request.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                      </motion.div>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2">
                      {request.message ? (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          transition={{ delay: 0.2 + (index * 0.07) + 0.3, duration: 0.4 }}
                          className="text-xs bg-muted/20 px-3 py-2 rounded-md border-l-2 border-primary/30 flex-1 min-w-0 shadow-sm"
                        >
                          {request.message}
                        </motion.div>
                      ) : (
                        <motion.span 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.8 }}
                          transition={{ delay: 0.2 + (index * 0.07) + 0.3, duration: 0.4 }}
                          className="text-xs text-muted-foreground italic px-1"
                        >
                          {t('Pas de message')}
                        </motion.span>
                      )}
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ 
                            delay: 0.2 + (index * 0.07) + 0.4, 
                            type: "spring", 
                            stiffness: 200 
                          }}
                        >
                          <Button 
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-gradient-to-br from-green-100 to-green-200 text-green-700 hover:bg-gradient-to-br hover:from-green-200 hover:to-green-300 hover:text-green-800 hover:shadow-md hover:shadow-green-500/20 transition-all duration-200"
                            onClick={() => onHandleRequest(request.id, true)}
                            title={t('Accepter')}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </motion.div>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ 
                            delay: 0.2 + (index * 0.07) + 0.5, 
                            type: "spring", 
                            stiffness: 200 
                          }}
                        >
                          <Button 
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-gradient-to-br from-muted/40 to-muted/60 text-muted-foreground hover:bg-gradient-to-br hover:from-destructive/20 hover:to-destructive/30 hover:text-destructive hover:shadow-md hover:shadow-destructive/20 transition-all duration-200"
                            onClick={() => onHandleRequest(request.id, false)}
                            title={t('Refuser')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + (requests.length * 0.07), duration: 0.4 }}
            className="px-4 py-3 border-t border-primary/20 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-sm"
          >
            <Button 
              variant="outline" 
              size="sm"
              className="w-full h-9 text-xs border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 shadow-sm hover:shadow"
              onClick={() => onOpenChange(false)}
            >
              {t('Fermer')}
            </Button>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

export function Navbar() {
  const router = useRouter()
  const { currentGroupId, userGroups } = useGroup()
  const { user, isLoading: isUserLoading } = useUser()
  const [userData, setUserData] = useState<{ username: string } | null>(null)
  const [isNavbarReady, setIsNavbarReady] = useState(false)
  const [decisionNotifications, setDecisionNotifications] = useState<DecisionNotification[]>([])
  const [groupJoinRequests, setGroupJoinRequests] = useState<GroupJoinRequest[]>([])
  const [showDecisionsDialog, setShowDecisionsDialog] = useState(false)
  const [showGroupRequestsDialog, setShowGroupRequestsDialog] = useState(false)
  const [hasViewedDecisions, setHasViewedDecisions] = useState(false)
  const [hasViewedRequests, setHasViewedRequests] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  
  // Use the global balance context
  const { 
    totalBalance, 
    blockedPoints, 
    isLoading: isBalanceLoading 
  } = useUserBalance(currentGroupId)
  
  // State to track group transitions
  const [previousGroupId, setPreviousGroupId] = useState<number | null | undefined>(currentGroupId);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Create the client inside the component to ensure fresh instance
  const supabase = useSupabase()

  // Effect to manage transition state
  useEffect(() => {
    // Check if the group ID actually changed
    if (previousGroupId !== currentGroupId) {
      // Start transition only if the ID is different
      setIsTransitioning(true);
      setPreviousGroupId(currentGroupId);
    } else if (!isBalanceLoading && isTransitioning) {
      // End transition only if loading is finished *after* a transition started
      setIsTransitioning(false);
    }
    // Intentionally excluding setIsTransitioning and setPreviousGroupId from deps
    // We only want this effect to run when the group ID or loading state changes.
  }, [currentGroupId, isBalanceLoading, previousGroupId, isTransitioning]);

  // Get user data including username (but not points which now come from the balance context)
  const getUserData = useCallback(async (userId: string) => {
    try {
      // Get username from Users table
      const { data: userData, error: userError } = await supabase
        .from('Users')
        .select('id, username')
        .eq('id', userId)
        .single()

      if (userError || !userData) {
        console.error('User data error:', userError)
        return null
      }

      return {
        username: userData.username
      }
    } catch (error) {
      console.error('Get user data error:', error)
      return null
    }
  }, [supabase])

  // Sign out function
  const handleSignOut = async () => {
    try {
      // First sign out completely from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) console.error('Sign out error:', error)
      
      // No need to clear state, context will handle that
      
      // Navigate to auth page - use replace to prevent going back
      router.replace('/auth');
    } catch (error) {
      console.error('Sign out error:', error)
      // Even if there's an error, still redirect to auth
      router.replace('/auth');
    }
  }

  // Function to fetch user's bets for a specific game
  const fetchUserBetsForGame = useCallback(async (userId: string, gameId: number) => {
    if (!userId) return [];
    
    try {
      const { data: bets, error } = await supabase
        .from('Bets')
        .select(`
          id,
          amount,
          multiplier,
          option:BettingOption (
            id,
            title,
            is_winning
          )
        `)
        .eq('user', userId)
        .eq('game', gameId);
      
      if (error) {
        console.error('Fetch user bets error:', error);
        return [];
      }
      
      return bets;
    } catch (error) {
      console.error('Error fetching user bets:', error);
      return [];
    }
  }, [supabase]);

  // Function to fetch decision notifications
  const fetchDecisionNotifications = useCallback(async (userId: string) => {
    if (!userId) return [];
    
    try {
      const { data: notifications, error } = await supabase
        .from('DecisionNotification')
        .select(`
          id,
          game:BettingGame(
            id,
            title,
            decided_at,
            BettingOption (
              id,
              title,
              is_winning
            )
          )
        `)
        .eq('user', userId);
      
      if (error) {
        console.error('Fetch decision notifications error:', error);
        return [];
      }
      
      // Process and transform notifications with user bets info
      const processedNotifications = await Promise.all(notifications.map(async notification => {
        const game = Array.isArray(notification.game) ? notification.game[0] : notification.game;
        const winningOption = game?.BettingOption?.find(option => option.is_winning);
        
        // Fetch user bets for this game
        const userBets = await fetchUserBetsForGame(userId, game?.id);
        
        // Calculate total points won/lost
        let pointsWon = 0;
        
        userBets.forEach(bet => {
          const option = Array.isArray(bet.option) ? bet.option[0] : bet.option;
          if (option?.is_winning) {
            // Correct calculation: for wins, it's bet_amount * (multiplier - 1)
            pointsWon += bet.amount * (bet.multiplier - 1);
          } else {
            // For losses, we subtract the bet amount
            pointsWon -= bet.amount;
          }
        });
        
        // Set userWon based on final pointsWon value
        const userWon = pointsWon > 0;
        
        return {
          type: 'decision' as const,
          id: notification.id,
          gameId: game?.id || '',
          title: game?.title || '',
          decidedAt: game?.decided_at || '',
          winningOption: winningOption?.title || '',
          userWon,
          pointsWon: Math.round(Math.abs(pointsWon)) // Store absolute value, UI will handle sign
        };
      }));
      
      return processedNotifications;
    } catch (error) {
      console.error('Error fetching decision notifications:', error);
      return [];
    }
  }, [supabase, fetchUserBetsForGame]);

  // Function to fetch group join requests for groups the user is part of
  const fetchGroupJoinRequests = useCallback(async (userId: string) => {
    if (!userId) return [];
    
    try {
      // Use the cached userGroups from context instead of fetching memberships
      if (!userGroups || userGroups.length === 0) {
        return [];
      }
      
      // Get the group IDs from the cached userGroups
      const groupIds = userGroups.map(group => group.id);
      
      // Get join requests for these groups
      const { data: joinRequests, error: requestsError } = await supabase
        .from('RequestJoinGroup')
        .select(`
          id,
          created_at,
          user,
          group,
          message,
          requestingUser:user(
            username
          ),
          requestedGroup:group(
            name
          )
        `)
        .in('group', groupIds);
      
      if (requestsError) {
        console.error('Fetch join requests error:', requestsError);
        return [];
      }
      
      if (!joinRequests) return [];
      
      return joinRequests.map(request => {
        // Handle potentially array-wrapped values from Supabase foreign table relations
        const requestingUser = Array.isArray(request.requestingUser) 
          ? request.requestingUser[0] 
          : request.requestingUser;
        
        const requestedGroup = Array.isArray(request.requestedGroup)
          ? request.requestedGroup[0]
          : request.requestedGroup;
        
        const username = requestingUser?.username || 'Unknown user';
        const groupName = requestedGroup?.name || 'Unknown group';
        
        return {
          type: 'groupJoinRequest' as const,
          id: request.id,
          groupId: request.group,
          groupName,
          userId: request.user,
          username,
          message: request.message || '',
          createdAt: request.created_at,
        };
      });
    } catch (error) {
      console.error('Error fetching group join requests:', error);
      return [];
    }
  }, [supabase, userGroups]);

  // Combined function to fetch all notifications
  const fetchAllNotifications = useCallback(async (userId: string) => {
    if (!userId) return;
    
    try {
      // Fetch both types of notifications
      const [decisionResults, groupRequests] = await Promise.all([
        fetchDecisionNotifications(userId),
        fetchGroupJoinRequests(userId)
      ]);
      
      setDecisionNotifications(decisionResults);
      setGroupJoinRequests(groupRequests);
      
      // Auto-show dialogs if there are new notifications and they haven't been viewed
      if (decisionResults.length > 0 && !hasViewedDecisions) {
        setShowDecisionsDialog(true);
        setHasViewedDecisions(true);
      }
      
      if (groupRequests.length > 0 && !hasViewedRequests) {
        setShowGroupRequestsDialog(true);
        setHasViewedRequests(true);
      }
    } catch (error) {
      console.error('Error fetching all notifications:', error);
    }
  }, [fetchDecisionNotifications, fetchGroupJoinRequests, hasViewedDecisions, hasViewedRequests]);

  // Mark decision notification as read by deleting it
  const markDecisionAsRead = useCallback(async (notificationId: string) => {
    try {
      // Delete the notification from the database
      const { error } = await supabase
        .from('DecisionNotification')
        .delete()
        .eq('id', notificationId);
      
      if (error) {
        console.error('Error deleting notification:', error);
        return;
      }
      
      // Update the local state
      setDecisionNotifications(decisionNotifications.filter(n => n.id !== notificationId));
      
      // Close dialog if no more notifications
      if (decisionNotifications.length <= 1) {
        setShowDecisionsDialog(false);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [supabase, decisionNotifications.length]);

  // Handle group join request (accept or reject)
  const handleJoinRequest = useCallback(async (requestId: string, accept: boolean) => {
    try {
      // Find the request in our local state
      const request = groupJoinRequests.find(r => r.id === requestId);
      
      if (!request) {
        console.error('Request not found:', requestId);
        return;
      }
      
      if (accept) {
        // Accept the request - add the user to the group using UsersGroupMembership table
        const { error: membershipError } = await supabase
          .from('UsersGroupMembership')
          .insert({
            group: request.groupId,
            user: request.userId,
            created_at: new Date().toISOString()
          });

        // Handle duplicate key error (user already added) as success
        if (membershipError && membershipError.code !== '23505') {
          console.error('Error adding user to group:', membershipError);
          return;
        }
        
        // Check if user already has points in this group
        const { data: existingPoints, error: pointsCheckError } = await supabase
          .from('PointsHistory')
          .select('id')
          .eq('user', request.userId)
          .eq('group', request.groupId)
          .limit(1);
          
        if (pointsCheckError) {
          console.error('Error checking existing points:', pointsCheckError);
        }
        
        // If no existing points record, add initial 200 points
        if (!existingPoints || existingPoints.length === 0) {
          const { error: addPointsError } = await supabase
            .from('PointsHistory')
            .insert({
              user: request.userId,
              group: request.groupId,
              amount: 200,
              timestamp: new Date().toISOString()
            });
            
          if (addPointsError) {
            console.error('Error adding initial points:', addPointsError);
          } else {
            console.log('Added 200 initial points to user in group', request.groupId);
          }
        }
        
        toast(
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-500" />
            <span>{t('Utilisateur ajouté au groupe')}</span>
          </div>
        );
      }
      
      // In either case (accept or reject), delete the request
      const { error } = await supabase
        .from('RequestJoinGroup')
        .delete()
        .eq('id', requestId);
      
      if (error) {
        console.error('Error deleting join request:', error);
        return;
      }
      
      // Update local state
      setGroupJoinRequests(groupJoinRequests.filter(r => r.id !== requestId));
      
      // Close dialog if no more requests
      if (groupJoinRequests.length <= 1) {
        setShowGroupRequestsDialog(false);
      }
    } catch (error) {
      console.error('Error handling join request:', error);
    }
  }, [supabase, groupJoinRequests]);

  // Reset viewed flags when notifications change
  useEffect(() => {
    if (decisionNotifications.length === 0) {
      setHasViewedDecisions(false);
    }
  }, [decisionNotifications]);

  useEffect(() => {
    if (groupJoinRequests.length === 0) {
      setHasViewedRequests(false);
    }
  }, [groupJoinRequests]);

  // Unified initial loading effect - only fetch username and notification data
  useEffect(() => {
    let mounted = true;
    
    async function initializeNavbar() {
      // Don't proceed until we have user and context data
      if (isUserLoading) return;
      
      // If no user, set navbar ready with no user data
      if (!user) {
        if (mounted) {
          setIsNavbarReady(true);
          setUserData(null);
        }
        return;
      }
      
      try {
        // Fetch username only (balance data comes from the context)
        const data = await getUserData(user.id);
        
        if (mounted) {
          setUserData(data);
          setIsNavbarReady(true);
          
          // After critical UI is ready, fetch notifications
          // This can happen in the background
          fetchAllNotifications(user.id);
        }
      } catch (error) {
        console.error('Initialize navbar error:', error);
        if (mounted) {
          setIsNavbarReady(true);
          setUserData(null);
        }
      }
    }
    
    initializeNavbar();
    
    return () => {
      mounted = false;
    };
  }, [user, isUserLoading, getUserData, fetchAllNotifications]);

  // Setup real-time subscriptions for notifications
  useEffect(() => {
    // Don't set up subscriptions until we have initial data loaded
    if (!isNavbarReady || !user?.id || !currentGroupId) return;
    
    console.log('[DEBUG] Setting up realtime channel for user', user.id, 'in group', currentGroupId);
    
    // Track connection status
    let isReconnecting = false;
    const reconnectDelay = 2000; // Initial reconnect delay in ms
    const maxReconnectDelay = 30000; // Maximum reconnect delay
    let currentReconnectDelay = reconnectDelay;
    
    // Helper function to handle subscription status
    const handleSubscriptionStatus = (status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | string, channelName: string) => {
      console.log(`[DEBUG] ${channelName} subscription status:`, status);
      
      if (status === 'SUBSCRIBED') {
        // Reset reconnection delay on successful connection
        currentReconnectDelay = reconnectDelay;
        isReconnecting = false;
      } else if (['CLOSED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(status) && !isReconnecting) {
        console.warn(`[DEBUG] ${channelName} connection issue:`, status);
        isReconnecting = true;
        
        // Implement exponential backoff for reconnection
        setTimeout(() => {
          console.log(`[DEBUG] Attempting to reconnect ${channelName}...`);
          // The recreation of channels will happen on component remount
          // This forces React to re-run this effect
          if (mounted) {
            setIsNavbarReady(false);
            setTimeout(() => {
              if (mounted) setIsNavbarReady(true);
            }, 0);
          }
          
          // Increase delay for next potential reconnection (exponential backoff)
          currentReconnectDelay = Math.min(currentReconnectDelay * 1.5, maxReconnectDelay);
        }, currentReconnectDelay);
      }
    };
    
    // Flag to track if component is still mounted
    let mounted = true;
    
    // Set up a realtime subscription for decision notifications
    const decisionNotificationsChannel = supabase
      .channel('decision-notifications-' + user.id)
      .on('postgres_changes',
        {
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'DecisionNotification',
          filter: `user=eq.${user.id}`
        },
        async (payload) => {
          console.log('[DEBUG] Decision notification change detected:', payload);
          
          // Handle different event types
          if (payload.eventType === 'DELETE') {
            // For DELETE events, we can directly update state without fetching
            const deletedId = payload.old?.id;
            if (deletedId) {
              setDecisionNotifications(decisionNotifications.filter(n => n.id !== deletedId));
            }
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // For INSERT/UPDATE, we need to fetch just this notification to get associated data
            const newNotificationId = payload.new?.id;
            
            if (newNotificationId) {
              try {
                // Fetch the single notification with its associated game data
                const { data: notification, error } = await supabase
                  .from('DecisionNotification')
                  .select(`
                    id,
                    game:BettingGame(
                      id,
                      title,
                      decided_at,
                      BettingOption (
                        id,
                        title,
                        is_winning
                      )
                    )
                  `)
                  .eq('id', newNotificationId)
                  .single();
                  
                if (error || !notification) {
                  console.error('Error fetching single notification:', error);
                  return;
                }
                
                // Process this single notification using the existing logic
                const game = Array.isArray(notification.game) ? notification.game[0] : notification.game;
                const winningOption = game?.BettingOption?.find(option => option.is_winning);
                
                // Fetch user bets for this game
                const userBets = await fetchUserBetsForGame(user.id, game?.id);
                
                // Calculate total points won/lost
                let pointsWon = 0;
                
                userBets.forEach(bet => {
                  const option = Array.isArray(bet.option) ? bet.option[0] : bet.option;
                  if (option?.is_winning) {
                    // Correct calculation: for wins, it's bet_amount * (multiplier - 1)
                    pointsWon += bet.amount * (bet.multiplier - 1);
                  } else {
                    // For losses, we subtract the bet amount
                    pointsWon -= bet.amount;
                  }
                });
                
                // Set userWon based on final pointsWon value
                const userWon = pointsWon > 0;
                
                const processedNotification = {
                  type: 'decision' as const,
                  id: notification.id,
                  gameId: game?.id || '',
                  title: game?.title || '',
                  decidedAt: game?.decided_at || '',
                  winningOption: winningOption?.title || '',
                  userWon,
                  pointsWon: Math.round(Math.abs(pointsWon)) // Store absolute value, UI will handle sign
                };
                
                // Update state with the new notification
                const exists = decisionNotifications.some(n => n.id === processedNotification.id);
                if (exists) {
                  // Replace existing notification
                  setDecisionNotifications(decisionNotifications.map(n => 
                    n.id === processedNotification.id ? processedNotification : n
                  ));
                } else {
                  // Add new notification
                  setDecisionNotifications([...decisionNotifications, processedNotification]);
                }
                
                // Show dialog if not viewed before
                if (!hasViewedDecisions) {
                  setShowDecisionsDialog(true);
                  setHasViewedDecisions(true);
                }
              } catch (error) {
                console.error('Error processing notification update:', error);
              }
            }
          }
        }
      )
      .subscribe((status) => handleSubscriptionStatus(status, 'Decision Notifications'));

    // Set up a realtime subscription for group join requests
    const groupRequestsChannel = supabase
      .channel('group-requests-' + user.id)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'RequestJoinGroup'
        },
        async (payload) => {
          console.log('[DEBUG] New group join request detected:', payload);
          
          // Fetch fresh join requests data
          const requests = await fetchGroupJoinRequests(user.id);
          
          // Update state with the new requests
          setGroupJoinRequests(requests);
          
          // Show the dialog for the new request if it wasn't viewed before
          if (!hasViewedRequests && requests.length > 0) {
            setShowGroupRequestsDialog(true);
            setHasViewedRequests(true);
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'RequestJoinGroup'
        },
        async (payload) => {
          console.log('[DEBUG] Group join request deleted:', payload);
          
          // For DELETE events, directly update state without fetching
          const deletedId = payload.old?.id;
          if (deletedId) {
            setGroupJoinRequests(prev => prev.filter(request => request.id !== deletedId));
            
            // Close the dialog if no more requests
            if (groupJoinRequests.length <= 1 && showGroupRequestsDialog) {
              setShowGroupRequestsDialog(false);
            }
          }
        }
      )
      .subscribe((status) => handleSubscriptionStatus(status, 'Group Requests'));

    // Set up a heartbeat to check connection status periodically
    const heartbeatInterval = setInterval(() => {
      // Periodically attempt reconnection to ensure connections remain active
      // This is a simplified approach that doesn't rely on checking channel state
      if (!isReconnecting && mounted) {
        console.log('[DEBUG] Periodic connection check...');
        
        // Ping the database with a simple query to keep connection active
        try {
          supabase.from('BettingGame').select('count', { count: 'exact', head: true })
            .eq('group', currentGroupId)
            .then(result => {
              if (result.error) {
                console.warn('[DEBUG] Connection may be stale, attempting to reconnect...');
                isReconnecting = true;
                
                // Force effect to re-run by toggling state
                setIsNavbarReady(false);
                setTimeout(() => {
                  if (mounted) setIsNavbarReady(true);
                }, 0);
              }
            });
        } catch (err) {
          console.error('[DEBUG] Connection error detected:', err);
          isReconnecting = true;
          
          // Force effect to re-run by toggling state
          setIsNavbarReady(false);
          setTimeout(() => {
            if (mounted) setIsNavbarReady(true);
          }, 0);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => {
      console.log('[DEBUG] Removing realtime channels');
      mounted = false;
      clearInterval(heartbeatInterval);
      
      supabase.removeChannel(decisionNotificationsChannel);
      supabase.removeChannel(groupRequestsChannel);
    };
  }, [user, supabase, currentGroupId, isNavbarReady, fetchUserBetsForGame, fetchGroupJoinRequests, hasViewedDecisions, hasViewedRequests]);

  // Render notification dialogs
  const renderNotificationDialogs = () => {
    return (
      <>
        <DecisionsDialog
          notifications={decisionNotifications}
          open={showDecisionsDialog}
          onOpenChange={setShowDecisionsDialog}
          onMarkAsRead={markDecisionAsRead}
        />
        
        <GroupRequestsDialog
          requests={groupJoinRequests}
          open={showGroupRequestsDialog}
          onOpenChange={setShowGroupRequestsDialog}
          onHandleRequest={handleJoinRequest}
        />
      </>
    );
  };

  // Clear unified loading state and show skeleton loader
  const renderLoadingState = () => (
    <div className="flex items-center gap-4">
      <div className="h-9 w-28 bg-muted/30 animate-pulse rounded-xl"></div>
    </div>
  );

  const { t } = useTranslation('Navbar')

  return (
    <div className="border-b shadow-md bg-gradient-to-r from-background/95 to-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 transition-all duration-300">
      {renderNotificationDialogs()}
      
      <div className="container mx-auto flex h-16 items-center px-4">
        {/* Left section - Navigation links */}
        <div className="flex items-center gap-6 flex-1">
          <Link 
            href="/" 
            className="hidden md:block text-sm font-medium transition-colors hover:text-primary relative group"
          >
            {t('Accueil')}
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
          </Link>
          <Link 
            href="/leaderboard" 
            className="hidden md:flex text-sm font-medium items-center gap-2 transition-colors hover:text-primary relative group"
          >
            <Trophy className="h-4 w-4 transition-transform group-hover:scale-110" />
            <span className="relative">
              {t('Classement')}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
            </span>
          </Link>
          
          {/* Admin link - only show for authorized users */}
          {userData && isAdminUsername(userData.username) && (
            <Link 
              href="/admin" 
              className="hidden md:flex text-sm font-medium items-center gap-2 transition-colors hover:text-primary relative group"
            >
              <Database className="h-4 w-4 transition-transform group-hover:scale-110" />
                      <span className="relative">
                {t('Admin')}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
              </span>
            </Link>
          )}
          
          {/* Mobile hamburger menu - only show when user is authenticated and navbar is ready */}
          {user && isNavbarReady && (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[250px] sm:w-[300px]">
                <SheetHeader className="pb-4">
                  <SheetTitle className="text-left">{t('Menu')}</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 mt-2">
                  <Link 
                    href="/" 
                    className="flex items-center gap-2 p-2 hover:bg-muted rounded-md transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('Accueil')}
                  </Link>
                  <Link 
                    href="/leaderboard" 
                    className="flex items-center gap-2 p-2 hover:bg-muted rounded-md transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Trophy className="h-4 w-4" />
                    {t('Classement')}
                  </Link>
                  
                  {/* Admin link in mobile menu */}
                  {userData && isAdminUsername(userData.username) && (
                    <Link 
                      href="/admin" 
                      className="flex items-center gap-2 p-2 hover:bg-muted rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Database className="h-4 w-4" />
                      {t('Admin')}
                    </Link>
                  )}
                  
                  {userData && userData.username && (
                    <Link 
                      href={`/profile/${userData.username}`}
                      className="flex items-center gap-2 p-2 hover:bg-muted rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <User className="h-4 w-4" />
                      {t('Profil')}
                    </Link>
                  )}
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleSignOut();
                      setMobileMenuOpen(false);
                    }}
                    className="mt-2"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {t('Déconnexion')}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
        
        {/* Center section - Title (centered using flexbox) */}
        <div className="flex justify-center flex-shrink md:flex-shrink-0 min-w-0">
          <Link 
            href="/" 
            className="text-lg md:text-xl lg:text-2xl font-bold relative flex items-center transition-transform hover:scale-105 whitespace-nowrap"
          >
            CentraleVegas
            <Image 
              src="/logo.png" 
              alt="Logo" 
              width={32}
              height={32}
              className="ml-2 h-8 md:h-10 object-contain filter drop-shadow-md"
            />
          </Link>
        </div>
        
        {/* Right section - User info and notification icons */}
        <div className="flex justify-end flex-1">
          {!isNavbarReady || isBalanceLoading ? (
            renderLoadingState()
          ) : user && userData && userData.username ? (
            <div className={`flex items-center gap-2 ${!isNavbarReady || isBalanceLoading ? 'opacity-50 pointer-events-none transition-opacity duration-200' : ''}`}>
              {/* Only show the user plus icon if there are group join requests */}
              {groupJoinRequests.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative hover:bg-muted/80 transition-colors"
                  onClick={() => setShowGroupRequestsDialog(true)}
                >
                  <UserPlus className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs text-white font-medium">
                    {groupJoinRequests.length > 9 ? '9+' : groupJoinRequests.length}
                  </span>
                </Button>
              )}

              <Card className="flex items-center gap-2 md:gap-3 px-2 md:px-4 py-2 shadow-md hover:shadow-lg transition-all duration-300 border border-slate-200 hover:border-primary/50 bg-gradient-to-r from-background to-slate-50/30 rounded-xl">
                <Link 
                  href={`/profile/${userData.username}`}
                  className="flex items-center gap-2 hover:text-primary transition-colors group"
                >
                  <div className="relative">
                    <Image 
                      src="/coin.png" 
                      alt="Coins" 
                      width={24}
                      height={24}
                      className="h-5 w-5 md:h-6 md:w-6 min-w-5 min-h-5 md:min-w-6 md:min-h-6 object-contain transition-transform group-hover:scale-110"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!currentGroupId || isBalanceLoading || isTransitioning ? (
                      <span className="font-semibold text-sm md:text-base text-muted-foreground blur-sm select-none">---</span>
                    ) : (
                      <>
                        <span className="font-semibold text-sm md:text-base">{totalBalance.toLocaleString()}</span>
                        {blockedPoints > 0 && (
                          <div className="flex items-center text-xs md:text-sm text-muted-foreground" title={`${blockedPoints.toLocaleString()} ${t('points bloqués dans des paris')}`}>
                            <Lock className="h-3 w-3 md:h-3.5 md:w-3.5 mr-0.5" />
                            <span className="font-medium">{blockedPoints.toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <User className="h-4 w-4 hidden md:block text-slate-400 group-hover:text-primary transition-colors" />
                </Link>
                <Button 
                  variant="ghost" 
                  onClick={handleSignOut}
                  className="hidden md:inline-flex hover:bg-destructive/10 hover:text-destructive transition-colors"
                  size="sm"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  {t('Déconnexion')}
                </Button>
              </Card>
            </div>
          ) : user ? (
            // User is authenticated but has no groups
            <Link 
              href="/groups" 
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors px-3 py-2 rounded-md hover:bg-muted/30"
            >
              <Users className="h-4 w-4" />
              <span>{t('Aucun groupe')}</span>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}