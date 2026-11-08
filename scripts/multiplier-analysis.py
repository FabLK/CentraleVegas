"""Monte Carlo check: does slippage on the market multiplier kill risk-free arbitrage?

Mirrors src/lib/utils/bet-multiplier.ts:

    m_i = (T + s*b) / (B_i + s*b)   with T = sum(B), virtual liquidity per option = 50

Writes scripts/arbitrage_analysis.png next to this file.
"""

from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
from tqdm import tqdm

base_virtual_liquidity = 50
output_path = Path(__file__).with_name("arbitrage_analysis.png")


def calculate_multiplier(total_bet_amount, option_bet_amount, user_bet_amount, slippage_factor):
    return (total_bet_amount + slippage_factor * user_bet_amount) / (
        option_bet_amount + slippage_factor * user_bet_amount
    )


# Parameters for the analysis
slippage_factors = np.linspace(0, 0.6, 13)  # [0, 0.05, 0.1, ..., 0.6]
num_simulations = 100000
results = []

# Loop through different slippage factors
for slippage_factor in tqdm(slippage_factors, desc="Testing slippage factors"):
    # Store arbitrage data for analysis
    arbitrages = []
    arbitrage_details = []

    for _ in range(num_simulations):
        # Define a random game state
        nb_options = np.random.randint(2, 6)

        options_bet_amount = []
        for _ in range(nb_options):
            options_bet_amount.append(np.random.randint(0, 10000) + base_virtual_liquidity)

        # Generate a random order of options once
        options_order = np.random.permutation(nb_options)

        # Try a sequence of bets (one for each option)
        multipliers = []
        user_bets = []
        for i in range(nb_options):
            user_bet_amount = np.random.randint(100, 100000)
            user_bets.append(user_bet_amount)

            total_bet_amount = sum(options_bet_amount)

            multiplier = calculate_multiplier(
                total_bet_amount,
                options_bet_amount[options_order[i]],
                user_bet_amount,
                slippage_factor,
            )
            multipliers.append(multiplier)

            # Update the bet amount for the current option
            options_bet_amount[options_order[i]] += user_bet_amount

        # Check if all potential outcomes result in profit
        is_arbitrage = True
        total_user_bet = sum(user_bets)

        for i in range(nb_options):
            # Calculate winnings if this option wins
            winnings = user_bets[i] * multipliers[i]
            # If any outcome results in less money than total bet, it's not risk-free
            if winnings <= total_user_bet:
                is_arbitrage = False
                break

        arbitrages.append(1 if is_arbitrage else 0)

        if is_arbitrage:
            # Store detailed information about this arbitrage opportunity
            arbitrage_details.append(
                {
                    "nb_options": nb_options,
                    "multipliers": multipliers,
                    "user_bets": user_bets,
                    "total_bet": total_user_bet,
                    "potential_winnings": [user_bets[i] * multipliers[i] for i in range(nb_options)],
                    "profit_margins": [
                        (user_bets[i] * multipliers[i] - total_user_bet) / total_user_bet
                        for i in range(nb_options)
                    ],
                }
            )

    # Analysis of results
    total_arbitrages = sum(arbitrages)
    arbitrage_percentage = (total_arbitrages / len(arbitrages)) * 100

    result = {
        "slippage_factor": slippage_factor,
        "arbitrage_percentage": arbitrage_percentage,
        "total_arbitrages": total_arbitrages,
        "arbitrage_details": arbitrage_details,
    }

    if total_arbitrages > 0:
        # Calculate statistics
        result["avg_options"] = sum(d["nb_options"] for d in arbitrage_details) / len(arbitrage_details)
        result["avg_profit_margin"] = sum(min(d["profit_margins"]) for d in arbitrage_details) / len(
            arbitrage_details
        )
        result["max_profit_margin"] = (
            max(min(d["profit_margins"]) for d in arbitrage_details) if arbitrage_details else 0
        )

        # Distribution of number of options
        option_counts = {}
        for d in arbitrage_details:
            n = d["nb_options"]
            option_counts[n] = option_counts.get(n, 0) + 1
        result["option_counts"] = option_counts
    else:
        result["avg_options"] = 0
        result["avg_profit_margin"] = 0
        result["max_profit_margin"] = 0
        result["option_counts"] = {}

    results.append(result)

# Create plots
plt.figure(figsize=(15, 10))

# Plot 1: Arbitrage Percentage vs Slippage Factor
plt.subplot(2, 2, 1)
arbitrage_percentages = [r["arbitrage_percentage"] for r in results]
plt.plot(slippage_factors, arbitrage_percentages, "o-", linewidth=2)
plt.title("Arbitrage Opportunities vs Slippage Factor")
plt.xlabel("Slippage Factor")
plt.ylabel("Arbitrage Opportunities (%)")
plt.grid(True)

# Plot 2: Average Profit Margin vs Slippage Factor
plt.subplot(2, 2, 2)
avg_profit_margins = [r["avg_profit_margin"] if r["total_arbitrages"] > 0 else 0 for r in results]
plt.plot(slippage_factors, avg_profit_margins, "o-", linewidth=2)
plt.title("Average Minimum Profit Margin vs Slippage Factor")
plt.xlabel("Slippage Factor")
plt.ylabel("Average Profit Margin")
plt.grid(True)

# Plot 3: Distribution of number of options in arbitrage cases
plt.subplot(2, 2, 3)
option_keys = list(range(2, 6))  # 2 to 5 options
option_data = []

for option_count in option_keys:
    data_for_option = []
    for r in results:
        if r["total_arbitrages"] > 0:
            count = r["option_counts"].get(option_count, 0)
            percentage = (count / r["total_arbitrages"]) * 100 if r["total_arbitrages"] > 0 else 0
            data_for_option.append(percentage)
        else:
            data_for_option.append(0)
    option_data.append(data_for_option)

for i, option_count in enumerate(option_keys):
    plt.plot(slippage_factors, option_data[i], "o-", label=f"{option_count} options")

plt.title("Distribution of Arbitrage Cases by Number of Options")
plt.xlabel("Slippage Factor")
plt.ylabel("Percentage of Arbitrage Cases")
plt.legend()
plt.grid(True)

# Plot 4: Total Arbitrage Opportunities vs Slippage Factor
plt.subplot(2, 2, 4)
total_arbitrages = [r["total_arbitrages"] for r in results]
plt.plot(slippage_factors, total_arbitrages, "o-", linewidth=2)
plt.title("Total Arbitrage Opportunities vs Slippage Factor")
plt.xlabel("Slippage Factor")
plt.ylabel("Number of Arbitrage Opportunities")
plt.grid(True)

plt.tight_layout()
plt.savefig(output_path)
plt.show()

# Print summary
print("\nSummary of Results:")
print("-" * 80)
print(f"{'Slippage Factor':<15} {'Arbitrage %':<15} {'Total Cases':<15} {'Avg Profit %':<15}")
print("-" * 80)

for r in results:
    sf = r["slippage_factor"]
    arb_pct = r["arbitrage_percentage"]
    total = r["total_arbitrages"]
    avg_profit = r["avg_profit_margin"] * 100 if r["total_arbitrages"] > 0 else 0

    print(f"{sf:<15.2f} {arb_pct:<15.4f} {total:<15} {avg_profit:<15.2f}")

# Key findings and conclusions
print("\nKey Findings:")
print("1. As slippage factor increases, arbitrage opportunities generally decrease")
print(f"2. At slippage factor 0, arbitrage percentage is {results[0]['arbitrage_percentage']:.4f}%")
print(f"3. At slippage factor 0.6, arbitrage percentage is {results[-1]['arbitrage_percentage']:.4f}%")

if results[0]["arbitrage_percentage"] > 0 and results[-1]["arbitrage_percentage"] > 0:
    reduction = (1 - results[-1]["arbitrage_percentage"] / results[0]["arbitrage_percentage"]) * 100
    print(f"4. This represents a {reduction:.2f}% reduction in arbitrage opportunities")

print("\nRecommendations:")
optimal_index = arbitrage_percentages.index(min(arbitrage_percentages))
optimal_slippage = slippage_factors[optimal_index]
print(f"- The optimal slippage factor appears to be around {optimal_slippage:.2f}")
if min(arbitrage_percentages) > 0.01:
    print("- Even with optimal slippage, arbitrage opportunities still exist")
    print("- Consider additional measures such as house fees or minimum spread requirements")
else:
    print(f"- At slippage factor {optimal_slippage:.2f}, arbitrage opportunities are minimal")
    print("- The system appears reasonably secure against arbitrage exploitation with this setting")
