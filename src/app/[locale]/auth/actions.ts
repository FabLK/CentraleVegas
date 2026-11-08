'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  try {
    const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    }

    const { error } = await supabase.auth.signInWithPassword(data)

    if (error) {
      console.error('Login error:', error)
      return { error: error.message }
    }

    // Ensure the session is properly established
    const { data: sessionData } = await supabase.auth.getSession()
    
    if (!sessionData.session) {
      console.error('Session not established after login')
      return { error: 'Session not established' }
    }

    revalidatePath('/')
    return { success: true }
  } catch (err) {
    console.error('Unexpected error during login:', err)
    return { error: 'Une erreur inattendue est survenue' }
  }
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  try {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const username = formData.get('username') as string

    // Create auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://centralevegas.com'}/callback`,
      },
    })

    if (signUpError) {
      console.error('SignUp error:', signUpError)
      return { error: signUpError.message }
    }

    if (!authData.user) {
      return { error: "Échec de création de l'utilisateur" }
    }

    // Create user record in Users table
    const { error: createUserError } = await supabase
      .from('Users')
      .insert([
        {
          id: authData.user.id,
          username: username,
          has_seen_onboarding: false,
        }
      ])

    if (createUserError) {
      console.error('Supabase error:', createUserError)
      return { 
        error: `Erreur lors de la création du profil: ${createUserError.message}`,
        details: createUserError
      }
    }

    return { success: true }
  } catch (err) {
    console.error('Unexpected error during signup:', err)
    return { error: 'Une erreur inattendue est survenue' }
  }
}

/**
 * Send a password reset link to the specified email
 */
export async function resetPassword(email: string) {
  const supabase = await createClient()

  try {
    // Always use the production URL for password reset links
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://centralevegas.com'
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Redirect to the callback route which will handle the recovery code
      redirectTo: `${baseUrl}/auth/callback?type=recovery`,
    })

    if (error) {
      console.error('Password reset error:', error)
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Unexpected error during password reset:', err)
    return { error: 'Une erreur inattendue est survenue' }
  }
}

/**
 * Update the user's password after they've clicked on the reset link
 */
export async function updateUserPassword(password: string) {
  const supabase = await createClient()

  try {
    const { error } = await supabase.auth.updateUser({
      password: password,
    })

    if (error) {
      console.error('Password update error:', error)
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Unexpected error during password update:', err)
    return { error: 'Une erreur inattendue est survenue' }
  }
}