import { COMMANDER_MAX_XP, commanderProgress, createCommander, type CommanderReward, type CommanderState } from '../data/commander';
import { stageProfile } from '../data/progression';
import type { RunState,StageId } from '../sim/types';

export const commanderVictoryXp=(id:StageId,difficulty?:'easy'|'hard',challenge=false)=>Math.round((40+stageProfile(id).waves.length*10)*(challenge?1.5:difficulty==='hard'?1.25:1));
/** Existing completed stages receive their first-clear XP once when this system is introduced. */
export function migrateCommander(cleared:StageId[]):CommanderState {
  const state=createCommander();state.firstClears=[...new Set(cleared)];
  state.xp=Math.min(COMMANDER_MAX_XP,state.firstClears.reduce((sum,id)=>sum+commanderVictoryXp(id)+40,0));return state;
}
export function awardCommander(state:CommanderState,run:RunState):CommanderReward {
  const beforeLevel=commanderProgress(state).level;
  const result:CommanderReward={xp:0,beforeLevel,afterLevel:beforeLevel,points:0,firstClear:false};
  if(!run.outcome||run.outcome==='abandoned'||state.creditedRunIds.includes(run.runId))return result;
  const victory=run.outcome==='victory',firstClear=victory&&!state.firstClears.includes(run.config.stageId);
  const base=commanderVictoryXp(run.config.stageId,run.config.difficulty,!!run.config.challengeId);
  // Failures award at most a quarter of normal completion XP, based on kills rather than elapsed time.
  const xp=victory?base+(firstClear?40:0):Math.floor(base*.25*Math.min(1,run.stats.kills/Math.max(1,run.spawnPlan.length)));
  result.xp=Math.min(xp,COMMANDER_MAX_XP-state.xp);state.xp+=result.xp;
  state.creditedRunIds.push(run.runId);
  if(firstClear)state.firstClears.push(run.config.stageId);
  result.firstClear=firstClear;result.afterLevel=commanderProgress(state).level;result.points=result.afterLevel-beforeLevel;return result;
}
