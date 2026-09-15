import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { simulateDifficulty } from './lib/difficulty-policy';
import type { StageId } from '../src/sim/types';
const args=process.argv.slice(2),arg=(key:string,fallback:string)=>args.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
type Row=ReturnType<typeof simulateDifficulty>&{stage:StageId;mode:string;policy:string;seed:number;sourceDigest?:string};
type Report={sourceDigest:string;seeds:number[];rows:Row[];manual:boolean;balanceVersion:number};
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8')) as Report;
const root=arg('root','artifacts/difficulty-v2/final'),auto=read(`${root}/auto/balance.json`),manual=read(`${root}/manual/balance.json`),baseline=read(`${root}/baseline/balance.json`);
const rescuePath=arg('rescue',''),rescue:Row[]=rescuePath?JSON.parse(readFileSync(rescuePath,'utf8')):[];
const median=(values:number[])=>{const xs=[...values].sort((a,b)=>a-b);return xs.length?(xs[Math.floor((xs.length-1)/2)]+xs[Math.floor(xs.length/2)])/2:null;};
const all=[...auto.rows,...manual.rows];
const checks=[...new Set(auto.rows.map(r=>`${r.stage}/${r.mode}`))].map(key=>{
  const [stage,mode]=key.split('/'),fraction=mode==='easy'?.8:mode==='hard'?.6:.5,required=mode==='easy'||mode==='hard'?2:1;
  const policies=[...new Set(auto.rows.map(r=>r.policy))].map(policy=>{
    const wins=(rows:Row[])=>rows.filter(r=>r.stage===stage&&r.mode===mode&&r.policy===policy&&r.outcome==='victory').length;
    return {policy,auto:wins(auto.rows),manual:wins(manual.rows),qualified:Math.max(wins(auto.rows),wins(manual.rows))>=Math.ceil(auto.seeds.length*fraction)};
  });
  const rows=auto.rows.filter(r=>r.stage===stage&&r.mode===mode),old=baseline.rows.filter(r=>r.stage===stage&&r.mode===mode);
  const uncovered=auto.seeds.filter(seed=>![...all,...rescue].some(r=>r.stage===stage&&r.mode===mode&&r.seed===seed&&r.outcome==='victory'));
  const failurePhases=Object.fromEntries(['pre-boss','boss'].map(phase=>[phase,rows.filter(r=>r.outcome!=='victory'&&(r.bossEntryHpRatio===null?'pre-boss':'boss')===phase).length]));
  return {stage,mode,required,fraction,policies,uncovered,passed:policies.filter(p=>p.qualified).length>=required&&uncovered.length===0,
    automaticWins:rows.filter(r=>r.outcome==='victory').length,runs:rows.length,winningMedianHpRatio:median(rows.filter(r=>r.outcome==='victory').map(r=>r.hpRatio)),
    bossEntryMedianHpRatio:median(rows.flatMap(r=>r.bossEntryHpRatio===null?[]:[r.bossEntryHpRatio])),oldWinningMedianHpRatio:median(old.filter(r=>r.outcome==='victory').map(r=>r.hpRatio)),
    pairedMeanHpChange:rows.reduce((n,r)=>{const previous=old.find(x=>x.seed===r.seed&&x.policy===r.policy);if(!previous)throw new Error(`Missing baseline ${key}/${r.seed}/${r.policy}`);return n+r.hpRatio-previous.hpRatio;},0)/rows.length,failurePhases};
});
const rowKey=(r:Row)=>`${r.stage}/${r.mode}/${r.policy}/${r.seed}`;
const sameSeeds=[manual,baseline].every(report=>JSON.stringify(report.seeds)===JSON.stringify(auto.seeds));
const uniqueRows=[auto,manual,baseline].every(report=>new Set(report.rows.map(rowKey)).size===report.rows.length);
const integrity=auto.rows.length===1980&&manual.rows.length===1170&&baseline.rows.length===1980&&auto.seeds.length===10&&sameSeeds&&uniqueRows
  &&auto.balanceVersion===2&&manual.balanceVersion===2&&baseline.balanceVersion===1&&!auto.manual&&manual.manual&&!baseline.manual
  &&new Set([auto.sourceDigest,manual.sourceDigest,baseline.sourceDigest]).size===1
  &&rescue.every(r=>r.sourceDigest===auto.sourceDigest&&r.balanceVersion===2&&r.restored)
  &&[...auto.rows,...manual.rows].every(r=>r.restored)
  &&[...all,...baseline.rows,...rescue].every(r=>r.outcome!==null&&r.points<=r.expectedPoints&&(r.outcome!=='victory'||r.points===r.expectedPoints)&&(r.mode!=='easy'||r.commanderNodes.length===0));
const report={createdAt:new Date().toISOString(),sourceDigest:auto.sourceDigest,integrity,passed:integrity&&checks.every(c=>c.passed),checks,rescueRuns:rescue.length,
  modes:Object.fromEntries(['easy','hard','four','no-skill','two-evolutions'].map(mode=>{const rows=auto.rows.filter(r=>r.mode===mode);return [mode,{runs:rows.length,wins:rows.filter(r=>r.outcome==='victory').length,winningMedianHpRatio:median(rows.filter(r=>r.outcome==='victory').map(r=>r.hpRatio)),peakEnemies:Math.max(...rows.map(r=>r.peakEnemies))}];}))};
mkdirSync(root,{recursive:true});writeFileSync(`${root}/acceptance.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,integrity,modes:report.modes,failed:checks.filter(c=>!c.passed)},null,2));
if(!report.passed)process.exitCode=1;
