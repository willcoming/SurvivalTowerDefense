import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DEEP_NODE_MAP } from '../src/data/deep-trees';
import { CONTENT_VERSION } from '../src/data/content';
import { resolveSkillNode } from '../src/data/reworked-skills';
import { operationProfile } from '../src/data/progression';
import { deepPointCost } from '../src/sim/deep-tree';
import { createRun } from '../src/sim/engine';
import { CURRENT_TERMINALS, buildCurrentPlan, playDeep, replayDeep } from '../tests/helpers/deep-build';
import baseline from '../tests/fixtures/free-balance-v6.json';
import type { StageId, RunState, FormId } from '../src/sim/types';

const dir=process.env.VALIDATION_OUTPUT_DIR??`artifacts/validation/${CONTENT_VERSION}/free-skills`;
mkdirSync(dir,{recursive:true});
const quick=process.argv.includes('--quick'),seeds=quick?[101]:[101,211,307,401,503,601,709,809,907,1009];
const stages:StageId[]=['S01','S02','S03'],subjectBudgets=[6,8],themes=['original','summer'] as const;
const digest=(s:RunState)=>{const {runId,...state}=s;return createHash('sha256').update(JSON.stringify(state)).digest('hex');};
type BalanceRow={terminal:string;name:string;tree:string;form:FormId;budget:number;totalBudget:number;stageId:StageId;seed:number;outcome:RunState['outcome'];choices:number;earned:number;subjectNodes:number;subjectPoints:number;seconds:number;bossSeconds:number|null;wallLoss:number;wallHp:number;damage:number;controlSeconds:number;shieldAbsorbed:number;repaired:number;prevented:number;restored:boolean;operationVersion?:number;balanceVersion?:number;experienceVersion?:number};
type BaselineCase={terminal:string;form:string;budget:number;stageId:string;seed:number};
function compareBaselineWins(results:readonly (BaselineCase&{outcome:RunState['outcome']})[],full:boolean){
  const key=(row:BaselineCase)=>JSON.stringify([row.terminal,row.form,row.budget,row.stageId,row.seed]);
  const baselineIds=new Set(baseline.winningCases.map(key));
  if(baseline.source.balanceVersion!==6||baseline.source.cases!==960||baseline.source.victories!==955||baselineIds.size!==955||baseline.winningCases.length!==955||baseline.excludedCases.some(row=>baselineIds.has(key(row))))throw new Error('Invalid free-skills v6 winning-case baseline');
  const actual=new Map<string,(BaselineCase&{outcome:RunState['outcome']})[]>();
  for(const row of results){const id=key(row);if(baselineIds.has(id))actual.set(id,[...(actual.get(id)??[]),row]);}
  const missingBaselineCases=baseline.winningCases.filter(row=>!actual.has(key(row)));
  const duplicateBaselineCases=baseline.winningCases.filter(row=>(actual.get(key(row))?.length??0)>1);
  const regressedBaselineCases=baseline.winningCases.flatMap(row=>(actual.get(key(row))??[]).filter(result=>result.outcome!=='victory').map(result=>({...row,outcome:result.outcome})));
  const comparedBaselineWins=actual.size;
  const preservedBaselineWins=baseline.winningCases.filter(row=>{const matches=actual.get(key(row));return matches?.length===1&&matches[0].outcome==='victory';}).length;
  const baselineRequiredWins=full?baselineIds.size:comparedBaselineWins;
  const baselineComparisonPass=preservedBaselineWins===baselineRequiredWins&&duplicateBaselineCases.length===0;
  return {baselineBalanceVersion:baseline.source.balanceVersion,baselineReportSha256:baseline.source.reportSha256,baselineSourceDigest:baseline.source.sourceDigest,baselineWinningCases:baselineIds.size,baselineRequiredWins,comparedBaselineWins,preservedBaselineWins,baselineCoverageComplete:missingBaselineCases.length===0,baselineComparisonPass,missingBaselineCases:full?missingBaselineCases:[],duplicateBaselineCases,regressedBaselineCases};
}
const rows:BalanceRow[]=[];let replays=0;
for(const terminal of CURRENT_TERMINALS)for(const theme of themes)for(const budget of subjectBudgets){
  const form=`${terminal.ownerId}-${theme}` as FormId,summary:BalanceRow[]=[];
  for(const stageId of stages)for(const seed of seeds){
    const policy=buildCurrentPlan(terminal.id,budget),{squad,owner}=policy;
    const config={stageId,squadIds:squad,captainId:owner,seed,forms:{[owner]:form}};
    const totalBudget=operationProfile(createRun(config)).points;
    const plan=totalBudget===deepPointCost(policy.plan)?policy.plan:buildCurrentPlan(terminal.id,budget,totalBudget).plan;
    const {s,restored,bossDeadAt,bossSpawnedAt}=playDeep(config,plan,true,{contentVersion:CONTENT_VERSION});
    const subject=s.treeNodes!.filter(id=>DEEP_NODE_MAP[id].ownerId===owner);
    const row:BalanceRow={terminal:terminal.id,name:resolveSkillNode(terminal,form).name,tree:terminal.treeId,form,budget,totalBudget,stageId,seed,outcome:s.outcome,choices:s.choicesSpent,earned:s.choicesEarned,subjectNodes:subject.length,subjectPoints:deepPointCost(subject,s),seconds:s.tick/30,bossSeconds:bossDeadAt===null||bossSpawnedAt===null?null:(bossDeadAt-bossSpawnedAt)/30,wallLoss:Object.values(s.stats.wallDamageByEnemy).reduce((a,b)=>a+b,0),wallHp:s.wallHp,damage:s.stats.damageByCharacter[owner],controlSeconds:s.stats.controlTicks[owner]/30,shieldAbsorbed:s.stats.shieldAbsorbed,repaired:s.support!.repaired,prevented:s.support!.prevented,restored,operationVersion:s.operationVersion,balanceVersion:s.balanceVersion,experienceVersion:s.experienceVersion};
    rows.push(row);summary.push(row);
    if(stageId==='S03'&&seed===101){
      const replay=replayDeep(s);
      if(digest(replay)!==digest(s))throw new Error(`Replay drift ${terminal.id}/${form}/${budget}`);
      replays++;
      writeFileSync(`${dir}/replay-${terminal.id.replace('/','-')}-${theme}-${budget}.json`,JSON.stringify({contentVersion:s.contentVersion,operationVersion:s.operationVersion,balanceVersion:s.balanceVersion,experienceVersion:s.experienceVersion,config:s.config,actions:s.actions,digest:digest(s),row},null,2));
    }
  }
  console.log(`${form} / ${budget} subject pts: ${summary.filter(r=>r.outcome==='victory').length}/${summary.length}`);
}
const groups=CURRENT_TERMINALS.flatMap(terminal=>themes.flatMap(theme=>subjectBudgets.flatMap(budget=>stages.map(stageId=>{
  const form=`${terminal.ownerId}-${theme}` as FormId;
  const samples=rows.filter(row=>row.terminal===terminal.id&&row.form===form&&row.budget===budget&&row.stageId===stageId);
  const mean=(value:(row:BalanceRow)=>number)=>samples.reduce((sum,row)=>sum+value(row),0)/samples.length;
  return {terminal:terminal.id,name:resolveSkillNode(terminal,form).name,form,budget,stageId,runs:samples.length,wins:samples.filter(row=>row.outcome==='victory').length,wallLoss:mean(row=>row.wallLoss),bossSeconds:mean(row=>row.bossSeconds??120),damage:mean(row=>row.damage),controlSeconds:mean(row=>row.controlSeconds),shieldAbsorbed:mean(row=>row.shieldAbsorbed),repaired:mean(row=>row.repaired)};
}))));
const playable=CURRENT_TERMINALS.every(terminal=>themes.every(theme=>groups.some(group=>group.terminal===terminal.id&&group.form===`${terminal.ownerId}-${theme}`&&group.wins/group.runs>=.8)));
const allRecovered=rows.every(row=>row.restored);
const allWinningBudgets=rows.filter(row=>row.outcome==='victory').every(row=>row.choices===row.totalBudget&&row.earned===row.totalBudget&&row.subjectPoints===row.budget);
const expectedReplays=CURRENT_TERMINALS.length*themes.length*subjectBudgets.length;
const baselineComparison=compareBaselineWins(rows,!quick);
const report={contentVersion:CONTENT_VERSION,policy:'free-skills-wave-v2',formal:!quick,createdAt:new Date().toISOString(),method:`${CURRENT_TERMINALS.length} current ultimates × ${themes.length} forms × ${subjectBudgets.join('/')} subject points × ${stages.length} stages × ${seeds.length} paired seeds. Total points follow operationProfile; fixed squad per owner, subject captain. Ordinary nodes cost 1 and ultimates cost 2. Legal XP, enemies and commands only; explicit wave-allocation completion and retained points. Save/restore after reaching 7 points, ${expectedReplays} exact full command replays. No HP, XP or combat overrides.`,playable,replays,expectedReplays,allRecovered,allWinningBudgets,...baselineComparison,sourceDigest:createHash('sha256').update(['src/data/deep-trees.ts','src/data/tactical-skills.ts','src/data/reworked-skills.ts','src/data/progression.ts','src/data/battle-experience.ts','src/data/early-pressure.ts','src/data/assault-balance.ts','src/sim/difficulty.ts','src/sim/enemies.ts','src/sim/spawn.ts','src/sim/deep-weapons.ts','src/sim/combat.ts','src/sim/engine.ts','src/sim/operations.ts','tests/helpers/deep-build.ts','scripts/validate-free-skills.ts','tests/fixtures/free-balance-v6.json'].map(path=>readFileSync(path)).join('\n')).digest('hex'),groups,rows};
writeFileSync(`${dir}/${quick?'exploratory':'balance'}.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({runs:rows.length,wins:rows.filter(row=>row.outcome==='victory').length,playable,replays,expectedReplays,allRecovered,allWinningBudgets,...baselineComparison}));
if(!playable||!allRecovered||!allWinningBudgets||replays!==expectedReplays||!baselineComparison.baselineComparisonPass)process.exitCode=1;
