// Coin economy — all tunable. See DESIGN.md §5.
//
// Conscious money anchor:  100 coins = $1.
// A solid month of reading (~15 hr) earns ~1,000 coins ≈ $10 ≈ one boba.
//   15 hr × 67 coins/hr ≈ 1,005 coins.
export const COINS_PER_DOLLAR = 100;
export const BASE_COINS_PER_HOUR = 67;
export const COMFORT_ZONE_MULTIPLIER = 1.5;

export function baseCoins(minutes) {
  if (minutes <= 0) return 0;
  return Math.max(1, Math.round((minutes / 60) * BASE_COINS_PER_HOUR));
}
