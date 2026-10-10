/** Version 4: 1.25x wave durability and 1.8x damage; 25% shorter wave intervals.
 * The 3x figure describes HP × damage / interval, not a guaranteed win-rate ratio.
 * Boss telegraph duration, player damage, XP and skill-point budgets stay intact.
 */
import type { OperationProfile } from './progression';
import type { RunConfig, RunState } from '../sim/types';
import type { FormationGroup } from './tactical-encounters';
export const CURRENT_BALANCE_VERSION = 7;
export const ASSAULT_TUNING = { health: 1.25, damage: 1.8, schedule: .75 } as const;
export const OPENING_BOSS_DAMAGE = 2;
export const ADVANCED_TUNING = { health: .88, damage: .88, specialistGap: 3 } as const;

const advanced = (config: Pick<RunConfig, 'difficulty'|'challengeId'|'mode'>) => config.mode !== 'hundred' && (config.difficulty === 'hard' || !!config.challengeId);
export const usesAdvancedRelief = (s: Pick<RunState, 'config'|'balanceVersion'>) => (s.balanceVersion === 6 || s.balanceVersion === 7) && advanced(s.config);

/** Version 6 keeps bodies, rewards and wave count, but spreads specialist pressure. */
export function advancedOperation(base: OperationProfile, config: Pick<RunConfig, 'difficulty'|'challengeId'|'mode'>): OperationProfile {
  if (!advanced(config)) return base;
  const formations: (FormationGroup[] | null)[] = [];
  const waves = base.waves.map((wave, index) => {
    const entries = wave.split(' ').map(token => [token[0], Number(token.slice(1))] as const);
    const counts = Object.fromEntries(entries), total = entries.reduce((n, [, count]) => n + count, 0);
    // Constrained squads retain each threat type without a wall of armored bodies.
    const armorShare = config.challengeId === 'four' || config.challengeId === 'no-skill' ? .20 : .25;
    for (const [code, cap] of [['P', Math.ceil(total * armorShare)], ['H', 1], ['D', 1]] as const) {
      const removed = Math.max(0, (counts[code] ?? 0) - cap);
      if (removed) { counts[code] -= removed; counts.C = (counts.C ?? 0) + removed; }
    }
    const groups = base.formations?.[index];
    if (!groups) { formations.push(null); return Object.entries(counts).filter(([, count]) => count).map(([code, count]) => `${code}${count}`).join(' '); }
    const remaining = { ...counts }, result: FormationGroup[] = [];
    let nextSpecialist = 0;
    for (const group of [...groups].sort((a, b) => a.offset - b.offset)) {
      const count = group.code === 'C' ? remaining.C : Math.min(group.count, remaining[group.code] ?? 0);
      remaining[group.code] -= count;
      if (['P', 'H', 'D'].includes(group.code)) {
        for (let consumed = 0; consumed < count; consumed += 2) {
          const offset = Math.max(group.offset, nextSpecialist);
          result.push({ ...group, count: Math.min(2, count - consumed), offset });
          nextSpecialist = offset + ADVANCED_TUNING.specialistGap;
        }
      } else if (count) result.push({ ...group, count });
    }
    if (remaining.C) result.push({ code: 'C', count: remaining.C, offset: 3, lane: 1 });
    formations.push(result);
    return Object.entries(counts).filter(([, count]) => count).map(([code, count]) => `${code}${count}`).join(' ');
  });
  return { ...base, waves, formations };
}

export function assaultOperation(base: OperationProfile, hundred = false): OperationProfile {
  const scale = ASSAULT_TUNING.schedule;
  const bossAt = hundred ? base.bossAt * scale : base.waves.length * base.interval * scale + 15;
  return { ...base, interval: base.interval * scale, groupInterval: base.groupInterval * scale,
    groupIntervals: base.groupIntervals?.map(value => value * scale), formationStep: .7 * scale,
    formations: base.formations?.map(groups => groups?.map(group => ({ ...group, offset: group.offset * scale })) ?? null),
    bossAt, deadline: bossAt + (base.deadline - base.bossAt),
  };
}
