import { mkdirSync, writeFileSync } from 'node:fs';
import { CONTENT_VERSION, STAGES } from '../src/data/content';
import { operationProfile } from '../src/data/progression';
import { createRun } from '../src/sim/engine';
import type { RunConfig } from '../src/sim/types';
import { play, TEAMS } from './tactical-policy';

// One fixed team and seed per mode measures flow and growth, not overall balance.
const rows=[];
for(const stage of STAGES)for(const mode of ['easy','hard','four','no-skill','two-evolutions'] as const){
  if(stage.id.startsWith('X')&&!['easy','hard'].includes(mode))continue;
  const config:RunConfig={stageId:stage.id,difficulty:mode==='easy'?'easy':'hard',challengeId:mode==='easy'||mode==='hard'?null:mode,
    squadIds:TEAMS[0].slice(0,mode==='four'?4:5),captainId:'C02',seed:101};
  const profile=operationProfile(createRun(config));
  const before=play(config,'0.6.0-dev.2',4,'adaptive');
  const after=play(config,CONTENT_VERSION,5,'adaptive',true);
  rows.push({stage:stage.id,mode,waves:profile.waves.length,points:profile.points,before,after});
}
const hundredConfig:RunConfig={stageId:'S03',mode:'hundred',difficulty:'easy',squadIds:TEAMS[0],captainId:'C02',seed:101};
const hundred=play(hundredConfig,CONTENT_VERSION,5,'adaptive',true);
const out=process.env.VALIDATION_OUTPUT_DIR??'artifacts/validation/wave-flow';
mkdirSync(out,{recursive:true});
writeFileSync(`${out}/simulation.json`,JSON.stringify({version:CONTENT_VERSION,seed:101,policy:'adaptive',rows,hundred},null,2)+'\n');
const report=[`# 波末配點固定種子模擬`, '', `版本 ${CONTENT_VERSION}；種子 101；自適應配點。每個模式一隊一組種子，用於流程與成長比較，不代表完整平衡驗收。`, '',
  '| 關卡／模式 | 波數 | 技能預算 | 舊版結果／秒 | 新版結果／秒 | 新版到達波 | 取得／已用點數 | 配點次數 |',
  '|---|---:|---:|---|---|---:|---:|---:|',
  ...rows.map(r=>`| ${r.stage}/${r.mode} | ${r.waves} | ${r.points} | ${r.before.outcome} / ${r.before.seconds.toFixed(1)} | ${r.after.outcome} / ${r.after.seconds.toFixed(1)} | ${r.after.wave} | ${r.after.earned}/${r.after.spent} | ${r.after.allocations} |`), '',
  `百波挑戰：${hundred.outcome}，到達第 ${hundred.wave} 波，${hundred.seconds.toFixed(1)} 秒，取得／已用 ${hundred.earned}/${hundred.spent} 點。`, '',
  'wall 表示實際防線失守；timeout 表示驗證器超過每波 600 秒的診斷上限，不是遊戲規則。技能未滿 6 點即結束的戰局不執行中途快照往返；其餘新版戰局會驗證一次。',''];
writeFileSync(`${out}/simulation.md`,report.join('\n'));
const timeouts=rows.filter(r=>r.after.outcome==='timeout').map(r=>`${r.stage}/${r.mode}`);
console.log(JSON.stringify({cases:rows.length,wins:rows.filter(r=>r.after.outcome==='victory').length,timeouts,hundred:hundred.outcome,output:out}));
if(timeouts.length||hundred.outcome==='timeout')process.exitCode=1;
