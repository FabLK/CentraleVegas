import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Handle Supabase auth callback
 * This route is used for email confirmations, password resets, etc.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')
  const redirect = requestUrl.searchParams.get('redirect')
  const next = requestUrl.searchParams.get('next') || redirect || '/'
  
  // Extract locale from the current pathname
  const pathname = requestUrl.pathname
  const locale = pathname.match(/^\/([a-z]{2})(\/|$)/)?.[1] || 'en'

  if (code) {
    const supabase = await createClient()
    
    // If we have a code but no type, first we need to exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(
        new URL(`/${locale}/auth?error=${encodeURIComponent(error.message)}`, request.url)
      )
    }
    
    // After exchanging the code, check if this was a password recovery
    // Get the session to check the auth context
    const { data: { session } } = await supabase.auth.getSession()
    
    // If there's a recovery token in the session, redirect to update-password
    if (session && type === 'recovery') {
      // Redirect to update password page with a hash that will be checked 
      // by the update-password page
      return NextResponse.redirect(
        new URL(`/${locale}/auth/update-password#type=recovery`, request.url)
      )
    }
  }
  
  // Special handling if type is recovery but we don't have a valid code yet
  if (type === 'recovery' && !code) {
    return NextResponse.redirect(new URL(`/${locale}/auth/reset-password`, request.url))
  }

  // URL to redirect to after sign in process completes
  // If we reach here, it means the code was exchanged for a session 
  // but it wasn't a recovery flow
  // Ensure the next URL includes locale if it's a relative path
  const nextUrl = next.startsWith('/') && !next.match(/^\/[a-z]{2}(\/|$)/)
    ? `/${locale}${next}`
    : next
  return NextResponse.redirect(new URL(nextUrl, request.url))
} 