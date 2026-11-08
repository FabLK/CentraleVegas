import type { SupabaseClient, AuthChangeEvent, Session } from '@supabase/supabase-js'

export async function getUser(supabase: SupabaseClient) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      console.error('Auth error:', error)
      return null
    }
    return user
  } catch (error) {
    console.error('Get user error:', error)
    return null
  }
}

export async function isAuthenticated(supabase: SupabaseClient) {
  const user = await getUser(supabase)
  return !!user
}

export function onAuthStateChange(
  supabase: SupabaseClient,
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback)
}
