import type { OperationProfile } from './progression';
import type { RunConfig, RunState } from '../sim/types';
import { STAGE_MAP } from './content';

export const HUNDRED_NAME = '百波挑戰';
export const isHundred = (s: {config: RunConfig}) => s.config.mode === 'hundred';
export const runName = (s: {config: RunConfig}) => isHundred(s) ? HUNDRED_NAME : STAGE_MAP[s.config.stageId].name;
// Ten-wave chapters introduce specialists gradually, with a short recovery wave.
const patterns = ['C12','C10 R3','C10 P3','C10 A2','C10 S2','C10 M2','C10 R3 P2','C10 A2 S2','C12','C10 H1 D1'];
const waves = Array.from({length:100}, (_,i) => {
  const band=Math.floor(i/10);
  const source=patterns[i%10].split(' ').filter(t=>band>0||!['H','D'].includes(t[0]));
  return source.map(t=>`${t[0]}${Number(t.slice(1))+(t[0]==='C'?band*2:Math.floor(band/3))}`).join(' ');
});
const waveXp=waves.map((_,i)=>i<20?36:i<60?14:13);
export const HUNDRED_PROFILE: OperationProfile = {
  unlimited:true,waves,waveXp,points:60,interval:20,groupInterval:2,
  bossAt:99*20,deadline:99*20+180,bossScale:4,escortCount:0,escortXp:0,
  enemies:waves.reduce((n,w)=>n+w.split(' ').reduce((m,t)=>m+Number(t.slice(1)),0),0),
  waveNames:waves.map((_,i)=>i===99?'核心決戰':`第 ${Math.floor(i/10)+1} 階段 · ${i%10===8?'整備間隙':'防線推進'}`),
  waveHints:waves.map((_,i)=>i===99?'擊破首領並清除所有殘敵，完成第 100 波。':'每 20 秒開始下一波；每 10 波提高敵人的生命與速度。'),
};
/** Count fully deployed, resolved waves, never the wave number on the clock. */
export function hundredCleared(s: RunState): number {
  if(s.waveFlow)return s.outcome==='victory'?100:Math.min(99,s.waveFlow.wave-(s.waveFlow.phase==='allocation'?0:1));
  let cleared=s.spawnPlan[s.spawnCursor]?.wave ? s.spawnPlan[s.spawnCursor].wave-1 : 100;
  for(const e of s.enemies)if(e.hp>0)cleared=Math.min(cleared,e.wave-1);
  if(!s.bossKilled)cleared=Math.min(cleared,99);
  return Math.max(0,Math.min(100,cleared));
}
export interface HundredScore { runId:string;waves:number;kills:number;wallHp:number;tick:number }
export function hundredScore(s:RunState):HundredScore {
  return {runId:s.runId,waves:hundredCleared(s),kills:s.stats.kills,wallHp:s.wallHp,tick:s.tick};
}
export function betterHundred(a:HundredScore,b?:HundredScore):boolean {
  return !b||a.waves>b.waves||a.waves===b.waves&&(a.kills>b.kills||a.kills===b.kills&&a.wallHp>b.wallHp);
}
