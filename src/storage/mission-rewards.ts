import type { ChallengeId, RunState, StageId } from '../sim/types';
import type { CollectionState } from './collection';
import type { GameSave } from './repository';
import { MAIN_IDS, SIDE_IDS } from '../data/campaign';

export type Difficulty = 'easy' | 'hard';
export const EASY_CAMPAIGN = [...MAIN_IDS, ...SIDE_IDS];
export function easyClearedStages(save:GameSave):StageId[] {
  if(save.profile.easyCleared)return [...save.profile.easyCleared];
  // Legacy campaign wins were easy; explicit hard-only entitlements do not count.
  return EASY_CAMPAIGN.filter(id=>save.profile.cleared.includes(id)&&(
    save.collection.difficultyClaims?.[`${id}:easy`]===undefined ||
    (save.collection.difficultyClaims?.[`${id}:easy`]??0)>0 ||
    save.profile.recentRuns.some(run=>run.stageId===id&&run.outcome==='victory'&&run.difficulty!=='hard')
  ));
}
export const hardUnlocked = (save:GameSave,id:StageId) => easyClearedStages(save).includes(id);
export function hardClearedStages(save:GameSave):StageId[] {
  return save.profile.hardCleared ?? EASY_CAMPAIGN.filter(id=>(save.collection.difficultyClaims?.[`${id}:hard`]??0)>0 || save.profile.recentRuns.some(run=>run.stageId===id&&run.outcome==='victory'&&run.difficulty==='hard'));
}
export const challengesUnlocked = (save:GameSave,id:StageId) => MAIN_IDS.includes(id)&&hardClearedStages(save).includes(id);
export const selectedDifficulty = (save:GameSave,id:StageId):Difficulty => save.preferences.difficulty==='hard'&&hardUnlocked(save,id)?'hard':'easy';
export const difficultyName = (difficulty?:Difficulty) => difficulty==='hard'?'困難':'簡單';
export const ratingTier = (run:RunState) => run.outcome!=='victory'?0:run.wallHp>=run.wallMaxHp?3:run.wallHp>=run.wallMaxHp*.5?2:run.wallHp>=run.wallMaxHp*.01?1:0;
export type RewardMode = Difficulty | 'challenge';
export const rewardMode = (difficulty:Difficulty,challengeId?:ChallengeId):RewardMode => challengeId?'challenge':difficulty;
export const rewardName = (mode:RewardMode) => mode==='easy'?'共鳴點數':'招募券';
export const rewardAmount = (mode:RewardMode,tier:number) => mode==='easy'?([25,25,50][tier-1]??0):tier*(mode==='challenge'?3:1);
export const rewardKey = (id:StageId,difficulty:Difficulty,challengeId?:ChallengeId) => challengeId?`${id}:challenge:${challengeId}`:`${id}:${difficulty}`;
export function claimedTier(c:CollectionState,id:StageId,difficulty:Difficulty,challengeId?:ChallengeId) {
  return c.difficultyClaims?.[rewardKey(id,difficulty,challengeId)] ?? (!challengeId&&difficulty==='easy'&&c.claimed.includes(`stage:${id}`)?1:0);
}
/** Preserve already claimed legacy tiers; new tiers follow the current reward table. */
export function awardDifficulty(c:CollectionState,run:RunState) {
  if(run.outcome!=='victory')return;
  const difficulty=run.config.difficulty??'easy',id=run.config.stageId,challengeId=run.config.challengeId,tier=ratingTier(run);
  const previous=claimedTier(c,id,difficulty,challengeId),mode=rewardMode(difficulty,challengeId),key=rewardKey(id,difficulty,challengeId);
  c.difficultyClaims??={};
  if(c.claimed.includes(`stage:${id}`)&&c.difficultyClaims[`${id}:easy`]===undefined)c.difficultyClaims[`${id}:easy`]=1;
  for(let milestone=previous+1;milestone<=tier;milestone++){
    if(mode==='easy')c.points+=rewardAmount(mode,milestone);else c.tickets+=rewardAmount(mode,milestone);
  }
  c.difficultyClaims[key]=Math.max(previous,tier);
  if(!c.claimed.includes(`stage:${id}`))c.claimed.push(`stage:${id}`);
  c.difficultyClaims[`${id}:easy`]??=0;
}
