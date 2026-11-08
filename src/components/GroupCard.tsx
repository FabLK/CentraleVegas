import { cn } from '@/lib/utils';
import { DoorOpen, Lock, Loader2, Users, Shield } from 'lucide-react';
import { useTranslation } from "react-i18next";

export interface GroupCardProps {
  id?: number | string;
  name: string;
  description?: string;
  isLocked?: boolean;
  isPending?: boolean;
  isOwner?: boolean;
  showGuards?: boolean;
  className?: string;
  emoji?: string;
  onClick?: (id: number | string) => void;
  selected?: boolean;
  width?: string | number;
  memberCount?: number;
  variant?: 'default' | 'simple' | 'manage';
  actions?: React.ReactNode;
  hideStatus?: boolean;
}

export const GroupCard = ({ 
  id, 
  name, 
  description, 
  isLocked = false, 
  isPending = false,
  isOwner = false,
  showGuards = true,
  className, 
  emoji,
  onClick, 
  selected = false,
  width = '100%',
  memberCount = 0,
  variant,
  actions,
  hideStatus = false
}: GroupCardProps) => {
  const { t } = useTranslation('GroupCard');
  // Improved emoji detection system
  // This uses Unicode property escapes to detect presentation emojis
  // and ensures we match emoji properly including variation selectors
  const extractEmoji = (text: string): string | undefined => {
    // Match emoji that are rendered as graphical symbols rather than text symbols
    // This pattern covers standard emojis, emojis with skin tones, and emojis with variation selectors
    const emojiPattern = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u;
    return text.match(emojiPattern)?.[0];
  };
  
  const nameEmoji = emoji || extractEmoji(name);
  const displayName = nameEmoji 
    ? name.replace(nameEmoji, '').trim()
    : name;



  const getStatusIcon = () => {
    if (isOwner) return <Shield className="h-3 w-3" />;
    if (isLocked) return <Lock className="h-3 w-3" />;
    return <DoorOpen className="h-3 w-3" />;
  };

  const getStatusText = () => {
    if (isOwner) return t("Admin");
    if (isLocked) return showGuards ? t("Candidature") : t("Verrouillée");
    return t("Libre");
  };

  // Hide status if explicitly requested or if variant is 'manage'
  const shouldHideStatus = hideStatus || variant === 'manage';
  // Hide member count badge if actions are present (since we'll merge it with the manage members button)
  const shouldShowMemberCount = !actions;

  return (
    <div 
      className={cn(
        "group rounded-xl px-3 py-4 transition-all duration-200 flex items-center justify-between",
        "min-h-[76px]",
        // Background and border styling - iOS style
        "bg-white/50 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/60",
        "hover:bg-white dark:hover:bg-gray-800 hover:shadow-md hover:border-gray-300/60 dark:hover:border-gray-600/60",
        // Selection state
        selected && "ring-2 ring-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20",
        // Click behavior
        onClick && "cursor-pointer",
        // Owner-specific styling
        isOwner && "bg-gradient-to-r from-amber-50/60 to-orange-50/60 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200/60 dark:border-amber-800/60",
        // Member-specific styling  
        !isOwner && !isPending && "bg-gradient-to-r from-blue-50/30 to-purple-50/30 dark:from-blue-950/10 dark:to-purple-950/10 border-blue-200/40 dark:border-blue-800/40",
        // Pending state styling
        isPending && "bg-gradient-to-r from-amber-50/60 to-yellow-50/60 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-300/60 dark:border-amber-700/60",
        className
      )}
      style={{ width }}
      onClick={() => onClick && id && onClick(id)}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Emoji or status icon in a circle - iOS style */}
        <div className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all duration-200 shadow-sm",
          "group-hover:scale-105 group-hover:shadow-md",
          nameEmoji 
            ? // Emoji circles adapt to card state
              isOwner 
                ? "bg-gradient-to-br from-amber-100/70 to-orange-100/70 dark:from-amber-950/30 dark:to-orange-950/30"
                : isPending
                  ? "bg-gradient-to-br from-amber-100/70 to-yellow-100/70 dark:from-amber-950/30 dark:to-yellow-950/30"
                  : !isOwner && !isPending
                    ? "bg-gradient-to-br from-blue-100/70 to-purple-100/70 dark:from-blue-950/30 dark:to-purple-950/30"
                    : "bg-gradient-to-br from-gray-100/70 to-gray-200/70 dark:from-gray-700/30 dark:to-gray-600/30"
            : // Status icon circles
              isOwner 
                ? "bg-gradient-to-br from-amber-100/70 to-orange-100/70 dark:from-amber-950/30 dark:to-orange-950/30"
                : isPending || isLocked 
                  ? "bg-gradient-to-br from-amber-100/70 to-yellow-100/70 dark:from-amber-950/30 dark:to-yellow-950/30"
                  : "bg-gradient-to-br from-emerald-100/70 to-green-100/70 dark:from-emerald-950/30 dark:to-green-950/30"
        )}>
          {nameEmoji ? (
            <span className="text-xl">{nameEmoji}</span>
          ) : (
            <div className={cn(
              "w-5 h-5",
              isOwner ? "text-amber-600 dark:text-amber-400" :
              isLocked ? "text-amber-600 dark:text-amber-400" :
              "text-emerald-600 dark:text-emerald-400"
            )}>
              {getStatusIcon()}
            </div>
          )}
        </div>
        
        {/* Name and description - iOS style */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate text-left leading-tight">
              {displayName}
            </h4>
            {isPending && (
              <span className="flex-shrink-0">
                <Loader2 className="h-3 w-3 text-amber-500 animate-spin" />
              </span>
            )}
          </div>
          
          {description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate text-left leading-tight">
              {description}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-1 ml-3 flex-shrink-0">
        {/* Status tag - iOS style pills */}
        {!shouldHideStatus && (
          <span className={cn(
            "text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 whitespace-nowrap font-medium shadow-sm transition-all duration-200",
            isOwner 
              ? "bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-950/40 dark:to-orange-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-700/60" 
              : isPending 
                ? "bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-950/40 dark:to-yellow-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-700/60"
                : isLocked 
                  ? "bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-950/40 dark:to-yellow-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-700/60" 
                  : "bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-950/40 dark:to-green-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-700/60"
          )}>
            {getStatusIcon()}
            <span className="hidden sm:inline">{getStatusText()}</span>
          </span>
        )}

        {/* Member count - iOS style */}
        {shouldShowMemberCount && (
          <span className="text-xs bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-medium shadow-sm border border-gray-200/60 dark:border-gray-600/60">
            <Users className="h-3 w-3" />
            <span>{memberCount}</span>
          </span>
        )}
        
        {/* Actions */}
        {actions && (
          <div className="flex items-center space-x-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default GroupCard; 