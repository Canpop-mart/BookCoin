// Coin economy — all tunable. See DESIGN.md §5.
export const BASE_COINS_PER_HOUR = 20;
export const COMFORT_ZONE_MULTIPLIER = 1.5;

export function baseCoins(minutes) {
  if (minutes <= 0) return 0;
  return Math.max(1, Math.round((minutes / 60) * BASE_COINS_PER_HOUR));
}
