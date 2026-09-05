import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { FREE_CONTENT_VERSION, DEEP_NODE_MAP } from '../src/data/deep-trees';
import { ALL_TERMINALS, buildPlan, playDeep, replayDeep } from '../tests/helpers/deep-build';
import type { StageId,RunState } from '../src/sim/types';
const dir=process.env.VALIDATION_OUTPUT_DIR??'artifacts/validation/free-skills';mkdirSync(dir,{recursive:true});
const quick=process.argv.includes('--quick'),seeds=quick?[101]:[101,211,307,401,503,601,709,809,907,1009];
const digest=(s:RunState)=>{const {runId,...state}=s;return createHash('sha256').update(JSON.stringify(state)).digest('hex');};
type BalanceRow={terminal:string;name:string;tree:string;budget:number;stageId:StageId;seed:number;outcome:RunState['outcome'];choices:number;subjectNodes:number;seconds:number;bossSeconds:number|null;wallLoss:number;wallHp:number;damage:number;controlSeconds:number;shieldAbsorbed:number;repaired:number;prevented:number;restored:boolean};
const rows:BalanceRow[]=[];let replays=0;
for(const terminal of ALL_TERMINALS)for(const budget of [5,7]){
  const {squad,owner,plan}=buildPlan(terminal.id,budget),summary=[];
  for(const stageId of ['S01','S02','S03'] as StageId[])for(const seed of seeds){
    const {s,restored,bossDeadAt}=playDeep({stageId,squadIds:squad,captainId:owner,seed},plan,true);
    const row={terminal:terminal.id,name:terminal.name,tree:terminal.treeId,budget,stageId,seed,outcome:s.outcome,choices:s.choicesSpent,subjectNodes:s.treeNodes!.filter(n=>DEEP_NODE_MAP[n].ownerId===owner).length,seconds:s.tick/30,bossSeconds:bossDeadAt===null?null:(bossDeadAt-10800)/30,wallLoss:Object.values(s.stats.wallDamageByEnemy).reduce((a,b)=>a+b,0),wallHp:s.wallHp,damage:s.stats.damageByCharacter[owner],controlSeconds:s.stats.controlTicks[owner]/30,shieldAbsorbed:s.stats.shieldAbsorbed,repaired:s.support!.repaired,prevented:s.support!.prevented,restored};rows.push(row);summary.push(row);
    if(stageId==='S03'&&seed===101){const replay=replayDeep(s);if(digest(replay)!==digest(s))throw new Error(`Replay drift ${terminal.id}`);replays++;writeFileSync(`${dir}/replay-${terminal.id.replace('/','-')}-${budget}.json`,JSON.stringify({config:s.config,actions:s.actions,digest:digest(s),row},null,2));}
  }
  console.log(`${terminal.name} / ${budget} pts: ${summary.filter(r=>r.outcome==='victory').length}/${summary.length}`);
}
const groups=ALL_TERMINALS.flatMap(t=>[5,7].flatMap(budget=>(['S01','S02','S03'] as StageId[]).map(stageId=>{
  const rs=rows.filter(r=>r.terminal===t.id&&r.budget===budget&&r.stageId===stageId),mean=(f:(r:typeof rs[number])=>number)=>rs.reduce((n,r)=>n+f(r),0)/rs.length;
  return {terminal:t.id,name:t.name,budget,stageId,runs:rs.length,wins:rs.filter(r=>r.outcome==='victory').length,wallLoss:mean(r=>r.wallLoss),bossSeconds:mean(r=>r.bossSeconds??120),damage:mean(r=>r.damage),controlSeconds:mean(r=>r.controlSeconds),shieldAbsorbed:mean(r=>r.shieldAbsorbed),repaired:mean(r=>r.repaired)};
})));
const playable=ALL_TERMINALS.every(t=>groups.some(g=>g.terminal===t.id&&g.wins/g.runs>=.8));
const report={contentVersion:FREE_CONTENT_VERSION,policy:'free-skills-v1',formal:!quick,createdAt:new Date().toISOString(),method:'25 ultimates × 5/7 subject points × 3 stages × 10 paired seeds. 24 total points, fixed squad per owner, subject captain. Legal XP, enemies, actions, automatic captain after initial cooldown. Save/restore at point 7, 50 full command replays. No HP, XP or combat overrides.',playable,replays,sourceDigest:createHash('sha256').update(['src/data/deep-trees.ts','src/sim/deep-weapons.ts','src/sim/combat.ts','src/sim/engine.ts','src/sim/operations.ts','tests/helpers/deep-build.ts'].map(p=>readFileSync(p)).join('\n')).digest('hex'),groups,rows};
writeFileSync(`${dir}/${quick?'exploratory':'balance'}.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({runs:rows.length,wins:rows.filter(r=>r.outcome==='victory').length,playable,replays,allRecovered:rows.every(r=>r.restored),allWinningBudgets:rows.filter(r=>r.outcome==='victory').every(r=>r.choices===24&&r.subjectNodes===r.budget)}));
if(!playable||rows.some(r=>!r.restored||r.outcome==='victory'&&(r.choices!==24||r.subjectNodes!==r.budget)))process.exitCode=1;
