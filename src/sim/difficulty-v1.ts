import { STAGE_MAP } from '../data/content';
import type { RunState } from './types';

export const difficultyTuning = (s: Pick<RunState, 'config'|'balanceVersion'>) => s.config.difficulty === 'hard'
  ? {health:s.balanceVersion===1?1.4:1.5,damage:1.25} : {health:1,damage:1};

/** Versioned so deterministic historical simulations keep their original rules. */
export const usesPressureRules = (s: Pick<RunState, 'contentVersion'>) => ['0.6.0-dev.3','0.6.0-dev.2','0.6.0-dev.1','0.4.0-dev.2','0.5.0-dev.1','0.5.0-dev.2'].includes(s.contentVersion);
export function pressure(s: Pick<RunState, 'contentVersion' | 'config' | 'balanceVersion'>) {
  if (!usesPressureRules(s)) return { health:1, speed:1, numbers:1, bossHealth:1, bossDamage:1, bossInterval:1 };
  const number = Number(s.config.stageId.slice(1));
  const progress = s.config.stageId.startsWith('X') ? (number - 1) / 4 : (number - 1) / 11;
  if(s.balanceVersion===1){
    const boss=STAGE_MAP[s.config.stageId].bossId;
    return {health:1.04+progress*.06,speed:1.04+progress*.02,numbers:1,bossHealth:boss==='B01'?1.45:boss==='B02'?1.12:1,bossDamage:boss==='B01'?1.7:boss==='B02'?1.35:1.15,bossInterval:boss==='B01'?.65:.8};
  }
  return { health:1.06 + progress * .06, speed:1.03, numbers:1.08,
    bossHealth:1.25, bossDamage:1.15, bossInterval:.8 };
}
