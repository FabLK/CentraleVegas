'use client'

import { useState, useEffect, Suspense } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ArrowLeft, LogIn, Loader2, Coins, Users, Trophy, Gamepad2, TrendingUp, Zap, Star, ArrowRight, Baby, Award, Heart, ChevronDown } from 'lucide-react'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { login, signup } from './actions'
import { useSupabase } from '@/lib/supabase/context'
import { cn } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from "framer-motion"
import { useTranslation } from "react-i18next"
import { DemoBetGame } from "@/components/DemoBetGame"

// Create a client component containing the original logic
function AuthPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [step, setStep] = useState<'choose' | 'form'>('choose')
  const [showDialog, setShowDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'checking' | 'available' | 'taken' | null>(null)
  const [username, setUsername] = useState('')
  const [formValidation, setFormValidation] = useState({
    isUsernameValid: true
  })
  const [authAttemptCompleted, setAuthAttemptCompleted] = useState(false)
  const supabase = useSupabase()
  const { t } = useTranslation('auth')

  // Check for authentication code in URL and redirect to callback
  useEffect(() => {
    const code = searchParams?.get('code')
    const type = searchParams?.get('type')
    
    if (code) {
      console.log('Auth code detected, redirecting to callback')
      // Check if this is likely a password reset link (no type parameter)
      if (!type) {
        router.push(`/auth/callback?code=${code}&type=recovery`)
      } else {
        router.push(`/auth/callback?code=${code}${type ? `&type=${type}` : ''}`)
      }
    }
    
    // Check for error parameter from callback
    const errorMsg = searchParams?.get('error')
    if (errorMsg) {
      setError(decodeURIComponent(errorMsg))
    }
  }, [searchParams, router])

  // Check if user is already authenticated when the component mounts
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      console.log('Auth page - session check:', { session, error })
      
      if (session?.user) {
        console.log('User already authenticated, redirecting')
        // Check for redirect parameter to send user back to original URL
        const redirectUrl = searchParams?.get('redirect')
        if (redirectUrl) {
          console.log('Redirecting to original URL:', redirectUrl)
          router.replace(redirectUrl)
        } else {
          router.replace('/')
        }
      }
    }
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session)
      
      if (session) {
        console.log('New session detected, redirecting')
        // Check for redirect parameter to send user back to original URL
        const redirectUrl = searchParams?.get('redirect')
        if (redirectUrl) {
          console.log('Redirecting to original URL:', redirectUrl)
          router.replace(redirectUrl)
        } else {
          router.replace('/')
        }
      }
    })
    
    checkAuth()

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router, searchParams])

  // Remove the separate auth state change effect since we've merged it above
  useEffect(() => {
    if (!authAttemptCompleted) return
    
    // Reset auth attempt flag
    setAuthAttemptCompleted(false)
    
  }, [authAttemptCompleted])

  useEffect(() => {
    if (!username || mode !== 'signup') {
      setUsernameStatus(null)
      return
    }

    let isMounted = true
    const timeoutId = setTimeout(async () => {
      if (isMounted) setUsernameStatus('checking')
      
      // Trim the username for the availability check
      const trimmedUsername = username.trim()
      console.log('Checking username:', trimmedUsername)
      
      try {
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        );
        
        const queryPromise = supabase
          .from('Users')
          .select("username")
          .eq('username', trimmedUsername)
          .limit(1);
          
        // Race between actual query and timeout
        const { data: existingUsers, error } = await Promise.race([
          queryPromise,
          timeoutPromise.then(() => { throw new Error('Request timeout'); })
        ]);

        if (!isMounted) return;

        if (error) {
          console.error('Supabase error:', error)
          setUsernameStatus(null)
          return
        }

        console.log('Query result:', existingUsers)
        setUsernameStatus(existingUsers && existingUsers.length > 0 ? 'taken' : 'available')
      } catch (err) {
        console.error('Username check failed:', err)
        if (isMounted) {
          // Reset status if there's an error to allow retrying
          setUsernameStatus(null)
        }
      }
    }, 500)

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [username, mode, supabase])

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // Add username validation
    if (mode === 'signup') {
      const trimmedUsername = username.trim()
      
      if (trimmedUsername.length > 25) {
        setFormValidation({ isUsernameValid: false });
        return;
      }
      
      const usernameInput = e.currentTarget.querySelector('#username') as HTMLInputElement;
      if (usernameInput) {
        usernameInput.value = trimmedUsername;
      }
    }
    
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    
    try {
      const result = mode === 'login' 
        ? await login(formData)
        : await signup(formData)
      
      if (result?.error) {
        setError(result.error)
        setIsLoading(false)
      } else {
        // Signal that auth attempt was successful
        setAuthAttemptCompleted(true)
        
        // Check for redirect parameter to send user back to original URL
        const redirectUrl = searchParams?.get('redirect')
        if (redirectUrl) {
          console.log('Redirecting to original URL after auth:', redirectUrl)
          // Force a hard navigation to ensure proper state reset
          window.location.href = redirectUrl
        } else {
          // Force a hard navigation to ensure proper state reset
          window.location.href = '/'
        }
      }
    } catch {
      setError(t('error_occurred'))
      setIsLoading(false)
    }
  }

  if (step === 'choose') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-x-hidden">
        {/* Floating Bet Cards Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(9)].map((_, i) => (
            <motion.div
              key={`floating-card-${i}`}
              className={`absolute w-48 sm:w-64 rounded-lg p-3 sm:p-4 shadow-lg ${
                i === 0 ? 'bg-blue-100/90 border border-blue-200' :
                i === 1 ? 'bg-green-100/90 border border-green-200' :
                i === 2 ? 'bg-purple-100/90 border border-purple-200' :
                i === 3 ? 'bg-amber-100/90 border border-amber-200' :
                i === 4 ? 'bg-pink-100/90 border border-pink-200' :
                i === 5 ? 'bg-rose-100/90 border border-rose-200' :
                i === 6 ? 'bg-indigo-100/90 border border-indigo-200' :
                i === 7 ? 'bg-teal-100/90 border border-teal-200' :
                'bg-orange-100/90 border border-orange-200'
              } ${
                // Mobile positioning: bottom 40% of screen
                i === 0 ? 'top-[60%] sm:top-[20%]' :
                i === 1 ? 'top-[65%] sm:top-[15%]' :
                i === 2 ? 'top-[75%] sm:top-[65%]' :
                i === 3 ? 'top-[77%] sm:top-[70%]' :
                i === 4 ? 'top-[90%] sm:top-[85%]' :
                i === 5 ? 'top-[55%] sm:top-[40%]' :
                i === 6 ? 'top-[80%] sm:top-[55%]' :
                i === 7 ? 'top-[85%] sm:top-[75%]' :
                'top-[70%] sm:top-[45%]'
              } ${
                // Mobile left positioning: bring right column cards more to the left
                i === 0 ? 'left-[10%]' :
                i === 1 ? 'left-[45%] sm:left-[80%]' :
                i === 2 ? 'left-[5%]' :
                i === 3 ? 'left-[50%] sm:left-[85%]' :
                i === 4 ? 'left-[15%]' :
                i === 5 ? 'left-[60%] sm:left-[25%]' :
                i === 6 ? 'left-[70%] sm:left-[60%]' :
                i === 7 ? 'left-[30%] sm:left-[40%]' :
                'left-[75%] sm:left-[90%]'
              } ${
                // Hide half of the cards on mobile (cards 4-8)
                i >= 4 ? 'hidden sm:block' : ''
              }`}
              initial={{ opacity: 0, y: 20, rotate: (i % 2 === 0) ? -5 : 5 }}
              animate={{
                opacity: [0, 0.8, 0.6],
                y: [20, 0, -5],
                rotate: (i % 2 === 0) ? [-5, 2, -2] : [5, -2, 2]
              }}
              transition={{
                duration: 3,
                delay: i * 0.2,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut"
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {i === 0 && <TrendingUp className="h-4 w-4 text-blue-500" />}
                {i === 1 && <Users className="h-4 w-4 text-green-500" />}
                {i === 2 && <Trophy className="h-4 w-4 text-purple-500" />}
                {i === 3 && <Star className="h-4 w-4 text-amber-500" />}
                {i === 4 && <Gamepad2 className="h-4 w-4 text-pink-500" />}
                {i === 5 && <Baby className="h-4 w-4 text-rose-500" />}
                {i === 6 && <Award className="h-4 w-4 text-indigo-500" />}
                {i === 7 && <Trophy className="h-4 w-4 text-teal-500" />}
                {i === 8 && <Heart className="h-4 w-4 text-orange-500" />}

                <div className={`text-xs font-medium ${
                  i === 0 ? 'text-blue-700' :
                  i === 1 ? 'text-green-700' :
                  i === 2 ? 'text-purple-700' :
                  i === 3 ? 'text-amber-700' :
                  i === 4 ? 'text-pink-700' :
                  i === 5 ? 'text-rose-700' :
                  i === 6 ? 'text-indigo-700' :
                  i === 7 ? 'text-teal-700' :
                  'text-orange-700'
                }`}>
                  {i === 0 ? t('floating_card_1') :
                   i === 1 ? t('floating_card_2') :
                   i === 2 ? t('floating_card_3') :
                   i === 3 ? t('floating_card_4') :
                   i === 4 ? t('floating_card_5') :
                   i === 5 ? t('floating_card_6') :
                   i === 6 ? t('floating_card_7') :
                   i === 7 ? t('floating_card_8') :
                   t('floating_card_9')}
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full ${
                    i === 0 ? 'bg-blue-500' :
                    i === 1 ? 'bg-green-500' :
                    i === 2 ? 'bg-purple-500' :
                    i === 3 ? 'bg-amber-500' :
                    i === 4 ? 'bg-pink-500' :
                    i === 5 ? 'bg-rose-500' :
                    i === 6 ? 'bg-indigo-500' :
                    i === 7 ? 'bg-teal-500' :
                    'bg-orange-500'
                  }`}
                  style={{ width: `${Math.random() * 40 + 30}%` }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Content */}
        <div className="relative z-10 container max-w-4xl mx-auto px-4 py-8 sm:py-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8 sm:mb-12"
          >
            {/* Hero Title */}
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-4xl sm:text-6xl font-bold leading-none pb-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-800 bg-clip-text text-transparent mb-4 transform translate-y-[-0.1em]"
            >
              {t('hero_title')}
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-8"
            >
              {t('hero_subtitle')}
            </motion.p>

            {/* Feature Pills - Hidden on mobile */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="hidden sm:flex flex-wrap justify-center gap-3 mb-8 sm:mb-12"
            >
              {[
                { icon: <Coins className="h-4 w-4" />, text: t('points_offered'), color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
                { icon: <Users className="h-4 w-4" />, text: t('private_groups'), color: "bg-blue-100 text-blue-700 border-blue-200" },
                { icon: <Zap className="h-4 w-4" />, text: t('no_real_money'), color: "bg-green-100 text-green-700 border-green-200" }
              ].map((pill, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full border ${pill.color} text-sm font-medium`}
                >
                  {pill.icon}
                  {pill.text}
                </motion.div>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.0 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto"
            >
              <Button 
                size="lg"
                className="w-full sm:w-auto px-8 py-4 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                onClick={() => {
                  setMode('signup')
                  setStep('form')
                }}
              >
                <Coins className="h-5 w-5 mr-2" />
                {t('signup_button_text')}

              </Button>
              
              <Button 
                size="lg"
                variant="outline"
                className="w-full sm:w-auto px-8 py-4 text-lg font-semibold border-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300"
                onClick={() => {
                  setMode('login')
                  setStep('form')
                }}
              >
                <LogIn className="h-5 w-5 mr-2" />
                {t('connexion')}
              </Button>
            </motion.div>

            {/* Scroll Indicator */}
            <div className="flex justify-center w-full mt-24 sm:mt-32">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  delay: 2, 
                  duration: 1,
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
                className="flex flex-col items-center gap-2 cursor-pointer pointer-events-auto"
                onClick={() => {
                  document.getElementById('demo-game-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <span className="text-sm text-gray-500/80 font-medium whitespace-nowrap">
                  {t('try_demo', 'Essayer la démo')}
                </span>
                <ChevronDown className="h-6 w-6 text-gray-500/80 animate-bounce" />
              </motion.div>
            </div>

          </motion.div>
        </div>

        {/* Demo Game */}
        <div id="demo-game-section" className="relative z-10 container max-w-7xl mx-auto px-4 pb-16 pt-48 sm:pt-64">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }} // Reduced delay as we scroll to it
          >
            <DemoBetGame />
          </motion.div>
        </div>

        {/* Floating Coins Animation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={`coin-${i}`}
              className="absolute text-yellow-500/30"
              initial={{ 
                left: `${Math.random() * 100}%`,
                top: `${100 + Math.random() * 20}%`,
                rotate: 0,
                scale: Math.random() * 0.5 + 0.5
              }}
              animate={{ 
                top: `-${Math.random() * 20 + 10}%`,
                rotate: 360
              }}
              transition={{ 
                duration: Math.random() * 10 + 10,
                delay: Math.random() * 5,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <Coins className="w-4 h-4" />
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-md mx-auto py-16">
      <AnimatePresence mode="wait">
        <motion.div 
          key="auth-form"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full py-6 px-5 sm:px-8 rounded-xl border border-muted/40 shadow-md bg-gradient-to-b from-background to-muted/20"
        >
          <Button
            variant="ghost"
            size="sm"
            className="mb-6 hover:bg-indigo-50 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setStep('choose')}
          >
            <ArrowLeft size={16} className="mr-2" />
            {t('back')}
          </Button>

          {/* Form Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              {mode === 'login' ? t('welcome_back') : t('join_us')}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              {mode === 'login' ? t('login_subtitle') : t('signup_subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">{t('email')}</Label>
                <Input 
                  id="email"
                  name="email"
                  type="email" 
                  placeholder={t('email_placeholder')} 
                  required
                  className="border-gray-200/50 bg-white/50 dark:bg-gray-800/50 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium">{t('username_label')}</Label>
                  <div className="relative">
                    <Input 
                      id="username"
                      name="username"
                      type="text" 
                      placeholder={t('username_placeholder')}
                      value={username}
                      onChange={(e) => setUsername(e.target.value.trim())}
                      required
                      className={cn(
                        "border-gray-200/50 bg-white/50 dark:bg-gray-800/50 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all",
                        username.length > 25 ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' :
                        usernameStatus === 'available' ? 'border-green-500/50 focus:ring-green-500/20 focus:border-green-500 bg-green-50/30' :
                        usernameStatus === 'taken' ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500 bg-red-50/30' : '',
                        !formValidation.isUsernameValid ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500 bg-red-50/30' : ''
                      )}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <span className={`text-xs ${
                        username.length > 25 ? "text-red-500 font-medium" : "text-muted-foreground"
                      }`}>
                        {username.length}/25
                      </span>
                      {usernameStatus && username.length <= 25 && (
                        <>
                          {usernameStatus === 'checking' && (
                            <Loader2 className="animate-spin" size={18} />
                          )}
                          {usernameStatus === 'available' && (
                            <span className="text-green-500 text-sm">{t('available')}</span>
                          )}
                          {usernameStatus === 'taken' && (
                            <span className="text-red-500 text-sm">{t('taken')}</span>
                          )}
                        </>
                      )}
                      {username.length > 25 && (
                        <span className="text-red-500 text-sm">{t('too_long')}</span>
                      )}
                    </div>
                  </div>
                  {!formValidation.isUsernameValid && (
                    <p className="text-sm text-red-500">{t('username_too_long')}</p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">{t('password')}</Label>
                  {mode === 'login' && (
                    <Button 
                      variant="link" 
                      type="button"
                      className="text-xs h-auto p-0"
                      onClick={(e) => {
                        e.preventDefault();
                        router.push('/auth/reset-password');
                      }}
                    >
                      {t('forgot_password')}
                    </Button>
                  )}
                </div>
                <Input 
                  id="password"
                  name="password"
                  type="password" 
                  placeholder={t('password')}
                  required
                  className="border-gray-200/50 bg-white/50 dark:bg-gray-800/50 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <Button 
                type="submit" 
                size="lg"
                className={cn(
                  "w-full flex items-center justify-center gap-2 mt-6 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]",
                  !isLoading && "bg-blue-600 hover:bg-blue-700 text-white"
                )}
                disabled={isLoading || (mode === 'signup' && usernameStatus !== 'available')}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={20} />
                    {t('loading')}
                  </>
                ) : mode === 'login' ? (
                  <>
                    <LogIn size={20} />
                    {t('enter_casino')}
                  </>
                ) : (
                  <>
                    {t('sign_up')}
                    <ArrowRight size={20} />
                  </>
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
      <Dialog open={showDialog} onOpenChange={setShowDialog} >
        <DialogContent className="sm:max-w-md" fullScreenOnMobile={false}>
          <DialogHeader>
            <DialogTitle className="text-center">
              {t('uncheck_terms')}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex justify-center">
            <Button onClick={() => {
              setShowDialog(false)
              //setTermsChecked(false)
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300">
              {t('no_slowdown')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!error} onOpenChange={() => setError(null)}>
        <DialogContent className="sm:max-w-md" fullScreenOnMobile={false}>
          <DialogHeader>
            <DialogTitle className="text-center text-destructive">
              {t('error')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-destructive">{error}</p>
          <div className="mt-4 flex justify-center">
            <Button 
              variant="destructive" 
              onClick={() => setError(null)}
              className="shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {t('close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Default export now wraps the client component in Suspense
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <AuthPageClient />
    </Suspense>
  )
}