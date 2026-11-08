'use client'

import { useState } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRouter } from 'next/navigation'
import { resetPassword } from '../actions'
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { t } = useTranslation('auth')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    
    try {
      const result = await resetPassword(email)
      
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccessMessage(t('reset_email_sent'))
      }
    } catch {
      setError(t('reset_error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container max-w-md mx-auto py-16">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full py-6 px-5 sm:px-8 rounded-xl border border-muted/40 shadow-md bg-gradient-to-b from-background to-muted/20"
      >
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => router.push('/auth')}
        >
          <ArrowLeft size={16} className="mr-2" />
          {t('back')}
        </Button>

        {successMessage ? (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <Mail className="mx-auto h-12 w-12 text-green-500 mb-2" />
              <h2 className="text-xl font-semibold">{t('email_sent')}</h2>
              <p className="text-muted-foreground">{successMessage}</p>
            </div>
            <Button 
              className="w-full bg-gradient-to-r from-primary via-primary/90 to-primary/80"
              onClick={() => router.push('/auth')}
            >
              {t('back_to_login')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-semibold mb-4">{t('password_reset')}</h2>
            <p className="text-muted-foreground mb-4">
              {t('reset_instructions')}
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">{t('email')}</Label>
                <Input 
                  id="email"
                  name="email"
                  type="email" 
                  placeholder="m@example.com" 
                  required
                  className="border-input/50 shadow-sm focus-visible:ring-offset-1"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full flex items-center justify-center gap-2 mt-2 shadow-sm transition-all hover:shadow bg-gradient-to-r from-primary via-primary/90 to-primary/80"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={18} />
                    {t('sending')}
                  </>
                ) : (
                  t('reset_password')
                )}
              </Button>
            </div>
          </form>
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
              onClick={() => setError(null)}
            >
              {t('close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 