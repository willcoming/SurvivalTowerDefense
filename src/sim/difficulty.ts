import type { RunState } from './types';

export const difficultyTuning = (s: Pick<RunState, 'config'>) => s.config.difficulty === 'hard'
  ? {health:1.5,damage:1.25} : {health:1,damage:1};

/** Versioned so deterministic historical simulations keep their original rules. */
export const usesPressureRules = (s: Pick<RunState, 'contentVersion'>) => s.contentVersion === '0.4.0-dev.2';
export function pressure(s: Pick<RunState, 'contentVersion' | 'config'>) {
  if (!usesPressureRules(s)) return { health:1, speed:1, numbers:1, bossHealth:1, bossDamage:1, bossInterval:1 };
  const number = Number(s.config.stageId.slice(1));
  const progress = s.config.stageId.startsWith('X') ? (number - 1) / 4 : (number - 1) / 11;
  return { health:1.06 + progress * .06, speed:1.03, numbers:1.08,
    bossHealth:1.25, bossDamage:1.15, bossInterval:.8 };
}
