import { highPressure, pressureMode } from '../data/high-pressure';
import { difficultyTuning as originalDifficulty, pressure as originalPressure } from './difficulty-v1';
import type { RunState } from './types';
export { usesPressureRules } from './difficulty-v1';

export const difficultyTuning = (s: Pick<RunState, 'config'|'balanceVersion'>) => originalDifficulty(s.balanceVersion === 2 ? {...s,balanceVersion:1} : s);
export function pressure(s: Pick<RunState, 'contentVersion'|'config'|'balanceVersion'>) {
  if (s.balanceVersion !== 2) return originalPressure(s);
  const base = originalPressure({...s,balanceVersion:1});
  const tuning = highPressure(s.config.stageId, pressureMode(s.config));
  return { ...base, health:base.health*tuning.health, speed:base.speed*tuning.speed,
    bossHealth:base.bossHealth*tuning.bossHealth, bossDamage:base.bossDamage*tuning.bossDamage, bossInterval:base.bossInterval*tuning.bossInterval };
}
