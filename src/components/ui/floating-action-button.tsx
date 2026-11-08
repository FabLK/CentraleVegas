import { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';

interface FloatingActionButtonProps {
  text: string;
  subtext?: string;
  onClick: () => void;
  disabled?: boolean;
  disabledTitle?: string;
}

export function FloatingActionButton({
  text,
  subtext,
  onClick,
  disabled = false,
  disabledTitle,
}: FloatingActionButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const [showText, setShowText] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMobile = useMediaQuery("(max-width: 640px)");

  // Trigger animation on first load
  useEffect(() => {
    if (!hasAnimated) {
      // Start pulsing effect
      setIsPulsing(true);
      
      // Start expand animation after 1 second
      const initialDelay = setTimeout(() => {
        setExpanded(true);
        
        // Show text after a small delay once expansion has started
        const textDelay = setTimeout(() => {
          setShowText(true);
        }, 250);
        textTimeoutRef.current = textDelay;
        
        // Collapse after 3 seconds
        const collapseDelay = setTimeout(() => {
          setShowText(false);
          
          // Wait for text to fade out before collapsing button
          setTimeout(() => {
            setExpanded(false);
            setHasAnimated(true);
            
            // Stop pulsing 1 second after collapse
            const pulseStopDelay = setTimeout(() => {
              setIsPulsing(false);
            }, 1000);
            
            return () => clearTimeout(pulseStopDelay);
          }, 150);
          
        }, 3000);
        
        return () => {
          clearTimeout(collapseDelay);
          if (textTimeoutRef.current) clearTimeout(textTimeoutRef.current);
        };
      }, 1000);
      
      return () => clearTimeout(initialDelay);
    }
  }, [hasAnimated]);

  // Handle hover interactions
  const handleMouseEnter = () => {
    if (!disabled && hasAnimated) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsHovering(true);
      setIsInteracting(true);
      setExpanded(true);
      
      // Show text immediately for hover
      setShowText(true);
    }
  };

  const handleMouseLeave = () => {
    if (!disabled && hasAnimated) {
      setIsHovering(false);
      // Keep isInteracting true to maintain fast animation speed for collapse
      setShowText(false);
      
      // Collapse immediately
      setExpanded(false);
      
      // Reset isInteracting after animation completes
      setTimeout(() => {
        setIsInteracting(false);
      }, 150); // Slightly longer than animation to ensure it completes
    }
  };

  // Fast animation settings for both expand and collapse during interaction
  const fastAnimation = {
    duration: 0.1,
    type: "tween" as const,
    ease: "easeOut" as const
  };

  // Standard animation for initial sequence
  const standardAnimation = {
    duration: 0.3,
    type: "spring" as const,
    stiffness: 300,
    damping: 20
  };

  // Get current animation settings based on interaction state
  const currentAnimation = isInteracting || isHovering ? fastAnimation : standardAnimation;
  
  // Responsive button sizes
  const buttonSize = isMobile ? '48px' : '56px';
  const expandedWidth = isMobile ? '160px' : '200px';

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <motion.div 
        className="relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
      >
        {/* Glow effect */}
        {isPulsing && (
          <motion.div
            className="absolute inset-0 bg-primary/20 rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.7, 0.3, 0.7],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "loop",
            }}
          />
        )}
        
        <motion.button
          onClick={onClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          disabled={disabled}
          title={disabled ? disabledTitle : ''}
          className={cn(
            "flex items-center justify-center rounded-full bg-primary text-primary-foreground relative",
            "hover:bg-primary/90 transition-all duration-300 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.18)]",
            "border border-primary/20",
            disabled ? "opacity-70 cursor-not-allowed" : ""
          )}
          whileHover={{ scale: 1.05, y: -2, boxShadow: "0 14px 28px rgba(0, 0, 0, 0.2)" }}
          whileTap={{ scale: 0.95, y: 0, boxShadow: "0 5px 15px rgba(0, 0, 0, 0.1)" }}
          initial={{ width: buttonSize, height: buttonSize }}
          animate={{
            width: expanded ? expandedWidth : buttonSize,
            height: buttonSize,
          }}
          transition={{
            ...currentAnimation,
            width: {
              ...currentAnimation,
              stiffness: currentAnimation.type === 'spring' ? 400 : undefined,
              damping: currentAnimation.type === 'spring' ? 30 : undefined
            }
          }}
        >
          {/* Invisible overlay to ensure entire button area is clickable */}
          <div className="absolute inset-0" />
          
          {/* Center the icon during expansion with a container div */}
          <div 
            className={cn(
              "absolute flex items-center justify-center",
              expanded ? "left-4" : "left-1/2 transform -translate-x-1/2"
            )}
            style={{
              transition: (isInteracting || isHovering) 
                ? "left 0.1s ease-out, transform 0.1s ease-out" 
                : "left 0.3s ease, transform 0.3s ease",
            }}
          >
            <Plus className={cn("flex-shrink-0", isMobile ? "h-5 w-5" : "h-6 w-6")} />
          </div>
          
          <AnimatePresence>
            {showText && (
              <motion.div
                className="flex flex-col items-start overflow-hidden ml-8"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ 
                  duration: (isInteracting || isHovering) ? 0.08 : 0.2,
                  ease: (isInteracting || isHovering) ? "easeOut" : "easeInOut"
                }}
              >
                <span className={cn("font-medium whitespace-nowrap", isMobile ? "text-sm" : "text-base")}>{text}</span>
                {subtext && (
                  <span className={cn("bg-primary-foreground/20 px-1.5 py-0.5 rounded-full mt-0.5 whitespace-nowrap", isMobile ? "text-xs" : "text-xs")}>
                    {subtext}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>
    </div>
  );
} 