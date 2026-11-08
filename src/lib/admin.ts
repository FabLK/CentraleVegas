/**
 * UI-only admin gate (navbar link + /admin page).
 * Not a security boundary — enforce access in Supabase RLS / RPCs.
 */
export function getAdminUsernames(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_USERNAMES ?? 'admin'
  return raw
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminUsername(username: string | null | undefined): boolean {
  if (!username) return false
  return getAdminUsernames().includes(username.toLowerCase())
}
