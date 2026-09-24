import { STAGE_MAP } from '../data/content';
import { highPressure, pressureMode } from '../data/high-pressure';
import { operationProfile } from '../data/progression';
import { ENEMY_CODE, ticks } from '../data/content';
import { nextRandom } from './rng';
import { usesCollection } from '../data/forms';
import { pressure } from './difficulty';
import type { EnemyId, RunState, SpawnEntry } from './types';
export function makeSpawnPlan(s:RunState):SpawnEntry[]{
  const plan:SpawnEntry[]=[];
  const profile=operationProfile(s);
  profile.waves.forEach((wave,wi)=>{
    const ids:EnemyId[]=[];for(const token of wave.split(' ')){for(let j=0;j<Number(token.slice(1));j++)ids.push(ENEMY_CODE[token[0]]);}
    const formation=profile.formations?.[wi];
    if(formation){let index=0;for(const group of formation)for(let j=0;j<group.count;j++){
      plan.push({at:ticks(wi*profile.interval+group.offset+Math.floor(j/3)*.7),defId:ENEMY_CODE[group.code],x:[45,120,195,270,345][group.lane===2?[0,2,4][j%3]:group.lane]+nextRandom(s.rng,'spawn')*12-6,xp:Math.floor(profile.waveXp[wi]/ids.length)+(index<profile.waveXp[wi]%ids.length?1:0),wave:wi+1});index++;
    }return;}
    for(let j=ids.length-1;j>0;j--){const k=Math.floor(nextRandom(s.rng,'spawn')*(j+1));[ids[j],ids[k]]=[ids[k],ids[j]];}
    const groupSizes=Array.from({length:8},(_,i)=>Math.floor(ids.length/8)+(i<ids.length%8?1:0));const group4=groupSizes.slice(0,4).reduce((a,b)=>a+b,0);let eliteIndex=0;
    if(usesCollection(s)){
      const elite=ids.filter(id=>['E07','E08'].includes(id)),normal=ids.filter(id=>!['E07','E08'].includes(id));normal.splice(group4,0,...elite);ids.splice(0,ids.length,...normal);
    }else for(let i=0;i<ids.length;i++)if(['E07','E08'].includes(ids[i])&&!(i>=group4&&i<group4+groupSizes[4])){const slot=group4+eliteIndex++;[ids[i],ids[slot]]=[ids[slot],ids[i]];}
    let index=0;for(let group=0;group<8;group++)for(let j=0;j<groupSizes[group];j++){
      plan.push({at:ticks(wi*profile.interval+group*(profile.groupIntervals?.[wi]??profile.groupInterval)),defId:ids[index],x:[45,120,195,270,345][Math.floor(nextRandom(s.rng,'spawn')*5)]+nextRandom(s.rng,'spawn')*16-8,xp:Math.floor(profile.waveXp[wi]/ids.length)+(index<profile.waveXp[wi]%ids.length?1:0),wave:wi+1});index++;
    }
    // Reinforcements do not dilute the original wave's XP or reroll its lanes/composition.
    const extra=s.operationVersion!==undefined||wi<6?0:Math.ceil(ids.filter(id=>id==='E01').length*(pressure(s).numbers-1));
    for(let i=0;i<extra;i++)plan.push({at:ticks(wi*profile.interval+25),defId:'E01',x:[45,120,195,270,345][(wi+i)%5],xp:0,wave:wi+1});
  });
  if(s.balanceVersion===3){
    const count=profile.escortCount??0,xp=profile.escortXp??0,specialists=highPressure(s.config.stageId,pressureMode(s.config)).escortSpecialists;
    const types=['E03','E04','E05','E02','E06','E03','E05','E02','E04','E03','E05','E06'] as const;
    for(let i=0;i<count;i++){const candidate=i<specialists?types[i%types.length]:'E01';plan.push({at:ticks(profile.bossAt+(i<Math.ceil(count/2)?1:9)),defId:STAGE_MAP[s.config.stageId].enemyIds.includes(candidate)?candidate:'E01',x:24+(i%8)*48,y:20+Math.floor(i/8)*20,xp:Math.floor(xp/count)+(i<xp%count?1:0),wave:profile.waves.length+1});}
  }
  return plan.sort((a,b)=>a.at-b.at);
}
