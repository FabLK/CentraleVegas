'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/lib/supabase/context'
import { useUser } from '@/lib/user/context'
import { isAdminUsername } from '@/lib/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, Users, Trophy, TrendingUp, Database, UserCheck, Eye, BarChart3, Crown, Shield, Target, Activity, Gamepad2, Star, RefreshCw, Calendar, Award, Flame, ChartLine, LucideIcon } from 'lucide-react'
import { toast } from 'sonner'

// Enhanced types for analytics
interface UserAnalytics {
  totalUsers: number
  usersWithZeroBalance: number
  usersWithoutBets: number
  usersWithoutGroups: number
  usersWithoutOnboarding: number
  groupsPerUserDistribution: { [key: number]: number }
  pointsPerUserDistribution: { [key: string]: number }
  dailyActiveUsers: number
  monthlyActiveUsers: number
  userActivityLast30Days: { date: string; value: number }[]
}

interface GroupAnalytics {
  totalGroups: number
  groupMemberActivity: { groupId: number; groupName: string; activity: { date: string; activeMembers: number }[] }[]
  gameCreationPatterns: { date: string; count: number }[]
  groupComparisons: {
    groupId: number
    groupName: string
    memberCount: number
    creatorPercentage: number
    refereePercentage: number
    avgBetsPerGame: number
    completionRate: number
  }[]
  topPlayersPerGroup: {
    groupId: number
    groupName: string
    avgTopPlayerPoints: number
    topPlayerCount: number
  }[]
}

interface BettingAnalytics {
  totalBets: number
  totalBettingGames: number
  activeBettingGames: number
  totalPointsCirculating: number
  averagePointsPerUser: number
  avgBetsPerGame: number
  completionRate: number
  topReferees: Array<{ username: string; count: number }>
  topCreators: Array<{ username: string; count: number }>
  mostActiveGroup: { name: string; activity: number }
  pointsEvolutionData: { date: string; totalPoints: number }[]
}

interface UserData {
  id: string
  username: string
  is_banned: boolean
  bio: string | null
  has_seen_onboarding: boolean
  total_points?: number
  active_bets?: number
  groups?: Array<{ group_id: number; group_name: string; points: number }>
  last_activity?: string
}

// Visual Chart Components
const MetricCard = ({ title, value, subtitle, icon: Icon, trend, color = 'blue' }: {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: number
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange'
}) => {
  const colorClasses = {
    blue: 'from-blue-50 to-blue-100 border-blue-200 text-blue-600',
    green: 'from-green-50 to-green-100 border-green-200 text-green-600',
    red: 'from-red-50 to-red-100 border-red-200 text-red-600',
    yellow: 'from-yellow-50 to-yellow-100 border-yellow-200 text-yellow-600',
    purple: 'from-purple-50 to-purple-100 border-purple-200 text-purple-600',
    orange: 'from-orange-50 to-orange-100 border-orange-200 text-orange-600'
  }

  return (
    <Card className={`bg-gradient-to-br ${colorClasses[color]} border-2 relative overflow-hidden`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {trend !== undefined && (
                <span className={`text-xs flex items-center gap-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <TrendingUp className={`h-3 w-3 ${trend < 0 ? 'rotate-180' : ''}`} />
                  {Math.abs(trend)}%
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs opacity-70 mt-1">{subtitle}</p>}
          </div>
          <Icon className="h-8 w-8 opacity-80" />
        </div>
      </CardContent>
    </Card>
  )
}

const DistributionChart = ({ title, data, color = 'blue' }: {
  title: string
  data: { label: string; value: number }[]
  color?: string
}) => {
  const maxValue = Math.max(...data.map(d => d.value))
  
  // Define proper color classes
  const colorStyles = {
    blue: { bg: 'bg-blue-500', bgLight: 'bg-blue-200' },
    green: { bg: 'bg-green-500', bgLight: 'bg-green-200' },
    purple: { bg: 'bg-purple-500', bgLight: 'bg-purple-200' },
    orange: { bg: 'bg-orange-500', bgLight: 'bg-orange-200' },
    red: { bg: 'bg-red-500', bgLight: 'bg-red-200' },
    yellow: { bg: 'bg-yellow-500', bgLight: 'bg-yellow-200' }
  }
  
  const colorClass = colorStyles[color as keyof typeof colorStyles] || colorStyles.blue
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-16 text-sm font-medium">{item.label}</div>
              <div className={`flex-1 ${colorClass.bgLight} rounded-full h-4 relative overflow-hidden`}>
                <div 
                  className={`h-full ${colorClass.bg} rounded-full transition-all duration-500`}
                  style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                  {item.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const ActivityHeatmap = ({ title, data }: {
  title: string
  data: { date: string; value: number }[]
}) => {
  const maxValue = Math.max(...data.map(d => d.value))
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {data.slice(-35).map((day, index) => {
            const intensity = maxValue > 0 ? (day.value / maxValue) : 0
            let bgColorClass = 'bg-gray-100'
            
            if (intensity > 0) {
              if (intensity <= 0.25) bgColorClass = 'bg-green-200'
              else if (intensity <= 0.5) bgColorClass = 'bg-green-300'
              else if (intensity <= 0.75) bgColorClass = 'bg-green-400'
              else bgColorClass = 'bg-green-500'
            }
            
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-sm ${bgColorClass} border border-gray-200 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all`}
                title={`${day.date}: ${day.value} active users`}
              />
            )
          })}
        </div>
        <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-gray-100" />
            <div className="w-3 h-3 rounded-sm bg-green-200" />
            <div className="w-3 h-3 rounded-sm bg-green-300" />
            <div className="w-3 h-3 rounded-sm bg-green-400" />
            <div className="w-3 h-3 rounded-sm bg-green-500" />
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  )
}

const PointsEvolutionChart = ({ data, timePeriod, onTimePeriodChange }: {
  data: { date: string; totalPoints: number }[]
  timePeriod: string
  onTimePeriodChange: (period: string) => void
}) => {
  // Filter data based on time period
  const now = new Date()
  const filteredData = data.filter(item => {
    const itemDate = new Date(item.date)
    const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24)
    
    switch (timePeriod) {
      case '7d': return diffDays <= 7
      case '30d': return diffDays <= 30
      case '90d': return diffDays <= 90
      case 'all': return true
      default: return diffDays <= 30
    }
  })

  const maxPoints = Math.max(...filteredData.map(d => d.totalPoints))
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Points Evolution
          </CardTitle>
          <Select value={timePeriod} onValueChange={onTimePeriodChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-end gap-1">
          {filteredData.slice(-50).map((day, index) => {
            const height = maxPoints > 0 ? (day.totalPoints / maxPoints) * 100 : 0
            return (
              <div
                key={index}
                className="flex-1 bg-blue-500 rounded-t min-h-[4px] cursor-pointer hover:bg-blue-600 transition-colors"
                style={{ height: `${height}%` }}
                title={`${day.date}: ${day.totalPoints.toLocaleString()} total points`}
              />
            )
          })}
        </div>
        <div className="mt-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {filteredData.length > 0 ? filteredData[filteredData.length - 1].totalPoints.toLocaleString() : '0'}
          </div>
          <div className="text-sm text-gray-500">Current Total Points</div>
        </div>
      </CardContent>
    </Card>
  )
}

const TopPlayersGroupSummary = ({ groupData }: {
  groupData: {
    groupId: number
    groupName: string
    avgTopPlayerPoints: number
    topPlayerCount: number
  }[]
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg flex items-center gap-2">
        <Crown className="h-5 w-5 text-yellow-500" />
        Top Players Summary by Group
      </CardTitle>
    </CardHeader>
    <CardContent>
      <ScrollArea className="h-96">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group</TableHead>
              <TableHead>Top Players</TableHead>
              <TableHead>Avg Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupData.map((group) => (
              <TableRow key={group.groupId}>
                <TableCell className="font-medium">{group.groupName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-blue-600">
                    {group.topPlayerCount} players
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-yellow-600">
                    {Math.round(group.avgTopPlayerPoints)} pts
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </CardContent>
  </Card>
)

export default function AdminPage() {
  const supabase = useSupabase()
  const { user } = useUser()
  
  // State management
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null)
  const [groupAnalytics, setGroupAnalytics] = useState<GroupAnalytics | null>(null)
  const [bettingAnalytics, setBettingAnalytics] = useState<BettingAnalytics | null>(null)
  const [selectedTab, setSelectedTab] = useState('overview')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [pointsTimePeriod, setPointsTimePeriod] = useState('30d')

  // Authorization check
  useEffect(() => {
    const checkAuthorization = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }

      if (isAdminUsername(user.username)) {
        setIsAuthorized(true)
      }
      
      setIsLoading(false)
    }

    checkAuthorization()
  }, [user])

  // Fetch analytics data
  useEffect(() => {
    if (!isAuthorized) return

    const fetchAnalytics = async () => {
      try {
        // Fetch all data in parallel
        const [
          usersResult,
          groupsResult,
          membershipsResult,
          betsResult,
          bettingGamesResult,
          pointsHistoryResult
        ] = await Promise.all([
          supabase.from('Users').select('*'),
          supabase.from('Group').select('*'),
          supabase.from('UsersGroupMembership').select('*'),
          supabase.from('Bets').select('*'),
          supabase.from('BettingGame').select('*'),
          supabase.from('PointsHistory').select('*')
        ])

        if (usersResult.error) throw usersResult.error
        if (groupsResult.error) throw groupsResult.error
        if (membershipsResult.error) throw membershipsResult.error
        if (betsResult.error) throw betsResult.error
        if (bettingGamesResult.error) throw bettingGamesResult.error
        if (pointsHistoryResult.error) throw pointsHistoryResult.error

        const usersData = usersResult.data || []
        const groupsData = groupsResult.data || []
        const membershipsData = membershipsResult.data || []
        const betsData = betsResult.data || []
        const bettingGamesData = bettingGamesResult.data || []
        const pointsHistoryData = pointsHistoryResult.data || []

        // Calculate user analytics
        await calculateUserAnalytics(usersData, membershipsData, betsData, pointsHistoryData)
        
        // Calculate group analytics
        await calculateGroupAnalytics(groupsData, membershipsData, betsData, bettingGamesData, usersData, pointsHistoryData)
        
        // Calculate betting analytics
        await calculateBettingAnalytics(betsData, bettingGamesData, usersData, groupsData, pointsHistoryData)

      } catch (error) {
        console.error('Error fetching analytics:', error)
        toast.error('Erreur lors du chargement des analyses')
      }
    }

    fetchAnalytics()
  }, [isAuthorized, supabase, refreshTrigger])

  const calculateUserAnalytics = async (usersData: UserData[], membershipsData: { user: string; group: number }[], betsData: { user: string; created_at: string; game: string }[], pointsHistoryData: { user: string; group: number; amount: number; timestamp: string }[]) => {
    // Calculate points per group for each user
    const userGroupPoints = new Map<string, Map<number, number>>()
    const userGroupTimestamps = new Map<string, Map<number, string>>()
    pointsHistoryData.forEach(ph => {
      if (!userGroupPoints.has(ph.user)) {
        userGroupPoints.set(ph.user, new Map())
        userGroupTimestamps.set(ph.user, new Map())
      }
      const userPoints = userGroupPoints.get(ph.user)!
      const userTimestamps = userGroupTimestamps.get(ph.user)!
      if (!userTimestamps.has(ph.group) || new Date(ph.timestamp) > new Date(userTimestamps.get(ph.group) || '')) {
        userPoints.set(ph.group, ph.amount)
        userTimestamps.set(ph.group, ph.timestamp)
      }
    })

    // Users with zero balance
    const usersWithZeroBalance = usersData.filter(user => {
      const userPoints = userGroupPoints.get(user.id)
      if (!userPoints) return true
      const totalPoints = Array.from(userPoints.values()).reduce((sum, points) => sum + points, 0)
      return totalPoints === 0
    }).length

    // Users without bets
    const usersWithBets = new Set(betsData.map(bet => bet.user))
    const usersWithoutBets = usersData.filter(user => !usersWithBets.has(user.id)).length

    // Users without groups
    const usersWithGroups = new Set(membershipsData.map(m => m.user))
    const usersWithoutGroups = usersData.filter(user => !usersWithGroups.has(user.id)).length

    // Users without onboarding
    const usersWithoutOnboarding = usersData.filter(user => !user.has_seen_onboarding).length

    // Groups per user distribution
    const userGroupCounts = new Map<string, number>()
    membershipsData.forEach(m => {
      userGroupCounts.set(m.user, (userGroupCounts.get(m.user) || 0) + 1)
    })
    
    const groupsPerUserDistribution: { [key: number]: number } = {}
    for (let i = 0; i <= 10; i++) {
      groupsPerUserDistribution[i] = 0
    }
    
    usersData.forEach(user => {
      const groupCount = userGroupCounts.get(user.id) || 0
      const bucket = Math.min(groupCount, 10)
      groupsPerUserDistribution[bucket]++
    })

    // Points per user distribution
    const pointsPerUserDistribution: { [key: string]: number } = {
      '0': 0,
      '1-100': 0,
      '101-500': 0,
      '501-1000': 0,
      '1001-5000': 0,
      '5000+': 0
    }

    usersData.forEach(user => {
      const userPoints = userGroupPoints.get(user.id)
      const totalPoints = userPoints ? Array.from(userPoints.values()).reduce((sum, points) => sum + points, 0) : 0
      
      if (totalPoints === 0) pointsPerUserDistribution['0']++
      else if (totalPoints <= 100) pointsPerUserDistribution['1-100']++
      else if (totalPoints <= 500) pointsPerUserDistribution['101-500']++
      else if (totalPoints <= 1000) pointsPerUserDistribution['501-1000']++
      else if (totalPoints <= 5000) pointsPerUserDistribution['1001-5000']++
      else pointsPerUserDistribution['5000+']++
    })

    // DAU/MAU calculation (using bet creation as activity indicator)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    const oneDayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000)

    const recentBets = betsData.filter(bet => new Date(bet.created_at) >= thirtyDaysAgo)
    const dailyActiveUsers = new Set(
      betsData.filter(bet => new Date(bet.created_at) >= oneDayAgo).map(bet => bet.user)
    ).size
    
    const monthlyActiveUsers = new Set(recentBets.map(bet => bet.user)).size

    // Activity over last 30 days - fix data structure
    const userActivityLast30Days = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      
      const dayActiveUsers = new Set(
        betsData.filter(bet => {
          const betDate = new Date(bet.created_at)
          return betDate >= dayStart && betDate < dayEnd
        }).map(bet => bet.user)
      ).size

      userActivityLast30Days.push({
        date: date.toISOString().split('T')[0],
        value: dayActiveUsers // Changed from 'count' to 'value'
      })
    }

    setUserAnalytics({
      totalUsers: usersData.length,
      usersWithZeroBalance,
      usersWithoutBets,
      usersWithoutGroups,
      usersWithoutOnboarding,
      groupsPerUserDistribution,
      pointsPerUserDistribution,
      dailyActiveUsers,
      monthlyActiveUsers,
      userActivityLast30Days
    })
  }

  const calculateGroupAnalytics = async (groupsData: { id: number; name: string }[], membershipsData: { user: string; group: number }[], betsData: { user: string; created_at: string; game: string }[], bettingGamesData: { id: string; group: number; created_at: string; created_by: string; referee: string; decided_at?: string }[], usersData: UserData[], pointsHistoryData: { user: string; group: number; amount: number; timestamp: string }[]) => {
    // Group member activity heatmap
    const groupMemberActivity = await Promise.all(
      groupsData.map(async (group) => {
        const activity = []
        const now = new Date()
        
        for (let i = 29; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
          const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
          
          // Get games in this group for this day
          const dayGames = bettingGamesData.filter(game => 
            game.group === group.id &&
            new Date(game.created_at) >= dayStart &&
            new Date(game.created_at) < dayEnd
          )
          
          // Get unique users who bet on games in this group this day
          const dayBets = betsData.filter(bet => 
            dayGames.some(game => game.id === bet.game) &&
            new Date(bet.created_at) >= dayStart &&
            new Date(bet.created_at) < dayEnd
          )
          
          const activeMembers = new Set(dayBets.map(bet => bet.user)).size
          
          activity.push({
            date: date.toISOString().split('T')[0],
            activeMembers
          })
        }
        
        return {
          groupId: group.id,
          groupName: group.name,
          activity
        }
      })
    )

    // Game creation patterns
    const gameCreationPatterns = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      
      const dayGames = bettingGamesData.filter(game => {
        const gameDate = new Date(game.created_at)
        return gameDate >= dayStart && gameDate < dayEnd
      })
      
      gameCreationPatterns.push({
        date: date.toISOString().split('T')[0],
        count: dayGames.length
      })
    }

    // Group comparisons with KPIs
    const groupComparisons = await Promise.all(
      groupsData.map(async (group) => {
        const groupMembers = membershipsData.filter(m => m.group === group.id)
        const groupGames = bettingGamesData.filter(game => game.group === group.id)
        const groupBets = betsData.filter(bet => 
          groupGames.some(game => game.id === bet.game)
        )
        
        const uniqueCreators = new Set(groupGames.map(game => game.created_by)).size
        const uniqueReferees = new Set(groupGames.map(game => game.referee)).size
        const completedGames = groupGames.filter(game => game.decided_at).length
        
        return {
          groupId: group.id,
          groupName: group.name,
          memberCount: groupMembers.length,
          creatorPercentage: groupMembers.length > 0 ? (uniqueCreators / groupMembers.length) * 100 : 0,
          refereePercentage: groupMembers.length > 0 ? (uniqueReferees / groupMembers.length) * 100 : 0,
          avgBetsPerGame: groupGames.length > 0 ? groupBets.length / groupGames.length : 0,
          completionRate: groupGames.length > 0 ? (completedGames / groupGames.length) * 100 : 0
        }
      })
    )

    // Top players per group analysis - based on points
    const topPlayersPerGroup = await Promise.all(
      groupsData.map(async (group) => {
        const groupMembers = membershipsData
          .filter(m => m.group === group.id)
          .map(m => m.user)

        if (groupMembers.length === 0) {
          return {
            groupId: group.id,
            groupName: group.name,
            avgTopPlayerPoints: 0,
            topPlayerCount: 0
          }
        }

        // Get latest points for each member in this group
        const memberPoints = []
        for (const userId of groupMembers) {
          const userPointsHistory = pointsHistoryData
            .filter(ph => ph.user === userId && ph.group === group.id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          
          const latestPoints = userPointsHistory.length > 0 ? userPointsHistory[0].amount : 0
          memberPoints.push(latestPoints)
        }

        // Get top 3 players by points
        const sortedPoints = memberPoints.sort((a, b) => b - a)
        const topPlayerPoints = sortedPoints.slice(0, 3)
        const avgTopPlayerPoints = topPlayerPoints.length > 0 
          ? topPlayerPoints.reduce((sum, points) => sum + points, 0) / topPlayerPoints.length 
          : 0

        return {
          groupId: group.id,
          groupName: group.name,
          avgTopPlayerPoints,
          topPlayerCount: topPlayerPoints.length
        }
      })
    )

    setGroupAnalytics({
      totalGroups: groupsData.length,
      groupMemberActivity,
      gameCreationPatterns,
      groupComparisons,
      topPlayersPerGroup
    })
  }

  const calculateBettingAnalytics = async (betsData: { user: string; created_at: string; game: string }[], bettingGamesData: { id: string; group: number; created_at: string; created_by: string; referee: string; decided_at?: string }[], usersData: UserData[], groupsData: { id: number; name: string }[], pointsHistoryData: { user: string; group: number; amount: number; timestamp: string }[]) => {
    // Calculate points per group for each user
    const userGroupPoints = new Map<string, Map<number, number>>()
    const userGroupTimestamps = new Map<string, Map<number, string>>()
    pointsHistoryData.forEach(ph => {
      if (!userGroupPoints.has(ph.user)) {
        userGroupPoints.set(ph.user, new Map())
        userGroupTimestamps.set(ph.user, new Map())
      }
      const userPoints = userGroupPoints.get(ph.user)!
      const userTimestamps = userGroupTimestamps.get(ph.user)!
      if (!userTimestamps.has(ph.group) || new Date(ph.timestamp) > new Date(userTimestamps.get(ph.group) || '')) {
        userPoints.set(ph.group, ph.amount)
        userTimestamps.set(ph.group, ph.timestamp)
      }
    })

    // Calculate total points circulating
    let totalPointsCirculating = 0
    userGroupPoints.forEach(groupPoints => {
      groupPoints.forEach((points) => {
        totalPointsCirculating += points
      })
    })

    const averagePointsPerUser = usersData.length > 0 ? totalPointsCirculating / usersData.length : 0

    // Calculate points evolution over time
    const pointsEvolutionData: { date: string; totalPoints: number }[] = []
    const sortedPointsHistory = pointsHistoryData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    
    // Group points history by date
    const pointsByDate = new Map<string, number>()
    const runningUserBalances = new Map<string, Map<number, number>>() // user -> group -> latest amount
    
    for (const ph of sortedPointsHistory) {
      const date = ph.timestamp.split('T')[0]
      
      // Update running balance for this user-group combination
      if (!runningUserBalances.has(ph.user)) {
        runningUserBalances.set(ph.user, new Map())
      }
      runningUserBalances.get(ph.user)!.set(ph.group, ph.amount)
      
      // Calculate total points across all users and groups at this date
      let totalAtDate = 0
      runningUserBalances.forEach(groupMap => {
        groupMap.forEach(amount => {
          totalAtDate += amount
        })
      })
      
      pointsByDate.set(date, totalAtDate)
    }
    
    // Convert to array format
    Array.from(pointsByDate.entries()).forEach(([date, totalPoints]) => {
      pointsEvolutionData.push({ date, totalPoints })
    })

    // Calculate referee and creator statistics
    const refereeCount = new Map<string, number>()
    const creatorCount = new Map<string, number>()

    bettingGamesData.forEach(game => {
      refereeCount.set(game.referee, (refereeCount.get(game.referee) || 0) + 1)
      creatorCount.set(game.created_by, (creatorCount.get(game.created_by) || 0) + 1)
    })

    // Get usernames for top referees and creators
    const topReferees = await Promise.all(
      Array.from(refereeCount.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(async ([userId, count]) => {
          const user = usersData.find(u => u.id === userId)
          return { username: user?.username || 'Unknown', count }
        })
    )

    const topCreators = await Promise.all(
      Array.from(creatorCount.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(async ([userId, count]) => {
          const user = usersData.find(u => u.id === userId)
          return { username: user?.username || 'Unknown', count }
        })
    )

    // Find most active group
    const groupActivity = groupsData.map(group => ({
      name: group.name,
      activity: bettingGamesData.filter(game => game.group === group.id).length +
               betsData.filter(bet => bettingGamesData.find(game => game.id === bet.game && game.group === group.id)).length
    })).sort((a, b) => b.activity - a.activity)[0] || { name: 'Aucun', activity: 0 }

    const totalBets = betsData.length
    const totalBettingGames = bettingGamesData.length
    const activeBettingGames = bettingGamesData.filter(g => !g.decided_at).length
    const avgBetsPerGame = totalBettingGames > 0 ? totalBets / totalBettingGames : 0
    const completionRate = totalBettingGames > 0 ? (bettingGamesData.filter(g => g.decided_at).length / totalBettingGames) * 100 : 0

    setBettingAnalytics({
      totalBets,
      totalBettingGames,
      activeBettingGames,
      totalPointsCirculating,
      averagePointsPerUser,
      topReferees,
      topCreators,
      mostActiveGroup: groupActivity,
      avgBetsPerGame,
      completionRate,
      pointsEvolutionData
    })
  }


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-lg">Chargement du panneau d&apos;administration...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Accès refusé</h1>
          <p className="text-gray-600">Vous devez être connecté pour accéder à cette page.</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Accès refusé</h1>
          <p className="text-gray-600">Vous n&apos;avez pas les permissions pour accéder au panneau d&apos;administration.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Database className="h-8 w-8 text-blue-600" />
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground">Visual insights for CentraleVegas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Badge variant="secondary" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Live Analytics
          </Badge>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Analytics
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Group Analytics
          </TabsTrigger>
          <TabsTrigger value="betting" className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4" />
            Betting Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {userAnalytics && bettingAnalytics && (
            <>
              {/* Key Performance Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Daily Active Users"
                  value={userAnalytics.dailyActiveUsers}
                  subtitle="Users active today"
                  icon={Activity}
                  color="green"
                />
                <MetricCard
                  title="Monthly Active Users"
                  value={userAnalytics.monthlyActiveUsers}
                  subtitle="Users active this month"
                  icon={Users}
                  color="blue"
                />
                <MetricCard
                  title="Total Users"
                  value={userAnalytics.totalUsers}
                  subtitle={`${((userAnalytics.monthlyActiveUsers / userAnalytics.totalUsers) * 100).toFixed(1)}% monthly active`}
                  icon={UserCheck}
                  color="purple"
                />
                <MetricCard
                  title="Active Games"
                  value={bettingAnalytics.activeBettingGames}
                  subtitle={`${bettingAnalytics.totalBettingGames} total games`}
                  icon={Gamepad2}
                  color="orange"
                />
              </div>

              {/* Activity Heatmap and Points Evolution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ActivityHeatmap
                  title="User Activity Last 30 Days"
                  data={userAnalytics.userActivityLast30Days}
                />
                <PointsEvolutionChart
                  data={bettingAnalytics.pointsEvolutionData}
                  timePeriod={pointsTimePeriod}
                  onTimePeriodChange={setPointsTimePeriod}
                />
              </div>

              {/* Top Performers Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-yellow-500" />
                      Top Referees
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {bettingAnalytics.topReferees.slice(0, 3).map((referee, index) => (
                        <div key={referee.username} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge className={`w-8 h-8 rounded-full p-0 flex items-center justify-center ${
                              index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                            }`}>
                              {index + 1}
                            </Badge>
                            <span className="font-medium">{referee.username}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-500" />
                            <span className="text-lg font-bold text-blue-600">{referee.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-purple-500" />
                      Top Creators
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {bettingAnalytics.topCreators.slice(0, 3).map((creator, index) => (
                        <div key={creator.username} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge className={`w-8 h-8 rounded-full p-0 flex items-center justify-center ${
                              index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                            }`}>
                              {index + 1}
                            </Badge>
                            <span className="font-medium">{creator.username}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Gamepad2 className="h-4 w-4 text-purple-500" />
                            <span className="text-lg font-bold text-purple-600">{creator.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          {userAnalytics && (
            <>
              {/* User Status Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Zero Balance"
                  value={`${((userAnalytics.usersWithZeroBalance / userAnalytics.totalUsers) * 100).toFixed(1)}%`}
                  subtitle={`${userAnalytics.usersWithZeroBalance} users`}
                  icon={Trophy}
                  color="red"
                />
                <MetricCard
                  title="No Bets Yet"
                  value={`${((userAnalytics.usersWithoutBets / userAnalytics.totalUsers) * 100).toFixed(1)}%`}
                  subtitle={`${userAnalytics.usersWithoutBets} users`}
                  icon={Gamepad2}
                  color="orange"
                />
                <MetricCard
                  title="No Groups"
                  value={`${((userAnalytics.usersWithoutGroups / userAnalytics.totalUsers) * 100).toFixed(1)}%`}
                  subtitle={`${userAnalytics.usersWithoutGroups} users`}
                  icon={Shield}
                  color="yellow"
                />
                <MetricCard
                  title="Not Onboarded"
                  value={`${((userAnalytics.usersWithoutOnboarding / userAnalytics.totalUsers) * 100).toFixed(1)}%`}
                  subtitle={`${userAnalytics.usersWithoutOnboarding} users`}
                  icon={Eye}
                  color="purple"
                />
              </div>

              {/* Distribution Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DistributionChart
                  title="Groups per User Distribution"
                  data={Object.entries(userAnalytics.groupsPerUserDistribution).map(([key, value]) => ({
                    label: key === '10' ? '10+' : key,
                    value
                  }))}
                  color="blue"
                />
                <DistributionChart
                  title="Points per User Distribution"
                  data={Object.entries(userAnalytics.pointsPerUserDistribution).map(([key, value]) => ({
                    label: key,
                    value
                  }))}
                  color="green"
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="groups" className="space-y-6">
          {groupAnalytics && (
            <>
              {/* Game Creation Pattern */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChartLine className="h-5 w-5" />
                    Game Creation Pattern (Last 30 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-end gap-1">
                    {groupAnalytics.gameCreationPatterns.map((day, index) => {
                      const maxCount = Math.max(...groupAnalytics.gameCreationPatterns.map(d => d.count))
                      const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0
                      return (
                        <div
                          key={index}
                          className="flex-1 bg-blue-500 rounded-t min-h-[4px] cursor-pointer hover:bg-blue-600 transition-colors"
                          style={{ height: `${height}%` }}
                          title={`${day.date}: ${day.count} games created`}
                        />
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Group Comparisons */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Group Performance Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Group</TableHead>
                          <TableHead>Members</TableHead>
                          <TableHead>% Creators</TableHead>
                          <TableHead>% Referees</TableHead>
                          <TableHead>Bets/Game</TableHead>
                          <TableHead>Completion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupAnalytics.groupComparisons.map((group) => (
                          <TableRow key={group.groupId}>
                            <TableCell className="font-medium">{group.groupName}</TableCell>
                            <TableCell>{group.memberCount}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-purple-600">
                                {group.creatorPercentage.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-blue-600">
                                {group.refereePercentage.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell>{group.avgBetsPerGame.toFixed(1)}</TableCell>
                            <TableCell>
                              <Badge variant={group.completionRate > 80 ? "default" : group.completionRate > 50 ? "secondary" : "destructive"}>
                                {group.completionRate.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Top Players Summary */}
              <TopPlayersGroupSummary groupData={groupAnalytics.topPlayersPerGroup} />
            </>
          )}
        </TabsContent>

        <TabsContent value="betting" className="space-y-6">
          {bettingAnalytics && (
            <>
              {/* Betting Overview Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Bets"
                  value={bettingAnalytics.totalBets.toLocaleString()}
                  subtitle={`${bettingAnalytics.avgBetsPerGame.toFixed(1)} per game`}
                  icon={Gamepad2}
                  color="blue"
                />
                <MetricCard
                  title="Active Games"
                  value={bettingAnalytics.activeBettingGames}
                  subtitle={`${bettingAnalytics.totalBettingGames} total games`}
                  icon={Activity}
                  color="green"
                />
                <MetricCard
                  title="Points in Play"
                  value={bettingAnalytics.totalPointsCirculating.toLocaleString()}
                  subtitle={`${Math.round(bettingAnalytics.averagePointsPerUser)} avg per user`}
                  icon={Trophy}
                  color="yellow"
                />
                <MetricCard
                  title="Completion Rate"
                  value={`${bettingAnalytics.completionRate.toFixed(1)}%`}
                  subtitle="Games completed"
                  icon={Target}
                  color="purple"
                />
              </div>

              {/* Most Active Group */}
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700">
                    <Flame className="h-5 w-5" />
                    Most Active Group
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-700 mb-2">{bettingAnalytics.mostActiveGroup.name}</div>
                    <div className="flex items-center justify-center gap-2">
                      <Award className="h-5 w-5 text-orange-600" />
                      <span className="text-lg font-semibold text-orange-600">{bettingAnalytics.mostActiveGroup.activity} total activities</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
} 