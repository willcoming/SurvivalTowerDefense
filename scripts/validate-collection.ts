import { mkdirSync,writeFileSync } from 'node:fs';
import { CONTENT_VERSION,STAGES } from '../src/data/content';
import { MAIN_IDS,CHALLENGES } from '../src/data/campaign';
import { POOL } from '../src/data/forms';
import { DEEP_NODE_MAP } from '../src/data/deep-trees';
import { pathTo,playDeep,buildPlan } from '../tests/helpers/deep-build';
import type { CharacterId,ChallengeId,RunConfig } from '../src/sim/types';

const seeds=process.argv.includes('--quick')?[101]:[101,211,307];
const starterSquad:CharacterId[]=['C02','C03','C05','C06'];
function starterPlan(challenge:ChallengeId){
  const paths=['C03-B/8','C05-B/7',...(challenge==='two-evolutions'?[]:['C02-A/9'])].map(pathTo),plan:string[]=[];
  for(let i=0;i<5;i++)for(const p of paths)plan.push(p[i]);
  for(const id of ['TEAM/0','TEAM/1','TEAM/2','TEAM/3','C06-C/0','C06-C/1','C06-C/2','C06-C/3','TEAM/8','TEAM/9','TEAM/10','TEAM/11','C02-A/0','C02-A/1','C02-A/2','C02-A/3','C03-A/0','C05-A/0'])if(!plan.includes(id)&&plan.length<24)plan.push(id);
  if(plan.length!==24)throw new Error('Invalid starter policy');return plan;
}
const rows:any[]=[];
for(const stage of STAGES)for(const challenge of [null,...(MAIN_IDS.includes(stage.id)?CHALLENGES:[])] as ChallengeId[])for(const seed of seeds){
  const config:RunConfig={stageId:stage.id,squadIds:challenge==='four'?starterSquad:[...starterSquad,'C04'],captainId:'C03',seed,challengeId:challenge};
  const {s,restored}=playDeep(config,starterPlan(challenge),true);rows.push({stage:stage.id,challenge,seed,outcome:s.outcome,wallHp:s.wallHp,seconds:s.tick/30,restored,choices:s.choicesSpent});
  console.log(`${stage.id} ${challenge??'story'} #${seed}: ${s.outcome}, HP ${Math.round(s.wallHp)}`);
}
const forms:any[]=[];
for(const f of POOL){const terminal=f.ownerId==='C07'?'C07-A/8':f.ownerId==='C08'?'C08-B/8':({C01:'C01-A/9',C02:'C02-A/9',C03:'C03-B/8',C04:'C04-A/10',C05:'C05-B/7',C06:'C06-A/10'} as Record<string,string>)[f.ownerId],{squad,owner,plan}=buildPlan(terminal);
  const {s,restored}=playDeep({stageId:'S12',squadIds:squad,captainId:owner,seed:101,forms:{[owner]:f.id}},plan,true);forms.push({form:f.id,outcome:s.outcome,damage:s.stats.damageByCharacter[owner],restored,points:s.treeNodes?.filter(n=>DEEP_NODE_MAP[n].ownerId===owner).length});console.log(`${f.id}: ${s.outcome}`);
}
const passed=rows.every(r=>r.outcome==='victory'&&r.restored&&r.choices===24)&&forms.every(r=>r.outcome==='victory'&&r.restored&&r.damage>0);
const dir=`artifacts/validation/${CONTENT_VERSION}`;mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/campaign-balance${seeds.length===1?'-quick':''}.json`,JSON.stringify({version:CONTENT_VERSION,method:'All 51 unique reward objectives, four/five starter originals, fixed legal 24-point plan; no HP/XP overrides; all ten pool forms on S12 with representative legal builds. Save/restore after seven purchases.',passed,seeds,rows,forms},null,2));
console.log({passed,starterRuns:rows.length,formRuns:forms.length});if(!passed)process.exitCode=1;
