import { STAGE_MAP } from './content';
import type { RunState, StageId } from '../sim/types';

export interface OperationProfile { waves:readonly string[]; points:number; interval:number; groupInterval:number; bossAt:number; deadline:number; bossScale:number; waveXp:readonly number[]; enemies:number }
const profiles=new Map<StageId,OperationProfile>();
const sum=(wave:string)=>wave.split(' ').reduce((n,t)=>n+Number(t.slice(1)),0);
/** Main chapters grow from four to fifteen waves; the side story has its own curve. */
export function stageProfile(id:StageId):OperationProfile {
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
/** An absent version keeps existing saves on their original schedule and point budget. */
export function operationProfile(s:Pick<RunState,'config'|'operationVersion'>):OperationProfile {
  if(s.operationVersion===2)return stageProfile(s.config.stageId);
  const waves=STAGE_MAP[s.config.stageId].waves;
  return {waves,points:24,interval:45,groupInterval:5,bossAt:360,deadline:480,bossScale:1,waveXp:waves.map(()=>90),enemies:waves.reduce((n,w)=>n+sum(w),0)};
}
