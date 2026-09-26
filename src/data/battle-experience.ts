import type { OperationProfile } from './progression';
import { distribute } from './tactical-encounters';

export const battleLevelCost = (level: number) => 30 + (level - 1) * 5;
export const battleXpAt = (level: number) => (level - 1) * (60 + (level - 2) * 5) / 2;

const profiles = new WeakMap<OperationProfile, OperationProfile>();
/** Keep the point budget and relative wave rewards while funding the rising level costs. */
export function progressiveExperienceProfile(base: OperationProfile): OperationProfile {
  const cached = profiles.get(base); if (cached) return cached;
  const rewards = distribute(battleXpAt(base.points + 1), [...base.waveXp, base.escortXp ?? 0]);
  const profile = { ...base, waveXp: rewards.slice(0, -1), escortXp: rewards.at(-1)! };
  profiles.set(base, profile); return profile;
}
