'use client'

import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose
} from "@/components/ui/drawer"
import React from "react"
import { useSupabase } from "@/lib/supabase/context"
import Image from "next/image"
import { Lock, Delete, Coins, TrendingUp } from "lucide-react"
import { calculateMultiplier, DEFAULT_VIRTUAL_LIQUIDITY, DEFAULT_SLIPPAGE_FACTOR } from "@/lib/utils/bet-multiplier"
import { useUserBalance } from "@/hooks/useUserBalance"
import { RealtimeChannel } from '@supabase/supabase-js'
import { useTranslation } from "react-i18next"

// Define types for bets and options
interface Bet {
  id?: string;
  option: string;
  amount: number;
  created_at: string;
}

interface BettingOption {
  id: string;
}

interface BetDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  betAmount: number | undefined
  setBetAmount: React.Dispatch<React.SetStateAction<number | undefined>>
  potentialWin: number
  userBalance?: number
  totalBalance?: number
  blockedBalance?: number
  gameId: string
  optionId: string
  userId: string
  groupId: number
  onBetPlaced?: (amount: number, multiplier: number) => void
  customPlaceBetHandler?: (amount: number, multiplier: number) => Promise<void>
}

export function BetDrawer({ 
  open, 
  onOpenChange, 
  betAmount,
  setBetAmount,
  potentialWin,
  userBalance: propUserBalance,
  totalBalance: propTotalBalance,
  blockedBalance: propBlockedBalance,
  gameId,
  optionId,
  userId,
  groupId,
  onBetPlaced,
  customPlaceBetHandler
}: BetDrawerProps) {
  const { t } = useTranslation('BetDrawer');

  const [inputValue, setInputValue] = React.useState<string>('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [showConfetti, setShowConfetti] = React.useState(false)
  const [animatingValue, setAnimatingValue] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const [showExceedWarning, setShowExceedWarning] = React.useState(false)
  // Add pulsing button animation state
  const [pulsingButton, setPulsingButton] = React.useState(false)
  // Add state for current multiplier
  const [currentMultiplierValue, setCurrentMultiplierValue] = React.useState<number>(2.0)
  // Add state for previous multiplier value to detect changes
  const [prevMultiplierValue, setPrevMultiplierValue] = React.useState<number>(2.0);
  const [isMultiplierAnimating, setIsMultiplierAnimating] = React.useState(false);
  
  // Add state for previous bets and options
  const [previousBets, setPreviousBets] = React.useState<Bet[]>([]);
  const [gameOptions, setGameOptions] = React.useState<BettingOption[]>([]);
  const [isInitialDataLoaded, setIsInitialDataLoaded] = React.useState(false);
  
  const supabase = useSupabase()
  
  // Use the global balance context instead of local fetching
  // Skip syncing global state if we are in demo mode (custom handler present or groupId is 0)
  const { 
    availableBalance, 
    totalBalance: contextTotalBalance, 
    blockedPoints 
  } = useUserBalance(groupId, { skipSync: !!customPlaceBetHandler || groupId === 0 });
  
  // Use either prop values or context values, preferring context
  const userBalance = propUserBalance !== undefined ? propUserBalance : availableBalance;
  const totalBalance = propTotalBalance !== undefined ? propTotalBalance : contextTotalBalance;
  const blockedBalance = propBlockedBalance !== undefined ? propBlockedBalance : blockedPoints;
  
  // Calculate dynamic potential win based on bet amount and current multiplier
  const dynamicPotentialWin = React.useMemo(() => {
    if (betAmount && betAmount > 0) {
      return betAmount * currentMultiplierValue;
    }
    return potentialWin; // fallback to prop value if no bet amount set
  }, [betAmount, currentMultiplierValue, potentialWin]);

  // Function to update multiplier when a new bet comes in via realtime
  const updateMultiplierWithNewBet = React.useCallback((newBet: Bet, options: BettingOption[], currentBetAmount: number) => {
    try {
      const calculatedMultiplier = calculateMultiplier(
        optionId,
        [...previousBets, newBet],
        options,
        DEFAULT_VIRTUAL_LIQUIDITY,
        currentBetAmount,
        DEFAULT_SLIPPAGE_FACTOR
      );
      
      // Only animate if there's a meaningful change
      if (Math.abs(calculatedMultiplier - currentMultiplierValue) > 0.01) {
        setPrevMultiplierValue(currentMultiplierValue);
        setIsMultiplierAnimating(true);
        setTimeout(() => setIsMultiplierAnimating(false), 500);
      }
      
      setCurrentMultiplierValue(calculatedMultiplier);
    } catch (error) {
      console.error('Error updating multiplier with new bet:', error);
    }
  }, [currentMultiplierValue, optionId, previousBets]);

  // Initialize data and set up realtime subscription
  React.useEffect(() => {
    let realtimeSubscription: RealtimeChannel | null = null;
    
    const fetchInitialData = async () => {
      try {
        // Only fetch if we have a valid gameId
        if (gameId) {
          // Get all options for this game
          const { data: options, error: optionsError } = await supabase
            .from('BettingOption')
            .select('id')
            .eq('game', gameId);
            
          if (optionsError) {
            console.error('Error fetching game options:', optionsError);
            return;
          }
          
          if (options) {
            setGameOptions(options);
            
            // Get all previous bets for this game
            const { data: bets, error: betsError } = await supabase
              .from('Bets')
              .select('id, option, amount, created_at')
              .eq('game', gameId);
            
            if (betsError) {
              console.error('Error fetching previous bets:', betsError);
              return;
            }
            
            setPreviousBets(bets || []);
            setIsInitialDataLoaded(true);
            
            // Set up realtime subscription for new bets
            realtimeSubscription = supabase
              .channel(`game-bets-${gameId}`)
              .on('postgres_changes', 
                {
                  event: 'INSERT',
                  schema: 'public',
                  table: 'Bets',
                  filter: `game=eq.${gameId}`
                }, 
                (payload) => {
                  // Handle new bet
                  const newBet = payload.new as Bet;
                  setPreviousBets(prev => [...prev, newBet]);
                  
                  // Recalculate multiplier if we have a bet amount
                  if (betAmount && betAmount > 0 && options) {
                    updateMultiplierWithNewBet(newBet, options, betAmount);
                  }
                }
              )
              .subscribe();
          }
        }
      } catch (error) {
        console.error('Error setting up realtime subscription:', error);
      }
    };
    
    fetchInitialData();
    
    // Cleanup function
    return () => {
      if (realtimeSubscription) {
        supabase.removeChannel(realtimeSubscription);
      }
    };
  }, [gameId, supabase]);

  // Calculate multiplier when bet amount changes, using cached data
  React.useEffect(() => {
    if (betAmount && betAmount > 0 && isInitialDataLoaded && gameOptions.length > 0) {
      try {
        const calculatedMultiplier = calculateMultiplier(
          optionId,
          previousBets,
          gameOptions,
          DEFAULT_VIRTUAL_LIQUIDITY,
          betAmount,
          DEFAULT_SLIPPAGE_FACTOR
        );
        
        // Check if multiplier has changed significantly to trigger animation
        if (Math.abs(calculatedMultiplier - currentMultiplierValue) > 0.01) {
          setPrevMultiplierValue(currentMultiplierValue);
          setIsMultiplierAnimating(true);
          setTimeout(() => setIsMultiplierAnimating(false), 500);
        }
        
        setCurrentMultiplierValue(calculatedMultiplier);
      } catch (error) {
        console.error('Error calculating multiplier:', error);
        // Set a default multiplier if calculation fails
        setCurrentMultiplierValue(2.0);
      }
    }
  }, [betAmount, previousBets, gameOptions, isInitialDataLoaded, optionId, currentMultiplierValue]);

  // Initialize the default multiplier (no bet amount yet)
  React.useEffect(() => {
    if (!betAmount || betAmount <= 0) {
      if (isInitialDataLoaded && gameOptions.length > 0) {
        try {
          // Use the calculateMultiplier function with betAmount=0
          const calculatedMultiplier = calculateMultiplier(
            optionId,
            previousBets,
            gameOptions,
            DEFAULT_VIRTUAL_LIQUIDITY,
            0, // Use 0 as the bet amount for default display
            DEFAULT_SLIPPAGE_FACTOR
          );
          
          setCurrentMultiplierValue(calculatedMultiplier);
        } catch (error) {
          console.error('Error calculating default multiplier:', error);
        }
      }
    }
  }, [isInitialDataLoaded, gameOptions, optionId, betAmount, previousBets]);

  // Handle keyboard input
  const handleKeyPress = React.useCallback((key: string) => {
    if (key === 'clear') {
      setInputValue('');
      setBetAmount(undefined);
      setShowExceedWarning(false);
      return;
    }

    if (key === 'backspace') {
      setInputValue(prev => prev.slice(0, -1));
      const newValue = inputValue.slice(0, -1);
      setBetAmount(newValue ? parseInt(newValue) : undefined);
      setShowExceedWarning(false);
      return;
    }

    if (key === 'done') {
      const numValue = parseInt(inputValue);
      if (numValue > 0 && numValue <= userBalance) {
        setBetAmount(numValue);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1000);
      }
      return;
    }

    // Only allow numbers and limit input length
    if (/^\d+$/.test(key) && inputValue.length < 10) {
      const newValue = inputValue + key;
      const numValue = parseInt(newValue);
      
      // Only update if the amount is within available balance
      if (numValue <= userBalance) {
        setInputValue(newValue);
        setBetAmount(numValue);
        setShowExceedWarning(false);
      } else {
        // Provide feedback that the amount exceeds available balance
        setShowExceedWarning(true);
        setTimeout(() => setShowExceedWarning(false), 3000);
      }
    }
  }, [inputValue, userBalance, setBetAmount]);

  // Add button animation effect when bet amount is valid
  React.useEffect(() => {
    if (betAmount && betAmount > 0 && betAmount <= userBalance) {
      setPulsingButton(true);
    } else {
      setPulsingButton(false);
    }
  }, [betAmount, userBalance]);

  const handlePlaceBet = async () => {
    // Relax validation if custom handler is provided (e.g. for demo mode)
    if (!betAmount || betAmount > userBalance || (!customPlaceBetHandler && (!userId || !groupId))) {
      console.error('Invalid bet data:', { betAmount, userBalance, userId, groupId });
      return;
    }
    
    // Enhanced visual feedback for bet placement
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 1500);

    // If custom handler is provided, use it and bypass supabase
    if (customPlaceBetHandler) {
      try {
        setIsLoading(true);
        onOpenChange(false);
        
        await customPlaceBetHandler(betAmount, currentMultiplierValue);
        
        if (onBetPlaced) {
          onBetPlaced(betAmount, currentMultiplierValue);
        }
      } catch (error) {
        console.error('Error in custom bet handler:', error);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      setIsLoading(true);
      onOpenChange(false);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Check if the game belongs to the specified group
      const { data: gameData, error: gameError } = await supabase
        .from('BettingGame')
        .select('id, group')
        .eq('id', gameId)
        .single();
        
      if (gameError) throw gameError;
      
      // Verify the game belongs to the current group
      if (gameData.group !== groupId) {
        throw new Error(`Game does not belong to the current group (${groupId})`);
      }

      // Calculate the multiplier using our cached data
      const calculatedMultiplier = calculateMultiplier(
        optionId,
        previousBets,
        gameOptions,
        DEFAULT_VIRTUAL_LIQUIDITY,
        betAmount,
        DEFAULT_SLIPPAGE_FACTOR
      );

      // Record the bet with multiplier value directly
      const { error: betError } = await supabase
        .from('Bets')
        .insert({
          created_at: new Date().toISOString(),
          game: gameId,
          option: optionId,
          multiplier: calculatedMultiplier,
          user: userId,
          amount: betAmount
        });

      if (betError) throw betError;

      // Trigger the onBetPlaced callback if it exists
      if (onBetPlaced) {
        onBetPlaced(betAmount, calculatedMultiplier);
      }

    } catch (error) {
      console.error('Error placing bet:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh] sm:rounded-xl sm:mx-auto backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 border border-gray-200/60 dark:border-gray-800/60 shadow-xl">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Place Your Bet</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pb-0 sm:p-6 sm:pb-0">
          <div className="flex flex-col items-center gap-4">
            {userBalance === 0 ? (
              <div className="w-full max-w-[450px] p-6 bg-yellow-50/80 dark:bg-yellow-950/50 rounded-xl border border-yellow-200/70 dark:border-yellow-800/60 text-center space-y-4 shadow-md">
                <Lock className="h-12 w-12 mx-auto text-yellow-600 dark:text-yellow-500 drop-shadow-sm" />
                <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-400">{t('Aucun point disponible')}</h3>
                <p className="text-yellow-700/90 dark:text-yellow-300/90 text-sm">
                  {t('Vous n\'avez pas de points disponibles pour parier. Créez des paris et gagnez 10% des points pariés')}
                </p>
              </div>
            ) : (
              <>
                {/* Redesigned unified betting component */}
                <div className="w-full max-w-[450px] rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800/70 backdrop-filter">
                  
                  {/* Unified Visual Points Component */}
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/80 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border-b border-amber-200/30 dark:border-amber-800/30">
                    <div className="flex items-center justify-between mb-2">
                      {/* Removed "Vos Points" text */}
                      {/* Removed "Pari: multiplier" text */}
                    </div>
                  </div>
                  
                  {/* Middle section: Bet input with visual emphasis */}
                  <div className="p-5 sm:p-7 space-y-6 relative bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-900/80">
                    {/* Improved bet input display */}
                    <div className="relative flex flex-col items-center">
                      {/* Removed "Montant du Pari" text */}
                      
                      <div className="relative flex items-center justify-center w-full">
                        {showConfetti && (
                          <div className="absolute -top-6 -left-6 w-full h-full pointer-events-none">
                            {[...Array(15)].map((_, i) => (
                              <motion.div 
                                key={i}
                                className="absolute w-2 h-2 rounded-full"
                                initial={{ 
                                  x: 0, 
                                  y: 0, 
                                  scale: 0,
                                  backgroundColor: ['#F59E0B', '#EC4899', '#8B5CF6', '#10B981'][Math.floor(Math.random() * 4)] 
                                }}
                                animate={{ 
                                  x: [0, (Math.random() - 0.5) * 160], 
                                  y: [0, (Math.random() - 0.5) * 160], 
                                  scale: [0, 1, 0],
                                  rotate: [0, Math.random() * 360]
                                }}
                                transition={{ 
                                  duration: 1 + Math.random() * 0.5, 
                                  ease: "easeOut" 
                                }}
                                style={{
                                  top: '50%',
                                  left: '50%',
                                  boxShadow: '0 0 8px currentColor'
                                }}
                              />
                            ))}
                          </div>
                        )}
                        
                        <div className="relative w-full py-5 px-2 overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/80 border border-gray-200/60 dark:border-gray-700/40 shadow-sm">
                          <motion.div 
                            className={`text-5xl sm:text-6xl font-bold text-center mx-auto flex items-center justify-center ${
                              animatingValue ? 'text-amber-600 dark:text-amber-500' : 'text-gray-800 dark:text-gray-200'
                            }`}
                            animate={{ 
                              scale: animatingValue ? [1, 1.1, 1] : 1,
                            }}
                            transition={{ 
                              duration: animatingValue ? 0.3 : 0,
                            }}
                          >
                            {inputValue || '0'}
                            <Image 
                              src="/coin.png" 
                              alt="Points" 
                              width={80}
                              height={80}
                              className="w-14 h-14 sm:w-16 sm:h-16 ml-2 drop-shadow-md"
                            />
                          </motion.div>
                          
                          {/* Warning message for exceeding balance */}
                          <AnimatePresence>
                            {showExceedWarning && (
                              <motion.div
                                className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-xs p-1.5 text-center font-medium tracking-wide"
                                initial={{ y: 20 }}
                                animate={{ y: 0 }}
                                exit={{ y: 20 }}
                                transition={{ duration: 0.2 }}
                              >
                                {t('Dépassement du solde disponible')} ({userBalance})
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      
                      {/* Enhanced prominent multiplier section */}
                      <motion.div 
                        className="w-full mt-4 sm:mt-6 bg-gradient-to-br from-amber-50 to-amber-100/70 dark:from-amber-900/30 dark:to-amber-800/20 border-2 border-amber-300/50 dark:border-amber-700/40 rounded-xl px-3 py-2 sm:px-5 sm:py-3 relative overflow-hidden shadow-lg"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        {/* Enhanced pulsing background effect */}
                        <motion.div 
                          className="absolute inset-0 bg-gradient-to-r from-amber-400/0 via-amber-300/30 to-amber-400/0 dark:from-amber-500/0 dark:via-amber-500/20 dark:to-amber-500/0"
                          animate={{
                            x: ['-100%', '100%'],
                          }}
                          transition={{
                            duration: 3,
                            ease: "easeInOut",
                            repeat: Infinity,
                            repeatDelay: 0.2,
                          }}
                        />
                        
                        <div className="flex items-center justify-between relative z-10">
                          {/* Left side - Label */}
                          <div className="flex items-center">
                            <div className="-ml-2 mr-2">
                              <Image
                                src="/Red lever.png"
                                alt="Red lever"
                                width={36}
                                height={36}
                                className="object-contain"
                                priority
                                quality={100}
                                unoptimized
                              />
                            </div>
                            <div className="">
                              <h4 className="text-sm sm:text-base font-semibold text-amber-900 dark:text-amber-300">{t('Multiplicateur')}</h4>
                              <p className="text-[10px] sm:text-xs text-amber-700/80 dark:text-amber-400/80 -mt-0.5">{t('Adapté à la mise pour éviter la triche')}</p>
                            </div>
                          </div>
                          
                          {/* Right side - Multiplier value with rolling animation (card removed) */}
                          <div className="relative overflow-visible">
                            {/* Slot machine style rolling digits animation */}
                            <div className="flex items-center justify-end">
                              <div className="relative h-8 sm:h-9 flex justify-end overflow-hidden min-w-[4rem]">
                                {isMultiplierAnimating && (
                                  <>
                                    {/* Previous value rolling out */}
                                    <motion.div
                                      className="absolute right-0 text-right w-full"
                                      initial={{ y: 0 }}
                                      animate={{ y: -40 }}
                                      transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                                    >
                                      <span className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-700 to-amber-500 dark:from-amber-400 dark:to-amber-300 bg-clip-text text-transparent inline-block min-w-full text-right">
                                        {prevMultiplierValue.toFixed(1)}
                                      </span>
                                    </motion.div>
                                    
                                    {/* New value rolling in */}
                                    <motion.div
                                      className="absolute right-0 text-right w-full"
                                      initial={{ y: 40 }}
                                      animate={{ y: 0 }}
                                      transition={{ 
                                        duration: 0.5, 
                                        delay: 0.1,
                                        ease: [0.34, 1.56, 0.64, 1] 
                                      }}
                                    >
                                      <span className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-700 to-amber-500 dark:from-amber-400 dark:to-amber-300 bg-clip-text text-transparent inline-block min-w-full text-right">
                                        {currentMultiplierValue.toFixed(1)}
                                      </span>
                                    </motion.div>
                                  </>
                                )}
                                
                                {!isMultiplierAnimating && (
                                  <div className="text-right w-full">
                                    <span className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-700 to-amber-500 dark:from-amber-400 dark:to-amber-300 bg-clip-text text-transparent inline-block min-w-full text-right">
                                      {currentMultiplierValue.toFixed(1)}
                                    </span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Static multiplication symbol */}
                              <span className="ml-0.5 text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-700 to-amber-500 dark:from-amber-400 dark:to-amber-300 bg-clip-text text-transparent">
                                ×
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                      
                      {/* Visual points bar - moved below bet amount input and height reduced */}
                      <div className="relative w-full mt-3 xs:mt-4 sm:mt-5">
                        {/* Visual points bar */}
                        <div className="w-full h-7 xs:h-8 sm:h-9 bg-gray-100 dark:bg-gray-800/60 rounded-lg overflow-hidden relative shadow-inner">
                          {/* Main segments */}
                          <div className="absolute inset-0 flex">
                            {/* Available points */}
                            <motion.div 
                              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 relative flex items-center justify-start cursor-pointer"
                              initial={{ width: 0 }}
                              animate={{ 
                                width: `${(userBalance / (totalBalance + (dynamicPotentialWin - (betAmount || 0)))) * 100}%`,
                                transition: { duration: 0.8, ease: "easeOut" }
                              }}
                              onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                                // Calculate position relative to the available balance bar
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const percentage = clickX / rect.width;
                                
                                // Calculate bet amount based on percentage of available balance
                                const calculatedAmount = Math.floor(userBalance * percentage);
                                
                                // Only update if calculated amount is valid
                                if (calculatedAmount > 0 && calculatedAmount <= userBalance) {
                                  setInputValue(calculatedAmount.toString());
                                  setBetAmount(calculatedAmount);
                                  setAnimatingValue(true);
                                  setTimeout(() => setAnimatingValue(false), 300);
                                }
                              }}
                            >
                              <div className="absolute inset-0 overflow-hidden">
                                {[...Array(5)].map((_, i) => (
                                  <motion.div 
                                    key={i}
                                    className="absolute w-full h-0.5 bg-white/20"
                                    style={{ top: `${i * 6 + 2}px` }}
                                    animate={{
                                      x: [0, 10, 0],
                                    }}
                                    transition={{
                                      duration: 2 + (i * 0.2),
                                      ease: "easeInOut",
                                      repeat: Infinity,
                                      repeatType: "reverse",
                                      delay: i * 0.1,
                                    }}
                                  />
                                ))}
                              </div>
                              <div className="px-2 xs:px-3 py-1 flex items-center space-x-1 xs:space-x-1.5">
                                <Coins className="w-3 h-3 xs:w-4 xs:h-4 text-amber-100" />
                                <span className="text-white font-bold text-xs xs:text-sm tracking-wide">{userBalance}</span>
                              </div>
                            </motion.div>
                            
                            {/* Locked points */}
                            {blockedBalance > 0 && (
                              <motion.div 
                                className="h-full bg-gradient-to-r from-amber-700/90 to-amber-600/90 flex items-center relative"
                                initial={{ width: 0 }}
                                animate={{ 
                                  width: `${(blockedBalance / (totalBalance + (dynamicPotentialWin - (betAmount || 0)))) * 100}%`,
                                  transition: { duration: 0.8, ease: "easeOut", delay: 0.2 }
                                }}
                              >
                                <div className="absolute inset-0 overflow-hidden">
                                  {[...Array(5)].map((_, i) => (
                                    <motion.div 
                                      key={i}
                                      className="absolute w-full h-0.5 bg-amber-400/20"
                                      style={{ top: `${i * 6 + 2}px` }}
                                      animate={{
                                        x: [0, -10, 0],
                                      }}
                                      transition={{
                                        duration: 2.5 + (i * 0.2),
                                        ease: "easeInOut",
                                        repeat: Infinity,
                                        repeatType: "reverse",
                                        delay: i * 0.1,
                                      }}
                                    />
                                  ))}
                                  <div className="absolute inset-0 opacity-50" 
                                       style={{ 
                                         backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.1) 5px, rgba(255,255,255,0.1) 10px)",
                                         backgroundSize: "12px 12px"
                                       }}>
                                  </div>
                                </div>
                                <div className="px-2 xs:px-3 py-1 flex items-center space-x-1 xs:space-x-1.5">
                                  <Lock className="w-3 h-3 xs:w-4 xs:h-4 text-amber-200/70" />
                                  <span className="text-amber-200/90 font-bold text-xs xs:text-sm tracking-wide">{blockedBalance}</span>
                                </div>
                              </motion.div>
                            )}
                            
                            {/* Potential win points (only shows if bet amount is set) */}
                            {betAmount !== undefined && betAmount > 0 && (
                              <motion.div 
                                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 flex items-center relative overflow-hidden"
                                initial={{ width: 0 }}
                                animate={{ 
                                  width: `${((Math.round(dynamicPotentialWin - (betAmount || 0))) / (totalBalance + (Math.round(dynamicPotentialWin - (betAmount || 0))))) * 100}%`,
                                  transition: { duration: 0.8, ease: "easeOut", delay: 0.4 }
                                }}
                              >
                                <div className="absolute inset-0">
                                  <motion.div 
                                    className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-emerald-300/30 to-emerald-400/0"
                                    animate={{
                                      x: ['-100%', '100%'],
                                    }}
                                    transition={{
                                      duration: 1.5,
                                      ease: "easeInOut",
                                      repeat: Infinity,
                                      repeatDelay: 0.5,
                                    }}
                                  />
                                </div>
                                <div className="px-2 xs:px-3 py-1 flex items-center space-x-1 xs:space-x-1.5">
                                  <TrendingUp className="w-3 h-3 xs:w-4 xs:h-4 text-emerald-100" />
                                  <span className="text-white font-bold text-xs xs:text-sm tracking-wide">+{Math.round(dynamicPotentialWin - (betAmount || 0))}</span>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Custom keyboard in its own section */}
                  <div className="p-5 sm:p-7 pt-0 pb-2 sm:pb-5 bg-white dark:bg-gray-900">
                    <div className="grid grid-cols-3 gap-1.5 xs:gap-2 sm:gap-2.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'clear', 0, 'backspace'].map((key) => (
                        <Button
                          key={key}
                          variant="outline"
                          className={`h-10 xs:h-12 sm:h-14 text-base xs:text-lg font-semibold transition-all duration-150 ${
                            key === 'clear' ? 'bg-red-50 border-red-200/60 text-red-700 hover:bg-red-100/70 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/40 shadow-sm' :
                            key === 'backspace' ? 'bg-gray-50 border-gray-200/60 text-gray-700 hover:bg-gray-100/70 dark:bg-gray-800/60 dark:border-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-700/40 shadow-sm' :
                            'bg-white border-gray-200/60 text-gray-800 hover:bg-gray-50/80 dark:bg-gray-800/30 dark:border-gray-700/40 dark:text-gray-300 dark:hover:bg-gray-700/30 shadow-sm'
                          }`}
                          onClick={() => handleKeyPress(key.toString())}
                        >
                          {key === 'clear' ? 'C' : key === 'backspace' ? <Delete className="h-4 xs:h-5 w-4 xs:w-5" /> : key}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <DrawerFooter className="sm:pb-8 bg-gradient-to-b from-transparent to-gray-50/80 dark:to-gray-900/60 pt-1 xs:pt-2 sm:pt-3">
          <motion.div whileTap={{ scale: 0.98 }} className="max-w-[450px] w-full mx-auto relative">
            <Button 
              ref={buttonRef}
              className={`w-full text-base xs:text-lg sm:text-xl py-4 xs:py-5 sm:py-7 relative z-10 
                          bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-600 hover:via-amber-700 hover:to-amber-600
                          dark:from-amber-600 dark:via-amber-700 dark:to-amber-600 dark:hover:from-amber-700 dark:hover:via-amber-800 dark:hover:to-amber-700
                          border-0 shadow-lg shadow-amber-500/20 dark:shadow-amber-700/30 
                          hover:shadow-amber-500/30 dark:hover:shadow-amber-700/40
                          transition-all duration-200 overflow-hidden rounded-xl font-medium tracking-wide`}
              disabled={!betAmount || betAmount < 1 || betAmount > userBalance || userBalance === 0 || isLoading}
              onClick={handlePlaceBet}
            >
              {userBalance === 0 ? "Aucun point disponible" : 
               isLoading ? (
                 <div className="flex items-center justify-center gap-2">
                   <div className="h-4 xs:h-5 w-4 xs:w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   <span>{t('Traitement...')}</span>
                 </div>
               ) : (
                 <>
                   <span className="relative z-10 font-bold tracking-wide flex items-center justify-center gap-1.5 xs:gap-2">
                     {t('Parier')}
                     {betAmount && (
                       <div className="flex items-center bg-white/20 rounded-full px-2 xs:px-3 py-0.5 xs:py-1 text-sm xs:text-base">
                         <span>{betAmount}</span>
                         <Image 
                           src="/coin.png" 
                           alt="Points" 
                           width={20}
                           height={20}
                           className="w-4 h-4 xs:w-5 xs:h-5 ml-1"
                         />
                       </div>
                     )}
                   </span>
                   {/* Add pulsing effect when bet amount is valid */}
                   {pulsingButton && (
                     <motion.div 
                       className="absolute inset-0 bg-white/20 rounded-xl"
                       animate={{ 
                         scale: [1, 1.05, 1],
                         opacity: [0, 0.5, 0]
                       }}
                       transition={{
                         duration: 1.5,
                         repeat: Infinity,
                         repeatType: "loop",
                       }}
                     />
                   )}
                 </>
               )}
            </Button>
          </motion.div>
          <DrawerClose asChild>
            <Button 
              variant="outline" 
              className="sm:text-lg max-w-[450px] w-full mx-auto mt-2 xs:mt-3 border-gray-300 dark:border-gray-700 
                        bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 transition-all duration-200 rounded-xl font-medium"
              disabled={isLoading}
            >
              {t('Annuler')}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}