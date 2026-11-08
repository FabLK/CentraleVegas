'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useSupabase } from '@/lib/supabase/context';
import confetti from 'canvas-confetti';
import { Coins, Gamepad2, Users, Trophy, ArrowRight, Check, Vote, GraduationCap, Clock, Swords, ArrowLeft } from 'lucide-react';
import { useTranslation } from "react-i18next";

interface OnboardingAnimationProps {
  userId: string;
  onComplete: () => void;
}

const OnboardingAnimation = ({ userId, onComplete }: OnboardingAnimationProps) => {
  const { t } = useTranslation('OnboardingAnimation');
  const [currentStep, setCurrentStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  const supabase = useSupabase();

  // Use useMemo to prevent steps array from being recreated on each render
  const steps = useMemo(() => [
    {
      title: t("Commencez avec 200 points !"),
      description: t("Pariez gratuitement et sans limite"),
      icon: <Coins className="h-12 w-12 text-yellow-500" />,
      animation: "coins"
    },
    {
      title: t("Votre salle, vos paris"),
      description: t("Créez ou rejoignez ces espaces de jeux"),
      icon: <Users className="h-12 w-12 text-blue-500" />,
      animation: "rooms"
    },
    {
      title: t("Créez vos propres jeux"),
      description: t("Trouvez les meilleures idées"),
      icon: <Gamepad2 className="h-12 w-12 text-green-500" />,
      animation: "bets"
    },
    {
      title: t("Dominez le classement"),
      description: t("Gagnez des points en pariant"),
      icon: <Trophy className="h-12 w-12 text-purple-500" />,
      animation: "leaderboard"
    }
  ], [t]);

  useEffect(() => {
    // Trigger confetti animation when reaching the last step
    if (currentStep === steps.length - 1 && confettiCanvasRef.current) {
      const myConfetti = confetti.create(confettiCanvasRef.current, {
        resize: true,
        useWorker: true
      });
      
      myConfetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [currentStep, steps.length]);

  // Use useCallback to prevent function recreation on each render
  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Last step, mark onboarding as completed
      markOnboardingCompleted();
    }
  }, [currentStep, steps.length]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const markOnboardingCompleted = useCallback(async () => {
    try {
      // First set exiting to true to trigger exit animation
      setExiting(true);
      
      // Short delay to allow exit animation to play
      setTimeout(async () => {
        // Update the database to mark user has seen onboarding
        await supabase
          .from('Users')
          .update({ has_seen_onboarding: true })
          .eq('id', userId);
        
        // Trigger the completion callback
        onComplete();
      }, 700);
    } catch (error) {
      console.error('Failed to update onboarding status:', error);
      // Still call onComplete to avoid trapping the user
      setExiting(true);
      setTimeout(() => onComplete(), 700);
    }
  }, [supabase, userId, onComplete, setExiting]);

  // Pre-calculate random values for animations to prevent re-randomizing on each render
  const coinProps = useMemo(() => 
    Array(40).fill(0).map((_, index) => ({
      top: `${Math.random() * 60}%`,
      rotateInitial: Math.random() * 180 - 90,
      rotateAnimate: Math.random() * 360,
      scale: Math.random() * 0.5 + 0.7,
      duration: Math.random() * 3 + 6, // Between 6-9 seconds to cross screen
      delay: (index * 0.25) % 10, // Stagger starts evenly across coins, wrapping around after 10s
      initialOffset: Math.random() * 5 // Initial position spread across screen width
    })), 
  []);

  // Animation for coins raining - with stable random values
  const CoinsAnimation = useCallback(() => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {coinProps.map((props, i) => (
        <motion.div
          key={`coin-${i}`}
          className="absolute text-yellow-500"
          initial={{ 
            left: `${100 + props.initialOffset}%`, 
            top: props.top,
            rotate: props.rotateInitial,
            scale: props.scale
          }}
          animate={{ 
            left: '-10%',
            rotate: props.rotateAnimate
          }}
          transition={{ 
            duration: props.duration, 
            delay: props.delay,
            repeat: Infinity, 
            repeatDelay: 0,
            ease: "linear"
          }}
        >
          <Coins className="w-4 h-4 sm:w-5 sm:h-5" />
        </motion.div>
      ))}
    </div>
  ), [coinProps]);

  // Animation for rooms with stable transitions
  const RoomsAnimation = useCallback(() => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="flex justify-center items-center h-full">
        <motion.div
          className="flex gap-2 sm:gap-4 mt-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          {[...Array(3)].map((_, i) => (
            <motion.div 
              key={`room-${i}`}
              className={`w-12 h-12 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center shadow-lg ${
                i === 0 ? 'bg-blue-100 border-2 border-blue-300' : 
                i === 1 ? 'bg-green-100 border-2 border-green-300' : 
                'bg-purple-100 border-2 border-purple-300'
              }`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ 
                duration: 0.8, 
                delay: 0.2 * i,
                type: "spring",
                stiffness: 50
              }}
            >
              <Users className={`h-6 w-6 sm:h-8 sm:w-8 ${
                i === 0 ? 'text-blue-500' : 
                i === 1 ? 'text-green-500' : 
                i === 2 ? 'text-purple-500' :
                'text-purple-500'
              }`} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  ), []);

  // Animation for bets with stable transitions
  const BetsAnimation = useCallback(() => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="flex justify-center items-center h-full">
        <motion.div
          className="relative scale-75 sm:scale-100"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          {/* For mobile, we'll show fewer bet cards */}
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={`bet-${i}`}
              className={`absolute w-48 sm:w-64 rounded-md p-2 sm:p-4 shadow-md ${
                i === 0 ? 'bg-blue-50 border border-blue-200' : 
                i === 1 ? 'bg-green-50 border border-green-200' : 
                i === 2 ? 'bg-purple-50 border border-purple-200' :
                i === 3 ? 'bg-amber-50 border border-amber-200' :
                'bg-pink-50 border border-pink-200'
              } ${
                // Responsive positioning for each card
                i === 0 ? '-top-28 sm:-top-36 -left-8 sm:-left-12' : 
                i === 1 ? '-top-24 sm:-top-28 -left-52 sm:-left-60' : 
                i === 2 ? '-top-0 sm:-top-0 -right-44 sm:-right-56' :
                i === 3 ? '-top-12 sm:-top-16 left-0' :
                '-top-6 sm:-top-0 -right-0'
              }`}
              initial={{ y: 30, opacity: 0, rotate: (i === 0 || i === 4) ? 10 : (i === 1) ? 6 : (i === 3) ? -6 : 0 }}
              animate={{ y: 0, opacity: 1, rotate: (i === 0 || i === 4) ? -3 : (i === 1) ? 4 : (i === 3) ? 6 : 0 }}
              transition={{ 
                duration: 0.8, 
                delay: 0.15 * i,
                type: "spring",
                stiffness: 40
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {/* Conditionally render icons based on index */} 
                {i === 0 && <Vote className={`h-4 w-4 sm:h-5 sm:w-5 text-blue-500`} />}
                {i === 1 && <GraduationCap className={`h-4 w-4 sm:h-5 sm:w-5 text-green-500`} />}
                {i === 2 && <Swords className={`h-4 w-4 sm:h-5 sm:w-5 text-purple-500`} />}
                {i === 3 && <Clock className={`h-4 w-4 sm:h-5 sm:w-5 text-amber-500`} />}
                {i === 4 && <Gamepad2 className={`h-4 w-4 sm:h-5 sm:w-5 text-pink-500`} />}
                
                <div className={`text-xs sm:text-sm font-medium ${
                  i === 0 ? 'text-blue-700' : 
                  i === 1 ? 'text-green-700' : 
                  i === 2 ? 'text-purple-700' :
                  i === 3 ? 'text-amber-700' :
                  'text-pink-700'
                }`}>
                  {i === 0 ? t("Prochain président ?") : 
                   i === 1 ? t("Qui va rater son année ?") : 
                   i === 2 ? t("L'Ukraine va gagner ?") :
                   i === 3 ? t('Théo en retard demain ?') :
                   t('Gagnant du five ?')}
                </div>
              </div>
              <div className="w-full h-2 sm:h-3 rounded-full bg-gray-200 mb-2">
                <motion.div 
                  className={`h-full rounded-full ${
                    i === 0 ? 'bg-blue-500' : 
                    i === 1 ? 'bg-green-500' : 
                    i === 2 ? 'bg-purple-500' :
                    i === 3 ? 'bg-amber-500' :
                    'bg-pink-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(i === 0 || i === 4) ? 70 : (i === 1 || i === 3) ? 45 : 60}%` }}
                  transition={{ 
                    duration: 1.5,
                    delay: 0.2 * i + 0.5,
                    ease: "easeOut"
                  }}
                />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  ), []);

  // Animation for leaderboard with stable transitions
  const LeaderboardAnimation = useCallback(() => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="flex justify-center items-center h-full">
        <motion.div
          className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-4 shadow-xl border border-purple-200 w-40 sm:w-64"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 50 }}
        >
          <div className="text-center mb-2 sm:mb-3 text-purple-700 font-semibold text-xs sm:text-base">{t("Classement")}</div>
          
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={`rank-${i}`}
              className="flex items-center gap-1.5 sm:gap-3 py-1.5 sm:py-2 border-b border-gray-100"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ 
                duration: 0.5, 
                delay: 0.2 * i + 0.5,
                type: "spring",
                stiffness: 70
              }}
            >
              <div className={`w-4 h-4 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-xs ${
                i === 0 ? 'bg-yellow-100 text-yellow-600' : 
                i === 1 ? 'bg-gray-100 text-gray-600' : 
                'bg-amber-100 text-amber-600'
              }`}>
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="text-[11px] sm:text-sm font-medium">
                  {i === 0 ? 'Emma' : i === 1 ? 'Theo' : 'Lucas'}
                </div>
              </div>
              <div className="font-medium text-[11px] sm:text-sm">
                {i === 0 ? '1250 pts' : i === 1 ? '980 pts' : '820 pts'}
              </div>
            </motion.div>
          ))}
          
          <motion.div
            className="mt-2 sm:mt-2 pt-1.5 sm:pt-2 border-t border-dashed border-purple-200 flex items-center gap-1.5 sm:gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.2 }}
          >
            <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[11px] sm:text-xs">?</div>
            <div className="flex-1">
              <div className="text-[11px] sm:text-sm font-medium">{t("Vous")}</div>
            </div>
            <div className="font-medium text-[11px] sm:text-sm">200 pts</div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  ), []);

  const getAnimationComponent = useCallback((animation: string) => {
    switch(animation) {
      case 'coins': return <CoinsAnimation />;
      case 'rooms': return <RoomsAnimation />;
      case 'bets': return <BetsAnimation />;
      case 'leaderboard': return <LeaderboardAnimation />;
      default: return null;
    }
  }, [CoinsAnimation, RoomsAnimation, BetsAnimation, LeaderboardAnimation]);

  return (
    <AnimatePresence mode="wait">
      {!exiting && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          key="onboarding-main"
        >
          {/* Confetti canvas */}
          <canvas 
            ref={confettiCanvasRef}
            className="fixed inset-0 w-full h-full pointer-events-none z-10"
          />
          
          <motion.div 
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-[95vw] sm:w-[90vw] max-w-xl relative overflow-hidden"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.7 }}
          >
            {/* Step indicators */}
            <div className="absolute top-3 sm:top-4 left-1/2 transform -translate-x-1/2 flex gap-1 z-20">
              {steps.map((_, index) => (
                <div 
                  key={`indicator-${index}`}
                  className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-colors duration-300 ${
                    index === currentStep ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
            
            <div className="h-[350px] xs:h-[400px] sm:h-[450px] md:h-[480px] relative">
              {/* Animation background area */}
              <div className="h-[70%] sm:h-[72%] bg-gradient-to-b from-indigo-50 to-white dark:from-gray-800 dark:to-gray-900 relative overflow-hidden">
                {/* Key the animation to step number to ensure clean remounts */}
                <div key={`animation-${currentStep}`} className="h-full w-full">
                  {getAnimationComponent(steps[currentStep].animation)}
                </div>
              </div>
              
              {/* Content area */}
              <div className="absolute bottom-0 left-0 right-0 h-[45%] sm:h-[40%] p-4 pb-2 sm:p-5 sm:pb-3 md:p-6 md:pb-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`content-${currentStep}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.6 }}
                    className="flex flex-col h-full justify-between"
                  >
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2 text-gray-900 dark:text-white">
                        {steps[currentStep].title}
                      </h2>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                        {steps[currentStep].description}
                      </p>
                    </div>
                    
                    <div className="flex justify-between">
                      {currentStep > 0 && (
                        <Button 
                          onClick={handlePrevious}
                          variant="outline"
                          className="gap-1 sm:gap-2 text-sm sm:text-base py-1.5 px-3 sm:py-2 sm:px-4"
                        >
                          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {t("Précédent")}
                        </Button>
                      )}
                      <div className={currentStep === 0 ? "ml-auto" : ""}>
                        <Button 
                          onClick={handleNext}
                          className="gap-1 sm:gap-2 text-sm sm:text-base py-1.5 px-3 sm:py-2 sm:px-4"
                        >
                          {currentStep < steps.length - 1 ? (
                            <>
                              {t("Suivant")}
                              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </>
                          ) : (
                            <>
                              {t("Commencer")}
                              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OnboardingAnimation;
