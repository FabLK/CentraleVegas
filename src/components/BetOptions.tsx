'use client'

import { TrendingUp, Trophy, Loader2, AlertTriangle, Trash2, AlertCircle, Lock } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/lib/supabase/context"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

// Add keyframes for animations
const keyframes = `
@keyframes pulse-glow {
  0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}

@keyframes slide-in {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes trophy-spin {
  0% { transform: rotate(-5deg) scale(1); }
  50% { transform: rotate(5deg) scale(1.1); }
  100% { transform: rotate(-5deg) scale(1); }
}

@keyframes lock-pulse {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
}

@keyframes glimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes border-shimmer {
  0% { border-color: rgba(107, 114, 128, 0.3); }
  50% { border-color: rgba(107, 114, 128, 0.6); }
  100% { border-color: rgba(107, 114, 128, 0.3); }
}

@keyframes subtle-float {
  0% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
  100% { transform: translateY(0); }
}

@keyframes multiplier-glow {
  0% { text-shadow: 0 0 5px rgba(250, 182, 0, 0); }
  50% { text-shadow: 0 0 10px rgba(250, 182, 0, 0.3); }
  100% { text-shadow: 0 0 5px rgba(250, 182, 0, 0); }
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes victory-confetti {
  0% { background-position: 0% 0%; }
  100% { background-position: 100% 100%; }
}

@keyframes trophy-glow {
  0% { filter: drop-shadow(0 0 3px rgba(34, 197, 94, 0.3)); }
  50% { filter: drop-shadow(0 0 8px rgba(34, 197, 94, 0.6)); }
  100% { filter: drop-shadow(0 0 3px rgba(34, 197, 94, 0.3)); }
}

@keyframes points-fade {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes subtle-sparkle {
  0% { background-position: -100% 0; }
  100% { background-position: 200% 0; }
}

@keyframes soft-background-pulse {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes soft-border-glow {
  0% { border-color: rgba(34, 197, 94, 0.6); }
  50% { border-color: rgba(34, 197, 94, 0.8); }
  100% { border-color: rgba(34, 197, 94, 0.6); }
}

@keyframes float-badge {
  0% { transform: translateY(0) translateX(0); }
  50% { transform: translateY(-3px) translateX(0.5px); }
  100% { transform: translateY(0) translateX(0); }
}

@keyframes scale-in-out {
  0% { transform: scale(0.9); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.8; }
}

@keyframes numberChange {
  0% { transform: translateY(-5px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

@keyframes progressGrow {
  0% { opacity: 0.8; }
  100% { opacity: 1; }
}
`;

interface BettingOption {
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
}

interface BetOptionsProps {
  bettingOptions: BettingOption[];
  selectedTime?: string;
  setSelectedTime: (time: string) => void;
  setHoveredTime: (time: string | undefined) => void;
  gameStatus: 'active' | 'pending_decision' | 'decided';
  isReferee?: boolean;
  onRefereeDecision?: (optionId: string) => void;
  isDecisionLoading?: boolean;
  decisionLoadingOptionId?: string;
  uniqueBettors: number;
  gameId: string;
  isUserBlacklisted?: boolean;
}

export function BetOptions({
  bettingOptions = [],
  selectedTime,
  setSelectedTime,
  setHoveredTime,
  gameStatus,
  isReferee = false,
  onRefereeDecision,
  isDecisionLoading = false,
  decisionLoadingOptionId,
  uniqueBettors,
  gameId,
  isUserBlacklisted = false,
}: BetOptionsProps) {
  const router = useRouter();
  const supabase = useSupabase();
  const [isDeleting, setIsDeleting] = useState(false);
  const { t } = useTranslation('BetOptions');

  if (!bettingOptions?.length) {
    return <div>{t('loading_options')}</div>;
  }

  // Helper function to get option styles
  const getOptionStyles = (slot: BettingOption) => {
    // Non-selectable states: blacklisted user or game not in active state
    const isNonSelectable = 
      (isUserBlacklisted && gameStatus === 'active') || 
      (gameStatus === 'pending_decision' && !isReferee);
      
    if (isNonSelectable) {
      return {
        border: gameStatus === 'pending_decision' && !isReferee 
          ? 'border-gray-400' 
          : 'border-gray-400',
        background: gameStatus === 'pending_decision' && !isReferee 
          ? 'bg-gradient-to-br from-gray-100/70 to-gray-200/50' 
          : 'bg-gray-100/30',
        text: 'text-gray-400',
        progressBar: 'bg-gray-400/20',
        shadow: gameStatus === 'pending_decision' && !isReferee 
          ? 'shadow-md shadow-gray-300/30' 
          : ''
      };
    }
    
    if (gameStatus === 'decided') {
      if (slot.isWinning) {
        if (slot.userBet) {
          return {
            border: 'border-green-500/70 animate-[soft-border-glow_4s_ease-in-out_infinite]',
            background: 'bg-gradient-to-br from-green-500/10 via-green-400/5 to-green-500/10 hover:from-green-500/20 hover:via-green-400/15 hover:to-green-500/20',
            text: 'text-green-600',
            progressBar: 'bg-gradient-to-r from-green-400/80 to-green-500/80',
            shadow: 'shadow-sm shadow-green-500/10',
            winningEffect: 'before:absolute before:inset-0 before:bg-[url("/confetti-pattern.png")] before:bg-repeat before:opacity-2 before:mix-blend-overlay before:rounded-lg'
          };
        }
        return {
          border: 'border-green-500/70 animate-[soft-border-glow_4s_ease-in-out_infinite]',
          background: 'bg-gradient-to-br from-green-500/10 to-green-500/5 hover:from-green-500/20 hover:to-green-500/10',
          text: 'text-green-600',
          progressBar: 'bg-gradient-to-r from-green-400/80 to-green-500/80',
          shadow: 'shadow-sm shadow-green-500/10'
        };
      }
      // Non-winning options for decided games
      if (slot.userBet) {
        return {
          border: 'border-red-400',
          background: 'bg-gradient-to-br from-red-50/90 via-white/95 to-red-50/80 hover:from-red-50 hover:via-white hover:to-red-50',
          text: 'text-red-500',
          progressBar: 'bg-red-400/40',
          shadow: 'shadow-md shadow-red-400/10'
        };
      }
      // Neutral theme for losing options where user didn't bet
      return {
        border: 'border-gray-300',
        background: 'bg-gradient-to-br from-gray-50/90 to-white/95 hover:from-gray-50 hover:to-white',
        text: 'text-gray-500',
        progressBar: 'bg-gray-300/30',
        shadow: 'shadow-sm'
      };
    }
    
    if (gameStatus === 'pending_decision') {
      if (!isReferee) {
        return {
          border: 'border-gray-400',
          background: 'bg-gray-100/30 cursor-not-allowed',
          text: 'text-gray-400',
          progressBar: 'bg-gray-400/20',
          shadow: ''
        };
      }
      if (uniqueBettors < 2) {
        return {
          border: 'border-gray-400',
          background: 'bg-gray-100/30 cursor-not-allowed',
          text: 'text-gray-400',
          progressBar: 'bg-gray-400/20',
          shadow: ''
        };
      }
      return {
        border: 'border-yellow-500',
        background: 'bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 hover:from-yellow-500/20 hover:to-yellow-500/10',
        text: 'text-yellow-500',
        progressBar: 'bg-gradient-to-r from-yellow-400 to-yellow-500/70',
        shadow: 'shadow-md shadow-yellow-500/20'
      };
    }
    
    return {
      border: selectedTime === slot.time ? 'border-blue-500/60' : 'border-slate-200/60 hover:border-blue-400/50',
      background: selectedTime === slot.time 
        ? 'bg-gradient-to-br from-blue-500/10 via-blue-600/15 to-blue-700/10 hover:from-blue-500/15 hover:via-blue-600/20 hover:to-blue-700/15' 
        : 'bg-gradient-to-br from-white/90 via-slate-50/50 to-white/80 hover:from-white hover:via-slate-50/80 hover:to-white',
      text: selectedTime === slot.time ? 'text-blue-600' : 'text-slate-800',
      progressBar: selectedTime === slot.time ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-slate-300/40',
      shadow: selectedTime === slot.time ? 'shadow-xl shadow-blue-500/30' : 'shadow-xl shadow-slate-300/50'
    };
  };

  // Add delete handler
  const handleDeleteGame = async () => {
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('BettingGame')
        .delete()
        .eq('id', gameId);

      if (error) throw error;

      toast.success(t('bet_deleted_success')); // "Le pari a été supprimé avec succès"
      router.push('/'); // Redirect to home page
    } catch (error) {
      console.error('Error deleting game:', error);
      toast.error(t('bet_deletion_error')); // "Une erreur est survenue lors de la suppression du pari"
      setIsDeleting(false);
    }
  };

  return (
    <>
      <style jsx global>{keyframes}</style>
      {/* Mobile view */}
      <div className="block lg:hidden">
        {isUserBlacklisted && gameStatus === 'active' && (
          <div className="mb-3 p-4 bg-gradient-to-r from-red-50/80 to-red-100/60 border border-red-200/50 rounded-2xl shadow-lg shadow-red-100/40">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-red-800">{t('excluded_from_bet')}</h3>
                {/* Vous êtes exclu de ce pari */}
              </div>
            </div>
          </div>
        )}
        
        {isReferee && gameStatus === 'pending_decision' && (
          <div className={`mb-4 ${
            uniqueBettors < 2 
              ? 'bg-transparent'
              : 'bg-gradient-to-r from-yellow-50/80 to-amber-50/60 border border-yellow-200/50 p-5 rounded-2xl shadow-lg shadow-yellow-100/40'
          }`}>
            {uniqueBettors >= 2 && (
              <h3 className="text-lg font-semibold text-yellow-800">
                {isDecisionLoading 
                  ? t('processing') // "Traitement en cours..."
                  : t('select_winning_option')} {/* "Sélectionnez l'option gagnante" */}
              </h3>
            )}
            {uniqueBettors < 2 && (
              <div className="bg-gradient-to-r from-red-50/80 to-red-100/60 border border-red-200/50 rounded-2xl shadow-lg shadow-red-100/40">
                <div className="p-5 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-red-900">{t('invalid_bet')}</h4>
                    {/* Pari invalide */}
                    <p className="mt-1 text-sm text-red-700">
                      {t('minimum_bettors_required')}
                      {/* Vous devez avoir minimum 2 parieurs différents pour décider du résultat. Supprimez le pour relâcher les points. */}
                    </p>
                    <button
                      onClick={handleDeleteGame}
                      disabled={isDeleting}
                      className="mt-4 inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 disabled:from-red-300 disabled:to-red-400 text-white rounded-2xl transition-all duration-200 font-medium shadow-md shadow-red-500/25"
                    >
                      {isDeleting ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {t('deleting')} {/* Suppression... */}
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          {t('delete_bet')} {/* Supprimer le pari */}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:gap-3">
          {bettingOptions.map((slot) => {
            const styles = getOptionStyles(slot);
            return (
              <div
                key={slot.time}
                onClick={() => {
                  if (gameStatus === 'active' && !isUserBlacklisted) {
                    setSelectedTime(slot.time);
                  } else if (gameStatus === 'pending_decision' && isReferee && onRefereeDecision && !isDecisionLoading && uniqueBettors >= 2) {
                    onRefereeDecision(slot.id);
                  }
                }}
                onMouseEnter={() => {
                  if ((gameStatus === 'active' && !isUserBlacklisted) || 
                      (gameStatus === 'pending_decision' && isReferee && !isDecisionLoading && uniqueBettors >= 2)) {
                    setHoveredTime(slot.time);
                  } else {
                    // Allow hover effect for all options when game is expired
                    setHoveredTime(slot.time);
                  }
                }}
                onMouseLeave={() => setHoveredTime(undefined)}
                className={`relative rounded-2xl border-2 transition-all duration-300 ${
                  ((gameStatus === 'active' && !isUserBlacklisted) || 
                   (gameStatus === 'pending_decision' && isReferee && !isDecisionLoading && uniqueBettors >= 2)) 
                    ? 'cursor-pointer hover:translate-y-[-2px] hover:scale-[1.02]' 
                    : isDecisionLoading ? 'cursor-wait' : ''
                } ${styles.border} ${styles.background} ${styles.shadow} ${slot.isWinning && gameStatus === 'decided' ? styles.winningEffect || '' : ''}`}
              >
                {/* Points badge overlay - Mobile */}
                {gameStatus === 'decided' && slot.userBet && (
                  <div className="absolute -top-2 -right-2 z-20">
                    {slot.isWinning ? (
                      <div className="flex items-center justify-center px-3 py-1 bg-gradient-to-b from-green-400 to-green-500 text-white text-[10px] rounded-2xl shadow-lg shadow-green-500/30 border border-green-300/50 font-semibold">
                        <span className="font-bold">+{Math.floor(slot.userBet.amount * (slot.userBet.multiplier - 1))}</span>
                        <span className="ml-0.5 opacity-90 text-[10px]">{t('pts')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center px-3 py-1 bg-gradient-to-b from-red-400 to-red-500 text-white text-[10px] rounded-2xl shadow-lg shadow-red-500/30 border border-red-300/50 font-semibold">
                        <span className="font-bold">-{slot.userBet.amount}</span>
                        <span className="ml-0.5 opacity-90 text-[10px]">{t('pts')}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* Lock badge overlay for expired games - Mobile */}
                {gameStatus === 'pending_decision' && !isReferee && (
                  <div className="absolute -top-2 -right-2 z-20">
                    <div className="flex items-center justify-center px-3 py-1.5 bg-gradient-to-b from-slate-400 to-slate-500 text-white text-[10px] rounded-2xl shadow-lg shadow-slate-500/30 border border-slate-300/50">
                      <Lock className="w-3 h-3" />
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center w-full p-2 sm:p-4">
                  <div className="text-left">
                    <div className={`text-lg sm:text-2xl md:text-3xl font-medium ${styles.text}`}>
                      {isDecisionLoading && slot.id === decisionLoadingOptionId ? (
                        <span className="flex items-center">
                          <Loader2 className="animate-spin w-5 h-5 mr-1" />
                          {t('recording')} {/* Enregistrement */}
                        </span>
                      ) : (
                        <>
                          {slot.time}
                          {gameStatus === 'decided' && slot.isWinning && (
                            <span className="ml-2 text-green-500 animate-[trophy-spin_3s_ease-in-out_infinite] inline-block">
                              <Trophy className="inline w-5 h-5 sm:w-6 sm:h-6 animate-[trophy-glow_2s_ease-in-out_infinite]" />
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div 
                      key={`multiplier-${slot.latestMultiplier}`}
                      className={`text-xl sm:text-3xl md:text-3xl font-bold ${styles.text} flex items-center gap-1 justify-end ${selectedTime === slot.time ? 'animate-[multiplier-glow_2s_infinite]' : ''} animate-[numberChange_0.3s_ease-out]`}
                    >
                      <TrendingUp className="w-3 h-3 sm:w-5 sm:h-5" />
                      {slot.latestMultiplier}x
                    </div>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 w-full h-1.5 overflow-hidden rounded-b-2xl">
                  <div 
                    key={`progress-${slot.id}`}
                    className={`absolute inset-0 ${styles.progressBar} animate-[progressGrow_0.6s_ease-out] rounded-b-2xl`}
                    style={{ 
                      width: `${slot.percentage}%`,
                      transition: 'width 0.8s ease-in-out'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop view - removed extra grid wrapper */}
      <div className="hidden lg:block">
        {isUserBlacklisted && gameStatus === 'active' && (
          <div className="mb-5 p-5 bg-gradient-to-r from-red-50/80 to-red-100/60 border border-red-200/50 rounded-2xl shadow-lg shadow-red-100/40">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-red-800">{t('excluded_from_bet')}</h3>
                {/* Vous êtes exclu de ce pari */}
              </div>
            </div>
          </div>
        )}
        
        {isReferee && gameStatus === 'pending_decision' && (
          <div className={`mb-5 ${
            uniqueBettors < 2 
              ? 'bg-transparent'
              : 'bg-gradient-to-r from-yellow-50/80 to-amber-50/60 border border-yellow-200/50 p-6 rounded-2xl shadow-lg shadow-yellow-100/40'
          }`}>
            {uniqueBettors >= 2 && (
              <h3 className="text-lg font-semibold text-yellow-800">
                {isDecisionLoading 
                  ? t('processing') // "Traitement en cours..."
                  : t('select_winning_option')} {/* "Sélectionnez l'option gagnante" */}
              </h3>
            )}
            {uniqueBettors < 2 && (
              <div className="bg-gradient-to-r from-red-50/80 to-red-100/60 border border-red-200/50 rounded-2xl shadow-lg shadow-red-100/40">
                <div className="p-6 flex items-start gap-4">
                  <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-red-900">{t('invalid_bet')}</h4>
                    {/* Pari invalide */}
                    <p className="mt-1 text-sm text-red-700">
                    {t('minimum_bettors_required')}
                    {/* Vous devez avoir minimum 2 parieurs différents pour décider du résultat. Supprimez le pour relâcher les points. */}
                    </p>
                    <button
                      onClick={handleDeleteGame}
                      disabled={isDeleting}
                      className="mt-4 inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 disabled:from-red-300 disabled:to-red-400 text-white rounded-2xl transition-all duration-200 font-medium shadow-md shadow-red-500/25"
                    >
                      {isDeleting ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {t('deleting')} {/* Suppression... */}
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          {t('delete_bet')} {/* Supprimer le pari */}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3">
          {bettingOptions.map((slot) => {
            const styles = getOptionStyles(slot);
            return (
              <div 
                key={slot.time}
                className={`relative rounded-2xl border-2 transition-all duration-300 ${
                  ((gameStatus === 'active' && !isUserBlacklisted) || 
                   (gameStatus === 'pending_decision' && isReferee && !isDecisionLoading && uniqueBettors >= 2)) 
                    ? 'cursor-pointer hover:translate-y-[-3px] hover:scale-[1.02]' 
                    : isDecisionLoading ? 'cursor-wait' : ''
                } ${styles.border} ${styles.background} ${styles.shadow} ${slot.isWinning && gameStatus === 'decided' ? styles.winningEffect || '' : ''}`}
                onClick={() => {
                  if (gameStatus === 'active' && !isUserBlacklisted) {
                    setSelectedTime(slot.time);
                  } else if (gameStatus === 'pending_decision' && isReferee && onRefereeDecision && !isDecisionLoading && uniqueBettors >= 2) {
                    onRefereeDecision(slot.id);
                  }
                }}
                onMouseEnter={() => {
                  if ((gameStatus === 'active' && !isUserBlacklisted) || 
                      (gameStatus === 'pending_decision' && isReferee && !isDecisionLoading && uniqueBettors >= 2)) {
                    setHoveredTime(slot.time);
                  } else {
                    // Allow hover effect for all options when game is expired
                    setHoveredTime(slot.time);
                  }
                }}
                onMouseLeave={() => setHoveredTime(undefined)}
              >
                {/* Points badge overlay - Desktop */}
                {gameStatus === 'decided' && slot.userBet && (
                  <div className="absolute -top-4 -right-3 z-20">
                    {slot.isWinning ? (
                      <div className="flex items-center justify-center px-4 py-1 bg-gradient-to-b from-green-400 to-green-500 text-white text-sm rounded-2xl shadow-lg shadow-green-500/30 border border-green-300/50 font-semibold">
                        <span className="font-bold">+{Math.floor(slot.userBet.amount * (slot.userBet.multiplier - 1))}</span>
                        <span className="ml-0.5 opacity-90 text-xs">{t('pts')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center px-4 py-1 bg-gradient-to-b from-red-400 to-red-500 text-white text-sm rounded-2xl shadow-lg shadow-red-500/30 border border-red-300/50 font-semibold">
                        <span className="font-bold">-{slot.userBet.amount}</span>
                        <span className="ml-0.5 opacity-90 text-xs">{t('pts')}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* Lock badge overlay for expired games - Desktop */}
                {gameStatus === 'pending_decision' && !isReferee && (
                  <div className="absolute -top-4 -right-3 z-20">
                    <div className="flex items-center justify-center px-4 py-2 bg-gradient-to-b from-slate-400 to-slate-500 text-white text-sm rounded-2xl shadow-lg shadow-slate-500/30 border border-slate-300/50">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex justify-between items-center">
                    <div className={`text-2xl font-medium ${styles.text}`}>
                      {isDecisionLoading && slot.id === decisionLoadingOptionId ? (
                        <span className="flex items-center">
                          <Loader2 className="animate-spin w-5 h-5 mr-1" />
                          {t('recording')} {/* Enregistrement */}
                        </span>
                      ) : (
                        <>
                          {slot.time}
                          {gameStatus === 'decided' && slot.isWinning && (
                            <span className="ml-2 text-green-500 animate-[trophy-spin_3s_ease-in-out_infinite] inline-block">
                              <Trophy className="inline w-5 h-5 sm:w-7 sm:h-7 animate-[trophy-glow_2s_ease-in-out_infinite]" />
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-right relative">
                      <div 
                        key={`multiplier-${slot.latestMultiplier}`}
                        className={`text-4xl font-bold ${styles.text} flex items-center gap-2 justify-end ${selectedTime === slot.time ? 'animate-[multiplier-glow_2s_infinite]' : ''} animate-[numberChange_0.3s_ease-out]`}
                      >
                        <TrendingUp className="w-6 h-6" />
                        {slot.latestMultiplier}x
                      </div>
                    </div>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 w-full h-2 overflow-hidden rounded-b-2xl">
                  <div 
                    key={`progress-${slot.id}`}
                    className={`absolute inset-0 ${styles.progressBar} animate-[progressGrow_0.6s_ease-out] rounded-b-2xl`}
                    style={{ 
                      width: `${slot.percentage}%`,
                      transition: 'width 0.8s ease-in-out'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  )
}