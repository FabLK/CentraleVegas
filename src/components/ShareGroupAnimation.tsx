'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';
import { 
  Share2, 
  Copy, 
  Check, 
  Sparkles, 
  Users, 
  Gift,
  X,
  Link,
  ExternalLink
} from 'lucide-react';
import { useTranslation } from "react-i18next";
import { toast } from 'sonner';

interface ShareGroupAnimationProps {
  groupName: string;
  groupId: number;
  onClose: () => void;
  isVisible: boolean;
}

const ShareGroupAnimation = ({ 
  groupName, 
  groupId, 
  onClose, 
  isVisible 
}: ShareGroupAnimationProps) => {
  const { t } = useTranslation('GroupsManager');
  const [currentStep, setCurrentStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [exiting, setExiting] = useState(false);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);

  // Extract emoji from group name for display
  const extractEmoji = (text: string): string | undefined => {
    const emojiPattern = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u;
    return text.match(emojiPattern)?.[0];
  };

  const groupEmoji = extractEmoji(groupName);
  const displayGroupName = groupEmoji 
    ? groupName.replace(groupEmoji, '').trim() 
    : groupName;

  const shareUrl = `${window.location.origin}/join-group/${groupId}`;

  // Trigger celebration confetti
  useEffect(() => {
    if (isVisible && confettiCanvasRef.current) {
      const myConfetti = confetti.create(confettiCanvasRef.current, {
        resize: true,
        useWorker: true
      });
      
      // Initial celebration burst
      setTimeout(() => {
        myConfetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#fbbf24', '#f59e0b', '#d97706', '#92400e']
        });
      }, 300);

      // Second burst
      setTimeout(() => {
        myConfetti({
          particleCount: 50,
          spread: 100,
          origin: { y: 0.7 },
          colors: ['#10b981', '#059669', '#047857', '#065f46']
        });
      }, 800);
    }
  }, [isVisible]);

  // Auto progress through steps
  useEffect(() => {
    if (!isVisible) return;
    
    const timer = setTimeout(() => {
      if (currentStep === 0) {
        setCurrentStep(1);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [currentStep, isVisible]);

  const handleCopyLink = useCallback(async () => {
    try {
      // Try to use the modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      
      setCopied(true);
      toast.success(t("Lien copié dans le presse-papiers !"));
      
      // Reset copied state after 3 seconds
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('Error copying link:', error);
      toast.error(t("Erreur lors de la copie du lien"));
    }
  }, [shareUrl, t]);

  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      onClose();
      setExiting(false);
      setCurrentStep(0);
      setCopied(false);
    }, 500);
  }, [onClose]);

  // Share via native sharing if available
  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('Rejoignez ma salle de jeux !'),
          text: t(`Venez parier dans ma salle "${displayGroupName}" ${groupEmoji || ''}`),
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled sharing or error occurred
        console.log('Sharing cancelled:', error);
      }
    } else {
      // Fallback to copy link
      handleCopyLink();
    }
  }, [shareUrl, displayGroupName, groupEmoji, t, handleCopyLink]);

  if (!isVisible) return null;

  return (
    <AnimatePresence mode="wait">
      {!exiting && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Confetti canvas */}
          <canvas 
            ref={confettiCanvasRef}
            className="fixed inset-0 w-full h-full pointer-events-none z-10"
          />
          
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute top-4 right-4 z-20 bg-white/80 hover:bg-white/90 backdrop-blur-sm rounded-full h-10 w-10"
          >
            <X className="h-5 w-5" />
          </Button>
          
          <motion.div 
            className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-[95vw] sm:w-[90vw] max-w-md relative overflow-hidden"
            initial={{ scale: 0.8, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 50, opacity: 0 }}
            transition={{ type: "spring", duration: 0.6, bounce: 0.3 }}
          >
            <div className="relative p-6 sm:p-8">
              {/* Animated background elements */}
              <div className="absolute inset-0 overflow-hidden">
                <motion.div
                  className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-amber-400/20 to-orange-400/20 rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
                <motion.div
                  className="absolute -bottom-16 -left-16 w-32 h-32 bg-gradient-to-br from-green-400/20 to-emerald-400/20 rounded-full"
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, -180, -360],
                  }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              </div>

              {/* Content */}
              <div className="relative z-10">
                <AnimatePresence mode="wait">
                  {currentStep === 0 ? (
                    // Step 1: Celebration
                    <motion.div
                      key="celebration"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.5 }}
                      className="text-center"
                    >
                      <motion.div
                        className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full mb-6"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ 
                          type: "spring", 
                          duration: 0.8, 
                          bounce: 0.6,
                          delay: 0.2
                        }}
                      >
                        <motion.div
                          animate={{ rotate: [0, 15, -15, 0] }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity,
                            repeatType: "reverse"
                          }}
                        >
                          {groupEmoji ? (
                            <span className="text-4xl">{groupEmoji}</span>
                          ) : (
                            <Gift className="h-10 w-10 text-white" />
                          )}
                        </motion.div>
                      </motion.div>
                      
                      <motion.h1
                        className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        🎉 {t('Félicitations !')}
                      </motion.h1>
                      
                      <motion.p
                        className="text-lg text-gray-600 dark:text-gray-300 mb-6"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                      >
                        {t('Votre salle')} <span className="font-semibold text-amber-600">&quot;{displayGroupName}&quot;</span> {t('a été créée avec succès !')}
                      </motion.p>

                      <motion.div
                        className="flex items-center justify-center space-x-8"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                      >
                        <motion.div 
                          className="flex items-center space-x-2 text-green-600"
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Sparkles className="h-5 w-5" />
                          <span className="text-sm font-medium">{t('200 points')}</span>
                        </motion.div>
                        <motion.div 
                          className="flex items-center space-x-2 text-blue-600"
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                        >
                          <Users className="h-5 w-5" />
                          <span className="text-sm font-medium">{t('Vous êtes admin')}</span>
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  ) : (
                    // Step 2: Share invitation
                    <motion.div
                      key="share"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.5 }}
                      className="text-center"
                    >
                      <motion.div
                        className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full mb-6"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", duration: 0.6, bounce: 0.4 }}
                      >
                        <Share2 className="h-8 w-8 text-white" />
                      </motion.div>
                      
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {t('Invitez vos amis !')}
                      </h2>
                      
                      <p className="text-gray-600 dark:text-gray-300 mb-6">
                        {t('Partagez le lien pour que vos amis puissent rejoindre votre salle et commencer à parier ensemble.')}
                      </p>

                      {/* Share link display */}
                      <motion.div
                        className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-6 border border-gray-200 dark:border-gray-700"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <div className="flex items-center space-x-2">
                          <Link className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">
                            {shareUrl}
                          </span>
                        </div>
                      </motion.div>

                      {/* Action buttons */}
                      <div className="space-y-3">
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                        >
                          <Button
                            onClick={handleCopyLink}
                            className={`w-full ${copied ? 'bg-green-500 hover:bg-green-600' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'} text-white shadow-lg hover:shadow-xl transition-all duration-200`}
                            size="lg"
                          >
                            {copied ? (
                              <>
                                <Check className="h-5 w-5 mr-2" />
                                {t('Copié !')}
                              </>
                            ) : (
                              <>
                                <Copy className="h-5 w-5 mr-2" />
                                {t('Copier le lien')}
                              </>
                            )}
                          </Button>
                        </motion.div>

                        {/* Native share button if available */}
                        {'share' in navigator && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                          >
                            <Button
                              onClick={handleNativeShare}
                              variant="outline"
                              className="w-full"
                              size="lg"
                            >
                              <ExternalLink className="h-5 w-5 mr-2" />
                              {t('Partager')}
                            </Button>
                          </motion.div>
                        )}

                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 }}
                        >
                          <Button
                            onClick={handleClose}
                            variant="ghost"
                            className="w-full text-gray-500 hover:text-gray-700"
                          >
                            {t('Plus tard')}
                          </Button>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShareGroupAnimation;
