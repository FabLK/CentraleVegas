import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  
  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return
    
    const media = window.matchMedia(query)
    
    // Update the state initially
    setMatches(media.matches)
    
    // Define listener function
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }
    
    // Add the listener
    media.addEventListener('change', listener)
    
    // Clean up
    return () => {
      media.removeEventListener('change', listener)
    }
  }, [query])
  
  return matches
} 