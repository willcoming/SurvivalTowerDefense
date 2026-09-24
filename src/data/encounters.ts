import { encounterPattern as versionOnePattern, encounterWeights as versionOneWeights, STAGE_ENCOUNTERS, ENCOUNTER_PATTERNS } from './encounters-v1';
import { highPressure, pressureMode } from './high-pressure';
import type { ChallengeId, RunConfig } from '../sim/types';
export { STAGE_ENCOUNTERS, ENCOUNTER_PATTERNS };
export type { EncounterKind, EncounterPattern } from './encounters-v1';
export interface EncounterContext { balanceVersion?:1|2|3; difficulty?:RunConfig['difficulty']; challengeId?:ChallengeId }

export function encounterPattern(stage: Parameters<typeof versionOnePattern>[0], wave: number, context: EncounterContext = {}) {
  const pattern = versionOnePattern(stage, wave);
  if (context.balanceVersion === 1 || wave === 1) return pattern;
  const tuning = highPressure(stage, pressureMode(context));
  const respite = STAGE_ENCOUNTERS[stage].plan[wave-1] === 'respite';
  return { ...pattern, groupInterval: Math.max(1, pattern.groupInterval * tuning.groupInterval),
    ...(respite ? { name:'補給線交火', hint:'這段敵群仍有護送火力，補齊下一輪反制時別中斷清場。' } : {}) };
}

export function encounterWeights(stage: Parameters<typeof versionOnePattern>[0], wave: number, context: EncounterContext = {}) {
  const weights = versionOneWeights(stage, wave, context.difficulty);
  if (context.balanceVersion === 1 || wave === 1) return weights;
  const tuning = highPressure(stage, pressureMode(context));
  const strength = tuning.composition * (wave <= 3 ? .5 : 1);
  weights.C = Math.max(2, (weights.C ?? 0) * (1-strength));
  for (const code of ['R','P','S','A','M','H','D']) if (weights[code]) weights[code] *= 1+strength;
  if (STAGE_ENCOUNTERS[stage].plan[wave-1] === 'respite') {
    weights.A = (weights.A??0) + strength*8;
    weights.P = strength*6;
  }
  return weights;
}
