'use client'

import { useState, useEffect } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { CheckCircle, Loader2, XCircle } from 'lucide-react'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/lib/supabase/context'
import { updateUserPassword } from '../actions'
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = useSupabase()
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const { t } = useTranslation('auth')

  // Verify the user is authenticated via the recovery flow
  useEffect(() => {
    const checkAuthAndType = async () => {
      setIsVerifying(true)
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          throw new Error(sessionError.message)
        }
        
        if (!session) {
          // If no session, check if we have a hash with #access_token which may indicate
          // a pending auth state that needs to be processed
          const hash = window.location.hash
          if (hash && (hash.includes('access_token') || hash.includes('type=recovery'))) {
            console.log('Found auth hash, waiting for session...')
            // Wait a bit for Supabase to process the session
            setTimeout(checkAuthAndType, 1000)
            return
          }
          
          router.push('/auth')
          return
        }

        // If we're here, we have a session - check if URL has type=recovery in hash
        const hash = window.location.hash
        if (!hash.includes('type=recovery')) {
          // We have a session but it doesn't seem to be from a recovery flow
          // Let's add the hash to make the flow work
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', `${window.location.pathname}#type=recovery`)
          } else {
            // Set verification to false to continue
            setIsVerifying(false)
          }
        } else {
          setIsVerifying(false)
        }
      } catch (err) {
        console.error('Verification error:', err)
        setError(typeof err === 'object' && err !== null && 'message' in err 
          ? (err as Error).message 
          : 'Failed to verify recovery link')
        setIsVerifying(false)
      }
    }

    checkAuthAndType()
  }, [supabase, router])

  const validatePasswords = (): boolean => {
    if (password.length < 8) {
      setPasswordError(t('password_min_length'))
      return false
    }
    
    if (password !== confirmPassword) {
      setPasswordError(t('passwords_no_match'))
      return false
    }
    
    setPasswordError(null)
    return true
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!validatePasswords()) {
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await updateUserPassword(password)
      
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    } catch {
      setError(t('update_password_error'))
    } finally {
      setIsLoading(false)
    }
  }

  if (isVerifying) {
    return (
      <div className="container max-w-md mx-auto py-16 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-2">{t('verifying_link')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-md mx-auto py-16">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full py-6 px-5 sm:px-8 rounded-xl border border-muted/40 shadow-md bg-gradient-to-b from-background to-muted/20"
      >
        {success ? (
          <div className="space-y-4 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="text-xl font-semibold">{t('password_updated')}</h2>
            <p className="text-muted-foreground">
              {t('password_updated_success')}
            </p>
            <Button 
              className="w-full bg-gradient-to-r from-primary via-primary/90 to-primary/80"
              onClick={() => router.push('/')}
            >
              {t('continue_to_app')}
            </Button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-4">{t('set_new_password')}</h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">{t('new_password')}</Label>
                  <Input 
                    id="password"
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="border-input/50 shadow-sm focus-visible:ring-offset-1"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">{t('confirm_password')}</Label>
                  <Input 
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="border-input/50 shadow-sm focus-visible:ring-offset-1"
                  />
                </div>
                
                {passwordError && (
                  <div className="text-sm text-red-500 flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    {passwordError}
                  </div>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full flex items-center justify-center gap-2 mt-2 shadow-sm transition-all hover:shadow bg-gradient-to-r from-primary via-primary/90 to-primary/80"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={18} />
                      {t('updating')}
                    </>
                  ) : (
                    t('update_password')
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </motion.div>

      <Dialog open={!!error} onOpenChange={() => setError(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-destructive">
              {t('error')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-destructive">{error}</p>
          <div className="mt-4 flex justify-center">
            <Button 
              variant="destructive" 
              onClick={() => {
                setError(null)
                if (error?.includes('Invalid') || error?.includes('expired')) {
                  router.push('/auth/reset-password')
                }
              }}
            >
              {t('close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 