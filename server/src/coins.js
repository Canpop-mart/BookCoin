// Coin economy — all tunable. See DESIGN.md §5.
//
// Conscious money anchor:  100 coins = $1.
// Base earn = 60 coins/hour = exactly 1 coin per minute (intuitive, round numbers).
// A ~15 hr month earns ~900 coins (~$9); a 1,000-coin boba is ~16–17 hr.
export const COINS_PER_DOLLAR = 100;
export const BASE_COINS_PER_HOUR = 60;
export const COMFORT_ZONE_MULTIPLIER = 1.5;

export function baseCoins(minutes) {
  if (minutes <= 0) return 0;
  return Math.max(1, Math.round((minutes / 60) * BASE_COINS_PER_HOUR));
}
