import { mkdirSync,writeFileSync } from 'node:fs';
import { CONTENT_VERSION,STAGES } from '../src/data/content';
import { MAIN_IDS,SIDE_IDS,CHALLENGES } from '../src/data/campaign';
import { CURRENT_BALANCE_VERSION } from '../src/data/assault-balance';
import { play } from './tactical-policy';
import { POOL } from '../src/data/forms';
import { DEEP_NODE_MAP } from '../src/data/deep-trees';
import { commanderProgress,COMMANDER_MAX_XP } from '../src/data/commander';
import { migrateCommander,commanderVictoryXp } from '../src/storage/commander';
import type { CharacterId,ChallengeId,RunConfig,StageId } from '../src/sim/types';

const seeds=process.argv.includes('--quick')?[101]:[101,211,307];
const starterSquad:CharacterId[]=['C02','C03','C05','C06'];
const fourSquad:CharacterId[]=['C02','C03','C04','C05'];
function commanderBefore(stage:StageId,difficulty:'easy'|'hard',challenge:ChallengeId){
  const past=stage.startsWith('X')?[...MAIN_IDS.slice(0,3),...SIDE_IDS.slice(0,SIDE_IDS.indexOf(stage))]:MAIN_IDS.slice(0,MAIN_IDS.indexOf(stage));
  const state=migrateCommander(past);
  if(difficulty==='hard')state.xp=Math.min(COMMANDER_MAX_XP,state.xp+commanderVictoryXp(stage)+40);
  if(challenge)state.xp=Math.min(COMMANDER_MAX_XP,state.xp+commanderVictoryXp(stage,'hard'));
  const level=commanderProgress(state).level;
  const nodes=['TEAM/0','TEAM/1','TEAM/2','TEAM/3','TEAM/8','TEAM/9','TEAM/10','TEAM/11','TEAM/4','TEAM/5','TEAM/6','TEAM/7'].slice(0,level-1);
  return {level,nodes};
}
const rows:any[]=[];
for(const stage of STAGES)for(const mode of [{difficulty:'easy' as const,challenge:null},{difficulty:'hard' as const,challenge:null},...(MAIN_IDS.includes(stage.id)?CHALLENGES.map(challenge=>({difficulty:'hard' as const,challenge})):[])])for(const seed of seeds){
  const {challenge,difficulty}=mode,commander=commanderBefore(stage.id,difficulty,challenge);
  const config:RunConfig={stageId:stage.id,difficulty,squadIds:challenge==='four'?fourSquad:[...starterSquad,'C04'],captainId:'C03',seed,challengeId:challenge,commanderNodes:commander.nodes};
  const result=play(config,CONTENT_VERSION,CURRENT_BALANCE_VERSION,'adaptive',true);
  rows.push({...result,stage:stage.id,difficulty,challenge,seed,wallHp:result.hp,choices:result.spent,commanderLevel:commander.level,commanderSkills:commander.nodes});
  console.log(`${stage.id} ${challenge??difficulty} #${seed}: ${result.outcome}, HP ${result.hp}`);
}
// Also protect the early challenge experience with the original four starter roles.
// Both rosters and policies are fixed before running; neither depends on seed or outcome.
const starterRows:any[]=[];
for(const stageId of MAIN_IDS.slice(0,6))for(const seed of seeds){
  const commander=commanderBefore(stageId,'hard','four');
  const result=play({stageId,difficulty:'hard',challengeId:'four',squadIds:starterSquad,captainId:'C03',seed,commanderNodes:commander.nodes},CONTENT_VERSION,CURRENT_BALANCE_VERSION,'control-first',true);
  starterRows.push({...result,stage:stageId,difficulty:'hard',challenge:'four',seed,wallHp:result.hp,choices:result.spent,commanderLevel:commander.level,commanderSkills:commander.nodes});
  console.log(`${stageId} starter four #${seed}: ${result.outcome}, HP ${result.hp}`);
}
const forms:any[]=[];
for(const f of POOL){
  // Cover crowd control, shield breaking and boss damage beside the subject form.
  const squad=[f.ownerId,...(['C03','C05','C02','C04','C06','C01'] as CharacterId[]).filter(id=>id!==f.ownerId)].slice(0,5);
  const result=play({stageId:'S12',squadIds:squad,captainId:f.ownerId,seed:101,forms:{[f.ownerId]:f.id},commanderNodes:commanderBefore('S12','easy',null).nodes},CONTENT_VERSION,CURRENT_BALANCE_VERSION,'adaptive',true);
  forms.push({...result,form:f.id,damage:result.damage[f.ownerId],points:result.plan?.filter(n=>DEEP_NODE_MAP[n].ownerId===f.ownerId).length});
  console.log(`${f.id}: ${result.outcome}`);
}
const passed=[...rows,...starterRows].every(r=>r.outcome==='victory'&&r.wallHp>0&&r.restored&&r.choices===r.pointBudget)&&forms.every(r=>r.outcome==='victory'&&r.restored&&r.hp>0&&r.damage>0);
const dir=process.env.VALIDATION_OUTPUT_DIR??`artifacts/validation/${CONTENT_VERSION}`;mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/campaign-balance${seeds.length===1?'-quick':''}.json`,JSON.stringify({version:CONTENT_VERSION,balanceVersion:CURRENT_BALANCE_VERSION,experienceVersion:4,method:'All 15 easy/hard stages and 36 hard challenges use current production rules and legal adaptive character-only allocations. Four-person role squad: C02/C03/C04/C05; five-person squad: C02/C03/C05/C06/C04. Additional S01–S06 starter four-person squad C02/C03/C05/C06 uses a fixed shield/control opening, then adaptive choices. All original forms. Commander XP uses preceding easy first clears plus current easy/hard victories required to unlock each mode. Point budgets come from each actual operation profile. No HP/XP/enemy overrides or manual commander casts. Ten forms with C03/C05/C02/C04 support on S12. Save/restore after at least six spent points.',passed,seeds,rows,starterRows,forms},null,2));
console.log({passed,campaignRuns:rows.length,starterRuns:starterRows.length,formRuns:forms.length});if(!passed)process.exitCode=1;
