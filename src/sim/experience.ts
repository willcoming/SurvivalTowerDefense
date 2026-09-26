import { usesFreeSkills } from '../data/deep-trees';
import { battleLevelCost, battleXpAt } from '../data/battle-experience';
import { operationProfile } from '../data/progression';
import type { RunState } from './types';

/** Unversioned saves retain their original two-point milestones. */
export function battleExperience(s: RunState) {
  const free = usesFreeSkills(s);
  const maximum = free ? operationProfile(s).points : 18;
  if (s.experienceVersion === 2) {
    let earned = 0;
    while (earned < maximum && s.xp >= battleXpAt(earned + 2)) earned++;
    const level = earned + 1, required = battleLevelCost(level), capped = earned >= maximum;
    return { earned, maximum, pointsPerLevel: 1, required, capped, level,
      current: capped ? required : s.xp - battleXpAt(level) };
  }
  const pointsPerLevel = free && s.experienceVersion !== 1 ? 2 : 1;
  const required = free ? 30 * pointsPerLevel : 40;
  const earned = Math.min(maximum, pointsPerLevel * Math.floor(s.xp / required));
  const capped = earned >= maximum;
  return { earned, maximum, pointsPerLevel, required, capped,
    level: 1 + Math.floor(earned / pointsPerLevel), current: capped ? required : s.xp % required };
}
