import { ENEMY_MAP, STAGE_MAP, ticks } from '../data/content';
import { usesFreeSkills } from '../data/deep-trees';
import { nextRandom } from './rng';
import type { EnemyId, RunState, WaveBrief } from './types';

export const VARIANT_INFO = {
  standard:{name:'標準編成',description:'維持基礎移動與防禦。'},
  fast:{name:'疾行編成',description:'本波敵人移速 +15%、生命 -10%。'},
  armored:{name:'重甲編成',description:'本波敵人裝甲 +8 個百分點、移速 -10%。'},
  shielded:{name:'屏障編成',description:'本波敵人獲得最大生命 15% 的額外護盾、生命 -8%。'},
};
export const EVENT_INFO = {
  none:{name:'穩定戰場',description:'沒有額外環境規則。'},
  ion:{name:'離子共振',description:'本波敵人額外護盾 +10% 生命；對這些敵人的電弧傷害 +25%。'},
  heat:{name:'熱流裂隙',description:'本波敵人裝甲 +5 個百分點；對這些敵人的熱能傷害 +25%。'},
  gravity:{name:'重力潮汐',description:'本波敵人移速 +10%；受到的擊退與引力牽引 +35%。'},
};
/** Built once with the spawn RNG; retries and reloads cannot reroll future threats. */
export function prepareOperation(s:RunState) {
  if(!usesFreeSkills(s))return;
  const variants:WaveBrief['variant'][]=['standard','fast','armored','shielded'];
  const events:WaveBrief['event'][]=['ion','heat','gravity'];
  s.wavePlan=Array.from({length:8},(_,i)=>({wave:i+1,variant:i===0?'standard':variants[Math.floor(nextRandom(s.rng,'spawn')*variants.length)],event:[2,4,6].includes(i)?events[Math.floor(nextRandom(s.rng,'spawn')*events.length)]:'none'}));
  const types=STAGE_MAP[s.config.stageId].enemyIds.filter(id=>['E02','E03','E04','E05'].includes(id));
  // Replace at most two basic units per wave, with unchanged XP and spawn timing.
  for(let wave=2;wave<=8;wave++){
    const candidates=s.spawnPlan.filter(p=>p.wave===wave&&p.defId==='E01');
    for(const entry of candidates.slice(0,2))if(types.length&&nextRandom(s.rng,'spawn')<.6)entry.defId=types[Math.floor(nextRandom(s.rng,'spawn')*types.length)];
  }
}
export function waveStats(s:RunState,id:EnemyId,wave:number){
  const d=ENEMY_MAP[id],boss=id.startsWith('B'),factor=boss?1:STAGE_MAP[s.config.stageId].hpMultiplier;
  const brief=usesFreeSkills(s)&&!boss?s.wavePlan?.find(w=>w.wave===wave):undefined;
  const hp=d.hp*factor*(brief?.variant==='fast'?.9:brief?.variant==='shielded'?.92:1);
  return {hp,shield:d.shield*factor+hp*((brief?.variant==='shielded'?.15:0)+(brief?.event==='ion'?.1:0)),armor:Math.min(.7,d.armor+(brief?.variant==='armored'?.08:0)+(brief?.event==='heat'?.05:0)),speed:d.speed*(brief?.variant==='fast'?1.15:brief?.variant==='armored'?.9:1)*(brief?.event==='gravity'?1.1:1)};
}
export function eventMultiplier(s:RunState,wave:number,type:string){
  const event=s.wavePlan?.find(w=>w.wave===wave)?.event;
  return event==='ion'&&type==='arc'||event==='heat'&&type==='thermal'?1.25:event==='gravity'&&type==='displacement'?1.35:1;
}
export function nextIntel(s:RunState){
  // Include the current unfinished spawn group and the next complete wave.
  const first=s.spawnPlan[s.spawnCursor],wave=first?.wave??9;
  const nextWave=Math.min(8,wave+1);
  const waves=wave===9?[]:[wave,...(nextWave!==wave?[nextWave]:[])];
  return waves.map(number=>{
    const units=s.spawnPlan.slice(s.spawnCursor).filter(p=>p.wave===number),counts=new Map<EnemyId,number>();
    for(const u of units)counts.set(u.defId,(counts.get(u.defId)??0)+1);
    const shielded=units.filter(p=>waveStats(s,p.defId,p.wave).shield>0).length;
    const armored=units.filter(p=>waveStats(s,p.defId,p.wave).armor>0).length;
    return {wave:number,at:Math.max(s.tick,ticks((number-1)*45)),brief:s.wavePlan?.find(w=>w.wave===number),counts:[...counts.entries()],shieldPercent:units.length?Math.round(shielded/units.length*100):0,armorPercent:units.length?Math.round(armored/units.length*100):0};
  });
}
