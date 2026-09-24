import {MAIN_IDS,SIDE_IDS} from '../src/data/campaign';
import {commanderProgress,COMMANDER_MAX_XP} from '../src/data/commander';
import {migrateCommander,commanderVictoryXp} from '../src/storage/commander';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {STAGES,CONTENT_VERSION} from '../src/data/content';
import {NETWORK_CONTENT_VERSION} from '../src/data/skill-network';
import {TEAMS,play,type Policy} from './tactical-policy';
import type {CharacterId,RunConfig} from '../src/sim/types';
const opt=(name:string,fallback:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const shard=Number(opt('shard','0')),shards=Number(opt('shards','1')),limit=Number(opt('limit','Infinity'));
const dir=opt('output','artifacts/validation/tactical-rework');mkdirSync(dir,{recursive:true});
const rescue=process.argv.includes('--rescue');
const teams:CharacterId[][]=rescue?[['C04','C05','C07','C06','C08'],['C04','C02','C07','C06','C03']]:TEAMS;
const policies:Policy[]=rescue?['concentrated']:['concentrated','balanced','adaptive'];
const freshHoldout=process.argv.includes('--fresh-holdout');
const seeds=Array.from({length:freshHoldout?10:30},(_,i)=>freshHoldout?50101+i*106:i<20?101+i*106:50101+(i-20)*106),cells=[['old-old',NETWORK_CONTENT_VERSION,2],['new-old',CONTENT_VERSION,2],['old-new',NETWORK_CONTENT_VERSION,3],['new-new',CONTENT_VERSION,3]] as const;
const taskFilter=opt('mode','');
const tasks:{stage:RunConfig['stageId'];mode:string}[]=STAGES.flatMap(s=>['easy','hard',...(!s.id.startsWith('X')?['four','no-skill','two-evolutions']:[])].map(mode=>({stage:s.id,mode})));tasks.push({stage:'S03',mode:'hundred'});if(taskFilter)tasks.splice(0,tasks.length,...tasks.filter(t=>t.mode===taskFilter));
const cachedRows:any[]=!process.argv.includes('--reuse-old')?[]:Array.from({length:8},(_,i)=>`artifacts/validation/tactical-rework/iteration-2/matrix-${i}.json`).flatMap(p=>existsSync(p)?JSON.parse(readFileSync(p,'utf8')):[]);
const cacheKey=(r:any)=>[r.stage,r.mode,r.team,r.policy,r.cell,r.seed].join('/');
const cache=new Map(cachedRows.filter(r=>r.cell.startsWith('old-')).map(r=>[cacheKey(r),r]));
let index=0,done=0;const rows:object[]=[];const start=performance.now();
for(const task of tasks)for(const [team,ids] of teams.entries())for(const policy of policies)for(const [cell,content,balance] of cells.filter(c=>(!rescue||c[0]==='new-new')&&(!process.argv.includes('--new-levels')||c[2]===3)&&(!process.argv.includes('--new-skills')||c[1]===CONTENT_VERSION)))for(const [seedIndex,seed] of seeds.entries()){
 if(index++%shards!==shard||done>=limit)continue;
 const squadIds=task.mode==='four'?ids.slice(0,4):ids;if(opt('contains','')&&!squadIds.includes(opt('contains','') as CharacterId))continue;
 const config:RunConfig={stageId:task.stage,difficulty:task.mode==='easy'||task.mode==='hundred'?'easy':'hard',challengeId:['four','no-skill','two-evolutions'].includes(task.mode)?task.mode as RunConfig['challengeId']:null,mode:task.mode==='hundred'?'hundred':undefined,squadIds,captainId:squadIds[0],seed};
 const past=task.mode==='hundred'?[...MAIN_IDS]:task.stage.startsWith('X')?[...MAIN_IDS.slice(0,3),...SIDE_IDS.slice(0,SIDE_IDS.indexOf(task.stage))]:MAIN_IDS.slice(0,MAIN_IDS.indexOf(task.stage));
 const commander=migrateCommander(past);
 if(config.difficulty==='hard')commander.xp=Math.min(COMMANDER_MAX_XP,commander.xp+commanderVictoryXp(task.stage)+40);
 if(config.challengeId)commander.xp=Math.min(COMMANDER_MAX_XP,commander.xp+commanderVictoryXp(task.stage,'hard'));
 config.commanderNodes=['TEAM/0','TEAM/1','TEAM/2','TEAM/3','TEAM/8','TEAM/9','TEAM/10','TEAM/11','TEAM/4','TEAM/5','TEAM/6','TEAM/7'].slice(0,commanderProgress(commander).earned);
 const cached=cache.get(cacheKey({...task,team,policy,cell,seed}));
 const result=cached??play(config,content,balance,policy,seedIndex===0);
 rows.push({...result,...task,team,policy,cell,seed,commanderSkills:config.commanderNodes,split:freshHoldout?'holdout':seedIndex<20?'calibration':'holdout'});done++;
 if(done%30===0){writeFileSync(`${dir}/matrix-${shard}.json`,JSON.stringify(rows));console.log(`shard ${shard}: ${done} runs / ${Math.round((performance.now()-start)/1000)}s`);}
}
writeFileSync(`${dir}/matrix-${shard}.json`,JSON.stringify(rows));
console.log(JSON.stringify({shard,done,seconds:(performance.now()-start)/1000}));
if(process.argv.includes('--summarize')){
 const all:any[]=Array.from({length:shards},(_,i)=>`${dir}/matrix-${i}.json`).flatMap(p=>existsSync(p)?JSON.parse(readFileSync(p,'utf8')):[]);
 const groups:Record<string,any[]>={};for(const r of all){const key=`${r.stage}/${r.mode}/${r.team}/${r.policy}/${r.cell}/${r.split}`;(groups[key]??=[]).push(r);}
 const summary=Object.entries(groups).map(([key,rs])=>({key,n:rs!.length,wins:rs!.filter(r=>r.outcome==='victory').length,timeouts:rs!.filter(r=>r.outcome==='timeout').length,meanHp:rs!.reduce((a,r)=>a+r.hp,0)/rs!.length}));
 writeFileSync(`${dir}/summary.json`,JSON.stringify({expected:tasks.length*2*3*4*seeds.length,completed:all.length,groups:summary},null,2));
}
