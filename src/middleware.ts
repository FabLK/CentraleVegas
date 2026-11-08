import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'
import Negotiator from 'negotiator'
import { match } from '@formatjs/intl-localematcher'

const supportedLocales = ['en', 'fr']
const defaultLocale = 'en'

function getLocale(request: NextRequest): string {
  const negotiatorHeaders: Record<string, string> = {}
  request.headers.forEach((value, key) => (negotiatorHeaders[key] = value))

  const locales: string[] = supportedLocales
  const languages = new Negotiator({ headers: negotiatorHeaders }).languages(locales)
  
  try {
    return match(languages, locales, defaultLocale)
  } catch {
    // Fallback to default locale if matching fails (e.g. no supported language found)
    return defaultLocale
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if there is any supported locale in the pathname
  const pathnameIsMissingLocale = supportedLocales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  )

  // Redirect if there is no locale
  if (pathnameIsMissingLocale) {
    const locale = getLocale(request)

    // e.g. incoming request is /products
    // The new URL is now /en/products
    // Preserve query parameters during redirect
    const url = new URL(
      `/${locale}${pathname.startsWith('/') ? '' : '/'}${pathname}`,
      request.url
    )
    // Copy all search parameters from the original request
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value)
    })
    
    return NextResponse.redirect(url)
  }

  const res = await updateSession(request)

  // Create supabase client with cookies from request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set: () => {
          // This is handled by the implementation of updateSession
        },
        remove: () => {
          // This is handled by the implementation of updateSession
        },
      },
    }
  )

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Extract the path without locale for auth exemption checking
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/')
  
  // Define authentication exempt paths (don't require login)
  const isAuthExempt = [
    '/auth',
    '/auth/reset-password', 
    '/auth/update-password',
    '/auth/callback'
  ].includes(pathWithoutLocale)

  // Check if this is a betting game request (check without locale)
  const isBettingGame = pathWithoutLocale.match(/^\/bet\/([^\/]+)$/)
  
  // Handle authentication
  if (!user && !isAuthExempt) {
    // Redirect unauthenticated users to auth page, preserving locale
    const redirectUrl = request.nextUrl.clone()
    const locale = pathname.match(/^\/([a-z]{2})(\/|$)/)?.[1] || 'en'
    redirectUrl.pathname = `/${locale}/auth`
    
    // Store the original URL they were trying to access as a query parameter
    // This will be used to redirect them back after authentication
    redirectUrl.searchParams.set('redirect', pathname)
    
    return NextResponse.redirect(redirectUrl)
  }
  
  // Handle betting game authorization
  if (isBettingGame && user) {
    const id = isBettingGame[1]
    
    // Check if bet exists and get its group
    const { data: betData, error: betError } = await supabase
      .from('BettingGame')
      .select('id, group')
      .eq('id', id)
      .single()

    if (betError || !betData) {
      // Betting game not found, redirect to 404 page
      const notFoundUrl = request.nextUrl.clone()
      notFoundUrl.pathname = '/404'
      return NextResponse.redirect(notFoundUrl)
    }

    // Check if user is a member of the group
    const { data: membershipData, error: membershipError } = await supabase
      .from('UsersGroupMembership')
      .select('id')
      .eq('user', user.id)
      .eq('group', betData.group)
      .single()

    if (membershipError || !membershipData) {
      // User is not a member of the group, redirect to 404 page instead of restricted
      const notFoundUrl = request.nextUrl.clone()
      notFoundUrl.pathname = '/404'
      return NextResponse.redirect(notFoundUrl)
    }
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}