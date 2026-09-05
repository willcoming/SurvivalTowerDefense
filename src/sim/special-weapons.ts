import { ticks } from '../data/content';
import { isSummer } from '../data/forms';
import { area, distance, emit, hitEnemy } from './combat';
import { deepMods } from './deep-tree';
import type { DamagePacket, Enemy, Mine, RunState, WeaponState } from './types';

export function deployMine(s:RunState,w:WeaponState,target:Enemy,packet:DamagePacket,radius:number){
  const m=deepMods(s,w.id),mines=s.mines??(s.mines=[]),cap=3+(m.mineCap??0)+(isSummer(s,w.id)?2:0);
  if(mines.filter(x=>x.source===w.id).length>=cap)return false;
  // Predict the approach, but keep stationary ranged enemies and bosses inside the trigger circle.
  const y=Math.min(440,target.y+(target.speed===0||target.defId==='E05'?0:Math.min(50,target.speed*1.5)));
  mines.push({id:s.nextEntityId++,source:w.id,x:target.x,y,plantedAt:s.tick,armedAt:s.tick+ticks(Math.max(.1,.6-(m.mineArm??0))),expires:s.tick+ticks(18),radius,triggerRadius:24+(m.mineTrigger??0),packet:{...packet,skill:'mine',slow:m.slow?{value:m.slow,duration:ticks(1.5)}:undefined,stun:m.stunSeconds?ticks(m.stunSeconds):undefined},chargeRate:.15+(m.mineCharge??0),chargeCap:.75+(m.mineChargeCap??0)});
  emit(s,{kind:'shot',source:w.id,x:195,y:490,x2:target.x,y2:y,skill:'mine-deploy'});return true;
}
function detonate(s:RunState,mine:Mine,bonus=1){
  const charge=Math.min(mine.chargeCap,(s.tick-mine.plantedAt)/30*mine.chargeRate),targets=area(s,mine.x,mine.y,mine.radius);
  for(const e of targets)hitEnemy(s,e,{...mine.packet,raw:mine.packet.raw*(1+charge)*bonus});
  emit(s,{kind:'explosion',source:mine.source,x:mine.x,y:mine.y,radius:mine.radius,skill:'mine',affectedIds:targets.map(e=>e.id)});
}
export function detonateMines(s:RunState,bonus:number){const mines=s.mines??[];if(!mines.length)return false;s.mines=[];for(const mine of mines)detonate(s,mine,bonus);return true;}
export function stepMines(s:RunState){s.mines=(s.mines??[]).filter(m=>{
  if(m.expires<=s.tick)return false;
  if(m.armedAt<=s.tick&&s.enemies.some(e=>e.hp>0&&distance(e,m)<=m.triggerRadius+e.radius)){detonate(s,m);return false;}
  return true;
});}
export function coolWeapon(s:RunState,w:WeaponState){
  if(w.id!=='C08'||!w.cooling)return false;
  w.heat=Math.max(0,(w.heat??0)-32*(1+(deepMods(s,w.id).cooling??0))*(isSummer(s,w.id)?1.35:1)/30);
  if(w.heat===0){w.cooling=false;w.nextAttack=s.tick;}return w.cooling;
}
export function heatShot(s:RunState,w:WeaponState,p:DamagePacket){
  const m=deepMods(s,w.id),heat=w.heat??0;
  p.raw*=1+heat/100*((isSummer(s,w.id)?.65:1)+(m.heatBonus??0));
  w.heat=Math.min(100,heat+Math.max(3,8-(m.heatCost??0)));if(w.heat>=100)w.cooling=true;
}
