import { createRun } from '../tests/helpers/previous-tree-run';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SKILL_TREES, treesFor, NODE_MAP } from '../src/data/skill-trees';
import { command, stepRun, restoreRun } from '../src/sim/engine';
import { getLegalNodeIds } from '../src/sim/draft';
import { shouldAutoCast } from '../src/ui/auto-tactical';
import { replayDigest } from '../tests/simulation/runner';
import type { CharacterId, StageId, RunState } from '../src/sim/types';

const quick=process.argv.includes('--quick');
const dir=process.env.VALIDATION_OUTPUT_DIR??'artifacts/validation/skill-trees';mkdirSync(dir,{recursive:true});
const seeds=quick?[101]:[101,211,307,401,503,601,709,809,907,1009];
const stages:StageId[]=['S01','S02','S03'];
const complementary:Record<string,[string,number]>={'C01-A':['C01-C',1],'C01-B':['C01-A',1],'C01-C':['C01-A',1],'C02-A':['C02-B',1],'C02-B':['C02-A',1],'C03-A':['C03-B',1],'C03-B':['C03-A',1],'C04-A':['C04-B',1],'C04-B':['C04-A',1],'C05-A':['C05-B',1],'C05-B':['C05-A',2],'C06-A':['C06-B',1],'C06-B':['C06-A',1],'C06-C':['C06-A',1]};
function buildPlan(subject:string,budget:number,squad:CharacterId[]) {
  const owner=subject.slice(0,3) as CharacterId;
  const supportCore=['C03-B','C05-B','C02-A'].filter(t=>t.slice(0,3)!==owner&&squad.includes(t.slice(0,3) as CharacterId)).slice(0,2);
  const cores=[subject,...supportCore];const plan:string[]=[];
  for(const index of [0,1,2,3])for(const core of cores){const parts=core==='C01-A'?[0,1,3,4]:[0,1,2,4];plan.push(`${core}:${parts[index]}`);}
  const support=squad.filter(id=>!cores.some(t=>t.startsWith(id)));
  if(budget===6){const [other,part]=complementary[subject];plan.push(`${other}:0`,`${other}:${part}`);}
  for(const id of support) {const t=treesFor(id)[0].id;plan.push(`${t}:0`);if(budget===4)plan.push(`${t}:1`);}
  plan.push('G01-1','G01-2');
  if(plan.length!==18)throw new Error(`plan length ${plan.length}`);
  return plan;
}
function replay(sample: RunState) {
  const state=createRun(sample.config);let cursor=0;
  for(let guard=0;guard<17000&&!state.outcome;guard++) {
    while(sample.actions[cursor]?.tick===state.tick) {if(!command(state,sample.actions[cursor++].command))throw new Error('Replay rejected action');}
    if(state.outcome)break;if(state.pauseReasons.length)throw new Error('Replay stalled');stepRun(state);
  }
  return cursor===sample.actions.length&&replayDigest(state)===replayDigest(sample);
}
function simulate(subject:string,budget:number,stageId:StageId,seed:number) {
  const owner=subject.slice(0,3) as CharacterId;
  const squad=[owner,...(['C02','C03','C04','C05','C06','C01'] as CharacterId[]).filter(id=>id!==owner)].slice(0,5);
  const state=createRun({stageId,squadIds:squad,captainId:owner,seed});const plan=buildPlan(subject,budget,squad);
  let peakEnemies=0,recovered=false,bossDeadAt:number|null=null;
  for(let guard=0;guard<17000&&!state.outcome;guard++) {
    if(state.draft){const nodeId=plan[state.choicesSpent];if(!getLegalNodeIds(state).includes(nodeId))throw new Error(`Illegal policy ${subject} ${nodeId}`);
      if(!command(state,{type:'custom-node',nodeId})||!command(state,{type:'choose',offerId:state.draft.id,nodeId}))throw new Error('Choice rejected');
      if(state.choicesSpent===7){const restored=restoreRun(state);if(JSON.stringify(restored)!==JSON.stringify(state))throw new Error('Restore drift');recovered=true;}
      continue;
    }
    if(state.bossIntro){command(state,{type:'finish-boss-intro'});continue;}
    if(shouldAutoCast(state,true))command(state,{type:'cast'});
    stepRun(state);peakEnemies=Math.max(peakEnemies,state.enemies.length);if(state.bossKilled&&bossDeadAt===null)bossDeadAt=state.tick;
  }
  const total=(row:Record<string,number>)=>Object.values(row).reduce((a,b)=>a+b,0);
  const report={subject,budget,stageId,seed,squad,treeCount:treesFor(owner).length,outcome:state.outcome,seconds:state.tick/30,bossSeconds:bossDeadAt===null?null:(bossDeadAt-10800)/30,wallLoss:total(state.stats.wallDamageByEnemy),wallHp:state.wallHp,shieldAbsorbed:state.stats.shieldAbsorbed,subjectDamage:state.stats.damageByCharacter[owner],subjectShieldDamage:state.stats.shieldDamageByCharacter[owner],subjectControlSeconds:state.stats.controlTicks[owner]/30,teamDamage:total(state.stats.damageByCharacter),peakEnemies,choices:state.choicesSpent,evolutions:state.evolvedCount,subjectNodes:state.treeNodes?.filter(n=>NODE_MAP[n].ownerId===owner).length,plan,recovered};
  if(seed===101&&stageId==='S03') {if(!replay(state))throw new Error('Replay mismatch');writeFileSync(`${dir}/replay-${subject}-${budget}.json`,JSON.stringify({config:state.config,actions:state.actions,digest:replayDigest(state),report},null,2));}
  return report;
}
const rows: ReturnType<typeof simulate>[]=[];
for(const tree of SKILL_TREES)for(const budget of [4,6]) {
  for(const stage of stages)for(const seed of seeds)rows.push(simulate(tree.id,budget,stage,seed));
  const sample=rows.filter(r=>r.subject===tree.id&&r.budget===budget);
  console.log(`${tree.id} / ${budget} pts: ${sample.filter(r=>r.outcome==='victory').length}/${sample.length} wins`);
}
const mean=(values:number[])=>values.reduce((a,b)=>a+b,0)/values.length;
const summary=SKILL_TREES.flatMap(t=>[4,6].flatMap(budget=>stages.map(stageId=>{
  const samples=rows.filter(r=>r.subject===t.id&&r.budget===budget&&r.stageId===stageId);
  return {tree:t.id,name:t.name,budget,stageId,runs:samples.length,wins:samples.filter(r=>r.outcome==='victory').length,wallLoss:mean(samples.map(r=>r.wallLoss)),seconds:mean(samples.map(r=>r.seconds)),bossSeconds:mean(samples.map(r=>r.bossSeconds??120)),damage:mean(samples.map(r=>r.subjectDamage)),shieldDamage:mean(samples.map(r=>r.subjectShieldDamage)),controlSeconds:mean(samples.map(r=>r.subjectControlSeconds)),shieldAbsorbed:mean(samples.map(r=>r.shieldAbsorbed))};
})));
const playable=SKILL_TREES.every(t=>summary.some(r=>r.tree===t.id&&r.wins/r.runs>=.8));
const result={playable,policy:'skill-trees-v2',createdAt:new Date().toISOString(),formal:!quick,sourceDigest:createHash('sha256').update(['src/data/skill-trees.ts','src/sim/tree-weapons.ts','src/sim/skill-tree.ts','scripts/validate-skill-trees.ts'].map(p=>readFileSync(p,'utf8')).join('\n')).digest('hex'),method:'Legal commands only; fixed squad per subject; subject captain; 18 total picks, 4 or 6 subject nodes; 3 stages × 10 paired seeds. Restore at choice 7, exact command replay for S03/101. No combat state overrides.',summary,rows};
writeFileSync(`${dir}/${quick?'exploratory':'balance'}.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({runs:rows.length,wins:rows.filter(r=>r.outcome==='victory').length,allChoices:rows.every(r=>r.choices===18),allSubjectBudgets:rows.every(r=>r.subjectNodes===r.budget),allRecovered:rows.every(r=>r.recovered)}));
if(!playable||rows.some(r=>r.choices!==18||r.subjectNodes!==r.budget||!r.recovered))process.exitCode=1;
