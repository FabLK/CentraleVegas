'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSupabase } from '@/lib/supabase/context';
import { useUser } from '@/lib/user/context';
import { useGroup } from '@/lib/group/context';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Lock, Users, Loader2, MessageSquare, CheckCircle2, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface Group {
  id: number;
  name: string;
  description?: string;
  is_publicly_joinable: boolean;
  created_by: string;
  memberCount?: number;
}

// Custom CSS class to prevent zoom on mobile inputs
const noZoomInputClass = "text-[16px] sm:text-sm [-webkit-text-size-adjust:100%] [text-size-adjust:100%]";

export default function JoinGroupPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = useSupabase();
  const { user } = useUser();
  const { setCurrentGroupId, loadUserGroups } = useGroup();
  const { t } = useTranslation('GroupsManager');
  
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [showApplicationDialog, setShowApplicationDialog] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);

  const groupId = params?.id ? (Array.isArray(params.id) ? params.id[0] : params.id) : null;

  useEffect(() => {
    if (!groupId || isNaN(Number(groupId))) {
      setError(t('ID de salle invalide'));
      setLoading(false);
      return;
    }

    fetchGroupDetails();
  }, [groupId, supabase, t]);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch group details
      const { data: groupData, error: groupError } = await supabase
        .from('Group')
        .select('id, name, description, is_publicly_joinable, created_by')
        .eq('id', groupId)
        .single();

      if (groupError || !groupData) {
        setError(t('Salle introuvable'));
        return;
      }

      // Get member count
      const { count, error: countError } = await supabase
        .from('UsersGroupMembership')
        .select('*', { count: 'exact', head: true })
        .eq('group', groupId);

      if (countError) {
        console.error('Error counting members:', countError);
      }

      setGroup({
        ...groupData,
        memberCount: count || 0
      });

    } catch (error) {
      console.error('Error fetching group:', error);
      setError(t('Erreur lors du chargement de la salle'));
    } finally {
      setLoading(false);
    }
  };

  const triggerConfetti = useCallback(() => {
    if (confettiCanvasRef.current) {
      const myConfetti = confetti.create(confettiCanvasRef.current, {
        resize: true,
        useWorker: true
      });
      
      myConfetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      // Additional burst
      setTimeout(() => {
        myConfetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 }
        });
      }, 200);
    }
  }, []);

  const handleJoinGroup = async () => {
    if (!user || !group) {
      toast.error(t('Vous devez être connecté pour rejoindre une salle'));
      return;
    }

    try {
      setJoining(true);

      // Check if user is already a member
      const { data: existingMembership } = await supabase
        .from('UsersGroupMembership')
        .select('id')
        .eq('user', user.id)
        .eq('group', group.id)
        .single();

      if (existingMembership) {
        // User is already a member, just redirect to the group
        await loadUserGroups(user.id);
        setCurrentGroupId(group.id);
        
        // Show success animation
        setShowSuccessAnimation(true);
        triggerConfetti();
        
        toast.success(`${t('Vous êtes déjà membre de')} ${group.name}`);
        
        setTimeout(() => {
          router.push('/');
        }, 1500);
        return;
      }

      if (group.is_publicly_joinable) {
        // Public group - join directly
        const { error } = await supabase
          .from('UsersGroupMembership')
          .insert({
            user: user.id,
            group: group.id
          });

        if (error) throw error;

        // Add initial points for new member
        const { data: existingPoints } = await supabase
          .from('PointsHistory')
          .select('id')
          .eq('user', user.id)
          .eq('group', group.id)
          .limit(1);

        if (!existingPoints || existingPoints.length === 0) {
          await supabase
            .from('PointsHistory')
            .insert({
              user: user.id,
              group: group.id,
              amount: 200,
              timestamp: new Date().toISOString()
            });
        }

        // Refresh user groups and set current group
        await loadUserGroups(user.id);
        setCurrentGroupId(group.id);
        
        // Show success animation
        setShowSuccessAnimation(true);
        triggerConfetti();
        
        toast.success(`${t('Vous avez rejoint')} ${group.name} ${t('avec succès !')}`);
        
        setTimeout(() => {
          router.push('/');
        }, 1500);
      } else {
        // Private group - show application dialog
        setShowApplicationDialog(true);
      }
    } catch (error) {
      console.error('Error joining group:', error);
      toast.error(t('Erreur lors de la tentative de rejoindre la salle'));
    } finally {
      setJoining(false);
    }
  };

  const handleSubmitApplication = async () => {
    if (!user || !group || !applicationMessage.trim()) {
      return;
    }

    try {
      setSubmittingApplication(true);

      // Check if user already has a pending request
      const { data: existingRequest } = await supabase
        .from('RequestJoinGroup')
        .select('id')
        .eq('user', user.id)
        .eq('group', group.id);

      if (existingRequest && existingRequest.length > 0) {
        toast.error(t('Vous avez déjà une demande en attente pour cette salle'));
        setShowApplicationDialog(false);
        return;
      }

      // Submit join request
      const { error } = await supabase
        .from('RequestJoinGroup')
        .insert({
          user: user.id,
          group: group.id,
          message: applicationMessage.trim()
        });

      if (error) throw error;

      toast.success(t('Votre demande a été envoyée avec succès !'));
      setShowApplicationDialog(false);
      
      // Show subtle success animation
      triggerConfetti();
      
      // Redirect to home page
      setTimeout(() => {
        router.push('/');
      }, 800);
    } catch (error) {
      console.error('Error submitting application:', error);
      toast.error(t('Erreur lors de l\'envoi de la demande'));
    } finally {
      setSubmittingApplication(false);
    }
  };

  // Floating particles animation
  const particles = useMemo(() => 
    Array(15).fill(0).map((_, i) => ({
      id: i,
      size: Math.random() * 4 + 2,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 10 + 15,
      delay: Math.random() * 5
    })),
  []);

  const FloatingParticles = useCallback(() => {

    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full bg-white/10"
            style={{
              width: particle.size,
              height: particle.size,
              left: `${particle.x}%`,
              top: `${particle.y}%`,
            }}
            animate={{
              y: [-20, 20, -20],
              x: [-10, 10, -10],
              opacity: [0.3, 0.8, 0.3]
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    );
  }, [particles]);

  if (loading) {
    return (
      <motion.div 
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div 
          className="flex flex-col items-center gap-6 bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-white/20"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.6 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-12 w-12 text-primary" />
          </motion.div>
          <motion.p 
            className="text-muted-foreground font-medium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {t('Chargement de la salle...')}
          </motion.p>
        </motion.div>
      </motion.div>
    );
  }

  if (error || !group) {
    return (
      <motion.div 
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div 
          className="text-center space-y-6 max-w-md bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-white/20"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.6 }}
        >
          <motion.div 
            className="w-20 h-20 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center mx-auto shadow-lg"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
          >
            <Users className="h-10 w-10 text-red-500" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {error || 'Salle introuvable'}
            </h1>
            <p className="text-muted-foreground">
              {t('Cette salle n\'existe pas ou n\'est plus disponible.')}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Button 
              onClick={() => router.push('/')} 
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg"
              size="lg"
            >
              {t('Retour à l\'accueil')}
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    );
  }

  // Extract emoji from group name
  const extractEmoji = (text: string): string | undefined => {
    const emojiPattern = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u;
    return text.match(emojiPattern)?.[0];
  };

  const groupEmoji = extractEmoji(group.name);
  const groupDisplayName = groupEmoji ? group.name.replace(groupEmoji, '').trim() : group.name;

  return (
    <div>
      <AnimatePresence mode="wait">
      {!showSuccessAnimation ? (
        <motion.div 
          className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 relative overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5 }}
        >
          {/* Floating particles background */}
          <FloatingParticles />
          
          {/* Confetti canvas */}
          <canvas 
            ref={confettiCanvasRef}
            className="fixed inset-0 w-full h-full pointer-events-none z-10"
          />
          
          <motion.div 
            className="w-full max-w-md space-y-6 relative z-20"
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", duration: 0.7 }}
          >
            {/* Group Info Card */}
            <motion.div 
              className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl"
              whileHover={{ y: -5, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="text-center space-y-6">
                {/* Group Icon */}
                <motion.div 
                  className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center ring-4 ring-white/30 shadow-xl"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", delay: 0.2, duration: 0.8 }}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  {groupEmoji ? (
                    <span className="text-5xl sm:text-4xl">{groupEmoji}</span>
                  ) : (
                    <Users className="h-12 w-12 text-primary/70" />
                  )}
                </motion.div>

                {/* Group Details */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h1 className="text-3xl font-bold text-foreground mb-3 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    {groupDisplayName}
                  </h1>
                  {group.description && (
                    <p className="text-muted-foreground mb-4 text-lg">{group.description}</p>
                  )}
                  
                  {/* Group Status */}
                  
                  <motion.div 
                    className="flex items-center justify-center gap-2 text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Users className="h-4 w-4" />
                    <span className="font-medium">{group.memberCount} {t('membres')}</span>
                  </motion.div>
                </motion.div>

                {/* Join Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="space-y-3"
                >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      onClick={handleJoinGroup}
                      disabled={joining}
                      className={cn(
                        "w-full h-14 text-lg font-semibold rounded-2xl shadow-lg transition-all duration-300",
                        group.is_publicly_joinable 
                          ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white" 
                          : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                      )}
                    >
                      {joining ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="mr-3"
                          >
                            <Loader2 className="h-5 w-5" />
                          </motion.div>
                          {group.is_publicly_joinable ? t('Rejoindre...') : t('Vérification...')}
                        </>
                      ) : (
                        <motion.div 
                          className="flex items-center gap-3"
                          whileHover={{ x: 2 }}
                        >
                          {group.is_publicly_joinable ? (
                            <>
                              <Heart className="h-5 w-5" />
                              {t('Rejoindre la salle')}
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-5 w-5" />
                              {t('Demander à rejoindre')}
                            </>
                          )}
                        </motion.div>
                      )}
                    </Button>
                  </motion.div>

                  {/* Back to Home */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      onClick={() => router.push('/')}
                      variant="ghost"
                      className="w-full h-12 text-muted-foreground hover:text-foreground rounded-2xl hover:bg-white/50 dark:hover:bg-gray-700/50 transition-all duration-300"
                    >
                      {t('Retour à l\'accueil')}
                    </Button>
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : (
        /* Success Animation */
        <motion.div 
          className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 relative overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Confetti canvas */}
          <canvas 
            ref={confettiCanvasRef}
            className="fixed inset-0 w-full h-full pointer-events-none z-10"
          />
          
          <motion.div 
            className="text-center space-y-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-12 shadow-2xl border border-white/20"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.8 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2, duration: 0.6 }}
            >
              <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                <motion.div
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5, type: "spring" }}
                >
                  <CheckCircle2 className="h-12 w-12 text-white" />
                </motion.div>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                {t('Bienvenue !')}
              </h2>
              <p className="text-muted-foreground text-lg">
                {t('Vous rejoignez')} {group?.name}
              </p>
            </motion.div>
            
            <motion.div
              className="flex justify-center gap-2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
            >
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-green-400 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity }}
                />
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Application Dialog */}
      <Dialog open={showApplicationDialog} onOpenChange={setShowApplicationDialog}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-white/20">
          <motion.div 
            className="p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <DialogHeader className="mb-6">
              <DialogTitle className="flex items-center gap-3 text-center justify-center text-xl">
                <motion.div
                  initial={{ rotate: -10 }}
                  animate={{ rotate: 0 }}
                  transition={{ type: "spring" }}
                >
                  <Lock className="h-6 w-6 text-amber-500" />
                </motion.div>
                <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent font-bold">
                  {group?.name}
                </span>
              </DialogTitle>
            </DialogHeader>
            
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="rounded-xl overflow-hidden border border-white/20 shadow-lg focus-within:ring-2 focus-within:ring-amber-500/20 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
                <motion.textarea
                  className={cn(
                    "w-full min-h-[120px] bg-transparent p-4 text-sm outline-none resize-none placeholder:text-muted-foreground",
                    noZoomInputClass
                  )}
                  placeholder={t('Expliquez pourquoi vous souhaitez rejoindre cette salle...')}
                  value={applicationMessage}
                  onChange={(e) => setApplicationMessage(e.target.value)}
                  maxLength={99}
                  initial={{ opacity: 0.7 }}
                  whileFocus={{ opacity: 1 }}
                />
                <div className="px-4 py-2 text-xs text-muted-foreground bg-white/30 dark:bg-gray-700/30 text-right border-t border-white/20">
                  {applicationMessage.length}/99
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="flex gap-3 mt-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  onClick={() => setShowApplicationDialog(false)}
                  className="w-full h-12 rounded-xl border-white/20 hover:bg-white/50 dark:hover:bg-gray-700/50"
                  disabled={submittingApplication}
                >
                  {t('Annuler')}
                </Button>
              </motion.div>
              <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  disabled={submittingApplication || !applicationMessage.trim()}
                  onClick={handleSubmitApplication}
                  className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl shadow-lg"
                >
                  {submittingApplication ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="mr-2"
                      >
                        <Loader2 className="h-4 w-4" />
                      </motion.div>
                      {t('Envoi...')}
                    </>
                  ) : (
                    <motion.div 
                      className="flex items-center gap-2"
                      whileHover={{ x: 2 }}
                    >
                      <MessageSquare className="h-4 w-4" />
                      {t('Envoyer')}
                    </motion.div>
                  )}
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
