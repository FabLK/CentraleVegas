export interface Bet {
    id: string
    title: string
    description: string
    totalBettors: number
    timeSlots: TimeSlotData[]
    recentActivity: BetActivity[] | number
    endDate: string
    status: 'active' | 'expired' | 'decided'
    totalPoints: number
    isExpired: boolean
    isDecided: boolean
    decidedAt: string | null
    isNewGame?: boolean
    hasWhalebet?: boolean
    isCompetitive?: boolean
    isMostPopular?: boolean
    isHighestStakes?: boolean
    createdAt: string
    userParticipated?: boolean
    isUserReferee?: boolean
  }
  
  export interface TimeSlotData {
    time: string
    betCount: number
    percentage: number
    points: number
    isWinner?: boolean
  }
  
  export interface BetActivity {
    user: {
      name: string
      avatar: string
    }
    time: string
    timestamp: string
  }