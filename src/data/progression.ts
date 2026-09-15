import { encounterPattern, encounterWeights, type EncounterContext } from './encounters';
import { STAGE_MAP, ENEMY_CODE } from './content';
import type { RunConfig, RunState, StageId } from '../sim/types';

export interface OperationProfile { unlimited?:boolean; escortCount?:number; escortXp?:number; waves:readonly string[]; points:number; interval:number; groupInterval:number; bossAt:number; deadline:number; bossScale:number; waveXp:readonly number[]; enemies:number; waveNames?:readonly string[]; waveHints?:readonly string[]; groupIntervals?:readonly number[] }
const profiles=new Map<StageId,OperationProfile>();
const sum=(wave:string)=>wave.split(' ').reduce((n,t)=>n+Number(t.slice(1)),0);
/** Main chapters grow from four to fifteen waves; the side story has its own curve. */
export function legacyStageProfile(id:StageId):OperationProfile {
  const cached=profiles.get(id);if(cached)return cached;
  const stage=STAGE_MAP[id],side=id.startsWith('X'),rank=Number(id.slice(1));
  const count=side?rank+5:rank+3,points=Math.min(24,count*2);
  const base=side?14+rank:12+Math.floor(rank*.6);
  const waves=Array.from({length:count},(_,i)=>{
    const source=stage.waves[Math.min(7,Math.floor(i*8/count))].split(' ');
    const total=base+i,sourceTotal=source.reduce((n,t)=>n+Number(t.slice(1)),0);
    const special=source.filter(t=>t[0]!=='C').map(t=>[t[0],Math.max(1,Math.floor(Number(t.slice(1))*total/sourceTotal))] as const);
    return [`C${total-special.reduce((n,t)=>n+t[1],0)}`,...special.map(([code,n])=>`${code}${n}`)].join(' ');
  });
  const xp=points*30,interval=35,bossAt=count*interval+15;
  // Front-load enough XP to establish a build before later chapters' armored crowds.
  const early=Math.min(90,Math.floor((xp-(count-4)*30)/4)),remaining=xp-early*4;
  const extra=remaining-waves.slice(4).reduce((n,w)=>n+sum(w),0);
  const waveXp=waves.map((w,i)=>i<4?early:sum(w)+Math.floor(extra/(count-4))+(i-4<extra%(count-4)?1:0));
  const profile={waves,points,interval,groupInterval:3,bossAt,deadline:bossAt+120,bossScale:side?.7+rank*.1:Math.min(1.3,.35+rank*.08),waveXp,enemies:waves.reduce((n,w)=>n+sum(w),0)};
  profiles.set(id,profile);return profile;
}
const encounters = new Map<string,OperationProfile>();
export function previousStageProfile(id:StageId,difficulty:NonNullable<RunConfig['difficulty']>='easy',options:Omit<EncounterContext,'difficulty'>={}):OperationProfile {
  const context={...options,difficulty},version=options.balanceVersion??2;
  const key=`${id}:${difficulty}:${version}:${options.challengeId??'none'}`,cached=encounters.get(key);if(cached)return cached;
  const base=legacyStageProfile(id),allowed=STAGE_MAP[id].enemyIds;
  const waves=base.waves.map((wave,i)=>{
    const count=sum(wave),weights=Object.entries(encounterWeights(id,i+1,context)).filter(([code])=>allowed.includes(ENEMY_CODE[code]));
    const total=weights.reduce((n,[,weight])=>n+weight,0);
    const entries=weights.map(([code,weight])=>({code,exact:count*weight/total,n:Math.floor(count*weight/total)}));
    let left=count-entries.reduce((n,e)=>n+e.n,0);
    for(const e of [...entries].sort((a,b)=>(b.exact-b.n)-(a.exact-a.n)||a.code.localeCompare(b.code))){if(!left)break;e.n++;left--;}
    return entries.filter(e=>e.n>0).map(e=>`${e.code}${e.n}`).join(' ');
  });
  const profile={...base,waves,waveNames:waves.map((_,i)=>encounterPattern(id,i+1,context).name),waveHints:waves.map((_,i)=>encounterPattern(id,i+1,context).hint),groupIntervals:waves.map((_,i)=>encounterPattern(id,i+1,context).groupInterval)};
  encounters.set(key,profile);return profile;
}
const expandedProfiles=new Map<string,OperationProfile>();
/** New operations spread 30% more enemies across 30% more waves. */
export function stageProfile(id:StageId,difficulty:NonNullable<RunConfig['difficulty']>='easy',options:Omit<EncounterContext,'difficulty'>={}):OperationProfile {
  const key=`${id}:${difficulty}:${options.balanceVersion??2}:${options.challengeId??'none'}`,cached=expandedProfiles.get(key);if(cached)return cached;
  const old=previousStageProfile(id,difficulty,options),count=Math.round(old.waves.length*1.3);
  const enemies=Math.round(old.enemies*1.3),points=2*Math.round(old.points*1.3/2),escortCount=42,escortXp=42;
  const weights=Array.from({length:count},(_,i)=>sum(old.waves[Math.min(old.waves.length-1,Math.floor(i*old.waves.length/count))]));
  const distribute=(total:number,weights:readonly number[])=>{
    const weight=weights.reduce((a,b)=>a+b,0),values=weights.map(w=>Math.floor(total*w/weight));
    const order=weights.map((w,i)=>({i,remainder:total*w/weight-values[i]})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i);
    for(let n=total-values.reduce((a,b)=>a+b,0),i=0;i<n;i++)values[order[i].i]++;
    return values;
  };
  const counts=distribute(enemies,weights),context={...options,difficulty};
  const waves=counts.map((total,i)=>{
    const entries=Object.entries(encounterWeights(id,i+1,context)).filter(([code])=>STAGE_MAP[id].enemyIds.includes(ENEMY_CODE[code]));
    const units=distribute(total,entries.map(([,weight])=>weight));
    return entries.flatMap(([code],j)=>units[j]?[`${code}${units[j]}`]:[]).join(' ');
  });
  // Preserve the early-build XP weighting; reserve one XP per entrance escort.
  const xpWeights=Array.from({length:count},(_,i)=>old.waveXp[Math.min(old.waves.length-1,Math.floor(i*old.waves.length/count))]);
  const waveXp=distribute(points*30-escortXp,xpWeights),interval=25,bossAt=count*interval+15;
  // deadline remains a finite benchmark horizon for tooling, never a loss condition.
  const profile:OperationProfile={...old,unlimited:true,escortCount,escortXp,waves,points,enemies,waveXp,interval,bossAt,deadline:bossAt+120,
    waveNames:waves.map((_,i)=>encounterPattern(id,i+1,context).name),waveHints:waves.map((_,i)=>encounterPattern(id,i+1,context).hint),
    groupIntervals:waves.map((_,i)=>Math.min(3,encounterPattern(id,i+1,context).groupInterval))};
  expandedProfiles.set(key,profile);return profile;
}
/** Existing snapshots retain their authored schedule and balance rules. */
export function operationProfile(s:Pick<RunState,'config'|'operationVersion'|'balanceVersion'>):OperationProfile {
  if(s.operationVersion===3)return stageProfile(s.config.stageId,s.config.difficulty,{balanceVersion:s.balanceVersion,challengeId:s.config.challengeId});
  if(s.operationVersion===2)return s.balanceVersion!==undefined?previousStageProfile(s.config.stageId,s.config.difficulty,{balanceVersion:s.balanceVersion,challengeId:s.config.challengeId}):legacyStageProfile(s.config.stageId);
  const waves=STAGE_MAP[s.config.stageId].waves;
  return {waves,points:24,interval:45,groupInterval:5,bossAt:360,deadline:480,bossScale:1,waveXp:waves.map(()=>90),enemies:waves.reduce((n,w)=>n+sum(w),0)};
}
