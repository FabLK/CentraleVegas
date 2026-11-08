import React, { useState } from 'react'
import { motion } from "framer-motion"
import { formatDistanceToNow } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { HandCoins } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { useTranslation } from "react-i18next"

type RecentActivity = {
  user: { name: string; avatar: string };
  time: string;
  timestamp: string;
  amount: number;
  isWinningBet?: boolean;
  multiplier: number;
}

interface BetSocialProps {
  recentActivity: RecentActivity[];
  gameStatus: 'active' | 'pending_decision' | 'decided';
}

export function BetSocial({ recentActivity, gameStatus }: BetSocialProps) {
  const { t, i18n } = useTranslation('BetSocial')
  const [displayCount, setDisplayCount] = useState(15);
  
  // Get the appropriate date-fns locale based on current language
  const dateLocale = i18n.language === 'fr' ? fr : enUS;
  
  // Only display when the game is active or pending decision
  if (gameStatus === 'decided') return null;

  const handleSeeMore = () => {
    setDisplayCount(prev => prev + 15);
  };

  return (
    <div>
      <div className="bg-gradient-to-b from-white via-white to-slate-50/30 shadow-xl shadow-slate-300/50 rounded-3xl border-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100/60 bg-gradient-to-r from-slate-50/40 to-slate-100/30 flex items-center justify-between">
                      <h3 className="text-sm sm:text-base font-semibold text-slate-800 flex items-center gap-3">
              <div className="h-8 w-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center">
                <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 5h-6V3H8v2H2v3h2v13h16V8h2V5h-3zm-1 14H6V8h12v11z" fill="currentColor"/>
                  <path d="M8 10h8v2H8v-2zm0 4h8v2H8v-2z" fill="currentColor"/>
                </svg>
              </div>
              {t('Activité récente')}
              <span className="bg-gradient-to-r from-green-100 to-green-200 text-green-700 text-[10px] sm:text-xs px-2.5 py-1 rounded-full font-medium shadow-sm">{t('Live')}</span>
            </h3>
                      <div className="text-[10px] sm:text-xs text-slate-600 flex items-center gap-2 bg-slate-100/60 px-3 py-1.5 rounded-2xl">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="font-medium">{recentActivity.length} {t('paris')}</span>
            </div>
        </div>
        <div className="max-h-[260px] sm:max-h-[320px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {recentActivity.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {recentActivity.slice(0, displayCount).map((activity, index) => (
                <motion.div 
                  key={activity.timestamp + index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="p-3 sm:p-4 hover:bg-gradient-to-r hover:from-slate-50/50 hover:to-slate-100/30 transition-all duration-200"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border-2 border-slate-200/60 shadow-sm">
                        <AvatarImage 
                          src={activity.user.avatar} 
                          alt={activity.user.name} 
                        />
                        <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 text-[10px] sm:text-sm text-slate-700 font-semibold">
                          {activity.user.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -right-1 -bottom-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-gradient-to-br from-white to-slate-50 flex items-center justify-center border border-slate-200/60 shadow-sm">
                        <HandCoins className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-amber-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 mb-1">
                        <Link href={`/profile/${encodeURIComponent(activity.user.name)}`} className="font-semibold text-xs sm:text-sm text-slate-900 truncate hover:text-blue-600 transition-colors">
                          {activity.user.name}
                        </Link>
                        <span className="text-[10px] sm:text-xs text-slate-500 font-medium">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: dateLocale })}
                        </span>
                      </div>
                      <div className="flex items-center text-[10px] sm:text-sm text-slate-700">
                        {t('a misé')} <span className="font-bold text-blue-600 mx-1">{activity.amount} {t('pts')}</span> 
                        {t('sur')} <span className="font-semibold mx-1 truncate bg-slate-100/60 px-2 py-0.5 rounded-lg">{activity.time}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 font-bold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-2xl text-[10px] sm:text-sm shadow-sm">
                      x{activity.multiplier.toFixed(1)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4 shadow-sm">
                <HandCoins className="h-5 w-5 sm:h-6 sm:w-6 text-slate-500" />
              </div>
              <p className="text-sm font-semibold text-slate-600">{t('Aucun pari pour le moment')}</p>
            </div>
          )}
        </div>
        {recentActivity.length > displayCount && (
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50/60 to-slate-100/40 border-t border-slate-100/60 text-center">
            <button 
              type="button"
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold bg-gradient-to-b from-blue-50 to-blue-100/80 px-4 py-2 rounded-2xl transition-all duration-200 hover:from-blue-100 hover:to-blue-200/80 shadow-sm"
              onClick={handleSeeMore}
            >
              {t('Voir plus')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
