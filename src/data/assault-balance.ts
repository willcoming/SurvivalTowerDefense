/** Version 4: 1.25x wave durability and 1.8x damage; 25% shorter wave intervals.
 * The 3x figure describes HP × damage / interval, not a guaranteed win-rate ratio.
 * Boss telegraph duration, player damage, XP and skill-point budgets stay intact.
 */
import type { OperationProfile } from './progression';
export const CURRENT_BALANCE_VERSION = 5;
export const ASSAULT_TUNING = { health: 1.25, damage: 1.8, schedule: .75 } as const;
export const OPENING_BOSS_DAMAGE = 2;

export function assaultOperation(base: OperationProfile, hundred = false): OperationProfile {
  const scale = ASSAULT_TUNING.schedule;
  const bossAt = hundred ? base.bossAt * scale : base.waves.length * base.interval * scale + 15;
  return { ...base, interval: base.interval * scale, groupInterval: base.groupInterval * scale,
    groupIntervals: base.groupIntervals?.map(value => value * scale), formationStep: .7 * scale,
    formations: base.formations?.map(groups => groups?.map(group => ({ ...group, offset: group.offset * scale })) ?? null),
    bossAt, deadline: bossAt + (base.deadline - base.bossAt),
  };
}
