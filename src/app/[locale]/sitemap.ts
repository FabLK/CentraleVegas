import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()
  
  // Get all bets for dynamic routes
  const { data: bets } = await supabase
    .from('BettingGame')
    .select('id')
  
  // Get all users for profile pages
  const { data: users } = await supabase
    .from('Users')
    .select('username')
  
  // Static routes
  const routes = [
    {
      url: 'https://centralevegas.com',
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: 'https://centralevegas.com/leaderboard',
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    },
    // Add other static routes
  ]
  
  // Add dynamic bet routes
  const betRoutes = bets?.map(bet => ({
    url: `https://centralevegas.com/bet/${bet.id}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  })) || []
  
  // Add user profile routes
  const userRoutes = users?.map(user => ({
    url: `https://centralevegas.com/profile/${user.username}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  })) || []
  
  return [...routes, ...betRoutes, ...userRoutes]
} 