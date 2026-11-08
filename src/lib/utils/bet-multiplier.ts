/**
 * This utility contains functions for calculating bet multipliers and multiplier history
 * using a formula with slippage factor to manage odds
 */

// Default virtual liquidity value used throughout the system
export const DEFAULT_VIRTUAL_LIQUIDITY = 50;

// Default slippage factor (between 0 and 1)
export const DEFAULT_SLIPPAGE_FACTOR = 0.5;

interface Bet {
  option: string;
  amount: number;
  created_at: string | Date;
}

interface BettingOption {
  id: string;
}

/**
 * Calculates the multiplier for a betting option using the formula:
 * m_i = (T + s·b) / (B_i + s·b)
 *
 * Where:
 * - T is the total bet pool without the incoming bet + all virtual liquidity
 * - B_i is the pool on option i without the incoming bet + virtual liquidity
 * - b is the incoming bet amount (0 when just displaying current odds)
 * - s is the slippage factor (between 0 and 1)
 * 
 * @param optionId The ID of the option to calculate the multiplier for
 * @param bets Array of all bets for the game
 * @param allOptions Array of all options for the game
 * @param baseVirtualLiquidity Base virtual liquidity - used for initial state
 * @param userBetAmount The amount of the user bet (optional)
 * @param slippageFactor The slippage factor to discount bet impact (between 0 and 1)
 * @returns The calculated multiplier (as a number with 1 decimal place)
 */
export function calculateMultiplier(
  optionId: string,
  bets: Bet[],
  allOptions: BettingOption[],
  baseVirtualLiquidity: number = DEFAULT_VIRTUAL_LIQUIDITY,
  userBetAmount?: number,
  slippageFactor: number = DEFAULT_SLIPPAGE_FACTOR
): number {
  // Calculate total bets for each option, including virtual liquidity
  const optionTotals: Record<string, number> = {};
  
  // Initialize all options with virtual liquidity
  allOptions.forEach(option => {
    optionTotals[option.id] = baseVirtualLiquidity;
  });

  // Add actual bets to the totals
  if (bets && bets.length > 0) {
    bets.forEach(bet => {
      optionTotals[bet.option] += bet.amount;
    });
  }

  // T is the total bet pool + all virtual liquidity
  const totalBetAmount = Object.values(optionTotals).reduce((sum, amount) => sum + amount, 0);
  
  // B_i is the bet amount on the specific option
  const optionBetAmount = optionTotals[optionId];

  // If no user bet amount is provided, we'll use a small default value
  const userBet = userBetAmount || 0;

  // m_i = (T + s·b) / (B_i + s·b)
  // Ensure slippage factor is between 0 and 1
  const safeSlippageFactor = Math.max(0, Math.min(1, slippageFactor));
  const multiplier = (totalBetAmount + safeSlippageFactor * userBet) / (optionBetAmount + safeSlippageFactor * userBet);

  // Return the multiplier with 1 decimal place
  return Number(multiplier.toFixed(1));
}

/**
 * Calculates the evolution of multipliers over time based on bet history
 * 
 * @param optionId The ID of the option to calculate the history for
 * @param bets Array of all bets for the game, sorted by created_at
 * @param allOptions Array of all options for the game
 * @param baseVirtualLiquidity Base virtual liquidity to use
 * @param userBetAmount The amount of the user bet (optional)
 * @param slippageFactor The slippage factor to discount bet impact (between 0 and 1)
 * @returns Array of {multiplier, timestamp} objects showing the evolution
 */
export function calculateMultiplierHistory(
  optionId: string,
  bets: Bet[],
  allOptions: BettingOption[],
  baseVirtualLiquidity: number = DEFAULT_VIRTUAL_LIQUIDITY,
  userBetAmount?: number,
  slippageFactor: number = DEFAULT_SLIPPAGE_FACTOR
): Array<{multiplier: number, timestamp: string}> {
  // Sort bets by timestamp if not already sorted
  const sortedBets = [...bets].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateA - dateB;
  });

  const history: Array<{multiplier: number, timestamp: string}> = [];
  
  // Add initial multiplier with timestamp of first bet (or current time if no bets)
  const initialTimestamp = sortedBets.length > 0 
    ? new Date(sortedBets[0].created_at).toISOString()
    : new Date().toISOString();
    
  // Calculate initial multiplier using virtual liquidity
  const initialMultiplier = calculateMultiplier(
    optionId, 
    [], 
    allOptions, 
    baseVirtualLiquidity, 
    userBetAmount,
    slippageFactor
  );
  
  history.push({
    multiplier: initialMultiplier,
    timestamp: initialTimestamp
  });

  // If no bets, return just the initial state
  if (sortedBets.length === 0) {
    return history;
  }

  // Calculate multiplier after each bet
  const processingBets: Bet[] = [];
  
  for (const bet of sortedBets) {
    processingBets.push(bet);
    
    const multiplier = calculateMultiplier(
      optionId, 
      processingBets, 
      allOptions, 
      baseVirtualLiquidity, 
      userBetAmount,
      slippageFactor
    );
    const timestamp = new Date(bet.created_at).toISOString();
    
    history.push({
      multiplier,
      timestamp
    });
  }

  return history;
}

/**
 * Calculates multiplier histories for all options in a game
 * 
 * @param bets Array of all bets for the game, sorted by created_at
 * @param allOptions Array of all options for the game
 * @param baseVirtualLiquidity Base virtual liquidity to use
 * @param userBetAmount The amount of the user bet (optional)
 * @param slippageFactor The slippage factor to discount bet impact (between 0 and 1)
 * @returns Object mapping option IDs to their multiplier history arrays
 */
export function calculateAllMultipliersHistory(
  bets: Bet[],
  allOptions: BettingOption[],
  baseVirtualLiquidity: number = DEFAULT_VIRTUAL_LIQUIDITY,
  userBetAmount?: number,
  slippageFactor: number = DEFAULT_SLIPPAGE_FACTOR
): Record<string, Array<{multiplier: number, timestamp: string}>> {
  const result: Record<string, Array<{multiplier: number, timestamp: string}>> = {};
  
  for (const option of allOptions) {
    result[option.id] = calculateMultiplierHistory(
      option.id,
      bets,
      allOptions,
      baseVirtualLiquidity,
      userBetAmount,
      slippageFactor
    );
  }
  
  return result;
} 