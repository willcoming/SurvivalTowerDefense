import type { RunState } from '../sim/types';

export const EARLY_PRESSURE = { base: 18, baseGrowth: .4, bossStart: .65, bossGrowth: .05 } as const;
// A rear-flank approach gives B01 time to attack. Smaller hits leave room to recover.
export const EARLY_BOSS_APPROACH = { x: 290, y: 115, damage: .5, constrainedDamage: .45 } as const;
// S03's longer boss fight must leave room for builds that lack sustained control.
export const EARLY_ELITE_BOSS_DAMAGE = .7;
const ORIGINAL_BOSS_POSITION = { x: 195, y: 150 } as const;
type Encounter = Pick<RunState, 'config' | 'balanceVersion'>;

export const usesEarlyOpening = (state: Encounter) =>
  state.balanceVersion === 7 && state.config.mode !== 'hundred' && state.config.stageId === 'S01';

export const bossPosition = (state: Encounter) =>
  usesEarlyOpening(state) ? EARLY_BOSS_APPROACH : ORIGINAL_BOSS_POSITION;

export function earlyBossDamage(state: Encounter): number {
  if (state.balanceVersion !== 7 || state.config.mode === 'hundred') return 1;
  if (state.config.stageId === 'S03') return EARLY_ELITE_BOSS_DAMAGE;
  if (!usesEarlyOpening(state)) return 1;
  return state.config.challengeId === 'four' || state.config.challengeId === 'no-skill'
    ? EARLY_BOSS_APPROACH.constrainedDamage : EARLY_BOSS_APPROACH.damage;
}
