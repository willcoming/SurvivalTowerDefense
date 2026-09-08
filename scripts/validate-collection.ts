import { mkdirSync,writeFileSync } from 'node:fs';
import { CONTENT_VERSION,STAGES } from '../src/data/content';
import { MAIN_IDS,SIDE_IDS,CHALLENGES } from '../src/data/campaign';
import { stageProfile } from '../src/data/progression';
import { POOL } from '../src/data/forms';
import { DEEP_NODE_MAP } from '../src/data/deep-trees';
import { commanderProgress,COMMANDER_MAX_XP } from '../src/data/commander';
import { migrateCommander,commanderVictoryXp } from '../src/storage/commander';
import { pathTo,playDeep,buildPlan,fillCharacterPlan } from '../tests/helpers/deep-build';
import type { CharacterId,ChallengeId,RunConfig,StageId } from '../src/sim/types';

const seeds=process.argv.includes('--quick')?[101]:[101,211,307];
const starterSquad:CharacterId[]=['C02','C03','C05','C06'];
function starterPlan(challenge:ChallengeId,squad:CharacterId[],stage:StageId){
  const shieldBoss=['S02','S05','S07','S11','X02'].includes(stage);
  const paths=['C05-B/7',shieldBoss?'C02-A/9':'C03-B/8',...(challenge==='two-evolutions'?[]:[shieldBoss?'C03-B/8':'C02-A/9'])].map(pathTo),plan=paths.flat();
  return fillCharacterPlan(plan,squad);
}
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
  const config:RunConfig={stageId:stage.id,difficulty,squadIds:challenge==='four'?starterSquad:[...starterSquad,'C04'],captainId:'C03',seed,challengeId:challenge,commanderNodes:commander.nodes};
  const {s,restored}=playDeep(config,starterPlan(challenge,config.squadIds,stage.id),true);rows.push({stage:stage.id,difficulty,challenge,seed,outcome:s.outcome,wallHp:s.wallHp,seconds:s.tick/30,restored,choices:s.choicesSpent,commanderLevel:commander.level,commanderSkills:commander.nodes});
  console.log(`${stage.id} ${challenge??difficulty} #${seed}: ${s.outcome}, HP ${Math.round(s.wallHp)}`);
}
const forms:any[]=[];
for(const f of POOL){const terminal=f.ownerId==='C07'?'C07-A/8':f.ownerId==='C08'?'C08-B/8':({C01:'C01-A/9',C02:'C02-A/9',C03:'C03-B/8',C04:'C04-A/10',C05:'C05-B/7',C06:'C06-A/10'} as Record<string,string>)[f.ownerId],{squad,owner,plan}=buildPlan(terminal);
  const {s,restored}=playDeep({stageId:'S12',squadIds:squad,captainId:owner,seed:101,forms:{[owner]:f.id},commanderNodes:commanderBefore('S12','easy',null).nodes},plan,true);forms.push({form:f.id,outcome:s.outcome,damage:s.stats.damageByCharacter[owner],restored,points:s.treeNodes?.filter(n=>DEEP_NODE_MAP[n].ownerId===owner).length});console.log(`${f.id}: ${s.outcome}`);
}
const passed=rows.every(r=>r.outcome==='victory'&&r.restored&&r.choices===stageProfile(r.stage).points)&&forms.every(r=>r.outcome==='victory'&&r.restored&&r.damage>0);
const dir=`artifacts/validation/${CONTENT_VERSION}`;mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/campaign-balance${seeds.length===1?'-quick':''}.json`,JSON.stringify({version:CONTENT_VERSION,method:'All 15 easy/hard stages and 36 hard challenges; starter originals and weighted character-only point plans. Commander XP uses preceding easy first clears plus current easy/hard victories required to unlock each mode; fixed legal permanent support policy. No run HP/XP overrides. Ten forms on S12. Save/restore after seven spent points.',passed,seeds,rows,forms},null,2));
console.log({passed,starterRuns:rows.length,formRuns:forms.length});if(!passed)process.exitCode=1;
