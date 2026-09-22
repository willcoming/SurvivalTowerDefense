import { ticks } from '../data/content';
import { attackType, equippedForm, isSummer } from '../data/forms';
import { ultimateForForm, usesReworkedSkills } from '../data/reworked-skills';
import { deepHas, deepMods, teamMod } from './deep-tree';
import { deepTreesFor } from '../data/deep-trees';
import { addShield, area, distance, emit, hitEnemy, threat } from './combat';
import { inWeaponRange } from './range';
import { detonateMines } from './special-weapons';
import type { CharacterId, DamagePacket, RunState } from './types';

export const ultimateNodeId=(id:CharacterId,s?:RunState)=>deepTreesFor(id,s).find(t=>t.ownerId===id&&t.nodes.some(n=>n.kind==='ultimate'))!.nodes[4].id;
export const hasUltimate=(s:RunState,id:CharacterId)=>usesReworkedSkills(s)&&deepHas(s,ultimateNodeId(id,s));
export function stepUltimates(s:RunState){
 if(!usesReworkedSkills(s)||s.config.challengeId==='no-skill')return;
 for(const w of s.weapons){
  if(!hasUltimate(s,w.id)||(w.ultimateReadyAt??0)>s.tick)continue;
  const targets=threat(s).filter(e=>inWeaponRange(s,w.id,e));if(!targets.length)continue;
  const summer=isSummer(s,w.id),u=ultimateForForm(w.id,equippedForm(s,w.id).id),m=deepMods(s,w.id);
  const target=w.id==='C03'?[...targets].sort((a,b)=>b.maxHp-a.maxHp||a.id-b.id)[0]:targets[0];
  const bonus=1+(m.damage??0),p:DamagePacket={source:w.id,skill:'ultimate',raw:u.damage*bonus,damageType:attackType(s,w.id),armorIgnore:0,shieldMultiplier:1};
  if(w.id==='C06'){
   const shield=s.shields.filter(x=>x.expires>s.tick).reduce((n,x)=>n+x.value,0),capacity=300+teamMod(s,'shieldCapacity');
   if(capacity-shield<Math.min(100,u.shield*.5))continue;
   addShield(s,'ultimate:C06',u.shield,ticks(u.duration));
   if(!summer)for(const t of targets)hitEnemy(s,t,{...p,raw:0,exposure:{value:.15,duration:ticks(6)}});
   w.ultimateBuffUntil=s.tick+ticks(u.duration);
  }else if(w.id==='C07'){
   const mines=s.mines??[];
   if(!mines.some(mine=>targets.some(e=>distance(e,mine)<=mine.radius+e.radius)))continue;
   const echoes=mines.map(mine=>({x:mine.x,y:mine.y}));
   detonateMines(s,u.damage);
   if(summer)for(const pos of echoes)s.scheduled.push({at:s.tick+ticks(.45),...pos,radius:u.radius,packet:{...p,raw:140*bonus},enemyDamage:0,enemySource:null});
  }else if(w.id==='C08'){
   if((w.heat??0)<70)continue;
   w.heat=summer?70:0;w.cooling=false;w.nextAttack=s.tick;w.ventUntil=s.tick+ticks(u.duration);w.ultimateBuffUntil=w.ventUntil;
  }else if(w.id==='C04'){
   if(summer)for(const t of area(s,target.x,target.y,u.radius))hitEnemy(s,t,{...p,raw:0,stun:ticks(.8)});
   s.fields.push({id:s.nextEntityId++,source:w.id,kind:'gravity',ultimate:true,x:target.x,y:target.y,radius:u.radius,expires:s.tick+ticks(u.duration),nextTick:s.tick+15,dps:u.damage*bonus,damageType:p.damageType,slow:summer?.45:.35,slowDuration:20,pull:summer?0:25,burnDuration:0,armorIgnore:0});
  }else if(w.id==='C03'){
   hitEnemy(s,target,{...p,armorIgnore:summer?.35:.75,...(summer?{slow:{value:.5,duration:ticks(u.duration)}}:{})});
   emit(s,{kind:'beam',source:w.id,x:195,y:490,x2:target.x,y2:target.y,skill:'ultimate'});
  }else{
   const packet:DamagePacket={...p,...(w.id==='C02'?summer?{exposure:{value:.15,duration:ticks(u.duration)}}:{stun:ticks(u.duration)}:{}),...(w.id==='C05'&&!summer?{burn:{dps:26*bonus*(1+(m.burn??0)),duration:ticks(u.duration),armorIgnore:.5,key:'ultimate'}}:{})};
   for(let i=0;i<u.pulses;i++){
    const x=w.id==='C05'&&summer?Math.max(20,Math.min(370,target.x+[0,-55,55][i])):target.x;
    if(i===0)for(const t of area(s,x,target.y,u.radius))hitEnemy(s,t,packet);
    else s.scheduled.push({at:s.tick+ticks(i*.3),x,y:target.y,radius:u.radius,packet,enemyDamage:0,enemySource:null});
   }
   if(w.id==='C01'&&summer)s.fields.push({id:s.nextEntityId++,source:w.id,kind:'fire',ultimate:true,x:target.x,y:target.y,radius:u.radius,expires:s.tick+ticks(u.duration),nextTick:s.tick+15,dps:36*bonus*(1+(m.burn??0)),damageType:p.damageType,slow:0,slowDuration:0,pull:0,burnDuration:20,armorIgnore:0});
  }
  w.ultimateReadyAt=s.tick+ticks(u.cooldown);
  s.stats.casts.push(s.tick);s.stats.ultimateCasts!.push({tick:s.tick,ownerId:w.id,formId:equippedForm(s,w.id).id});
  // Reuse the non-blocking battlefield FX; no UI cast command or cinematic timeline is triggered.
  emit(s,{kind:'tactical',source:w.id,x:target.x,y:target.y,radius:u.radius||70,skill:'ultimate'});
 }
}
