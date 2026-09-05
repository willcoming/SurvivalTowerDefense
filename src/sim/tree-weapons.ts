import { CHARACTER_MAP, ticks, WORLD } from '../data/content';
import { alive, addShield, applyEffect, area, distance, emit, hitEnemy, threat } from './combat';
import { hasNode, treeMods, ultimateFor } from './skill-tree';
import { inWeaponRange, weaponRange } from './range';
import type { CharacterId, DamagePacket, Enemy, RunState, WeaponState } from './types';

export function treeWeaponStats(s: RunState, w: WeaponState) {
  const d=CHARACTER_MAP[w.id], m=treeMods(s,w.id);
  const bonus=(s.commonRanks.G01??0)*.08+(m.damage??0);
  const haste=(s.commonRanks.G02??0)*.06+(m.haste??0);
  const radiusMultiplier=1+(s.commonRanks.G03??0)*.1+(m.radius??0);
  return { damage:d.damage*(1+bonus), bonus, interval:ticks(Math.max(.1,d.interval/(1+haste))), radius:(w.id==='C04'?45:w.id==='C05'?48:0)*radiusMultiplier,
    duration:1+(s.commonRanks.G06??0)*.1+(m.duration??0), burnDamage:1+(s.commonRanks.G01??0)*.08+(m.burn??0), radiusMultiplier };
}
function exposure(s: RunState, w: WeaponState) {
  const m=treeMods(s,w.id), n=treeWeaponStats(s,w);
  const every=m.exposureEvery ?? (w.id==='C06'?4:0);
  if(!every || w.attacks%every!==0)return undefined;
  return {value:Math.min(.25,(w.id==='C06'?.1:0)+(m.exposureValue??0)),duration:ticks(((w.id==='C06'?4:0)+(m.exposureSeconds??0))*n.duration)};
}
function packet(s: RunState, w: WeaponState): DamagePacket {
  const n=treeWeaponStats(s,w),m=treeMods(s,w.id);
  return {source:w.id,skill:'weapon',raw:n.damage,damageType:CHARACTER_MAP[w.id].damageType,
    armorIgnore:Math.min(1,(w.id==='C03'?.35:0)+(m.armor??0)),shieldMultiplier:(w.id==='C02'?1.25:1)+(m.shield??0),
    exposureBonus:(w.id==='C01'?.15:0)+(m.exposureDamage??0),exposure:exposure(s,w)};
}
function targetsInLine(s: RunState, target: Enemy, count: number, id: CharacterId) {
  const dx=target.x-WORLD.originX,dy=target.y-WORLD.originY,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
  return alive(s).filter(e=>inWeaponRange(s,id,e)).filter(e=>{const x=e.x-WORLD.originX,y=e.y-WORLD.originY;return x*ux+y*uy>=0&&Math.abs(x*uy-y*ux)<=e.radius+7;})
    .sort((a,b)=>b.y-a.y||a.id-b.id).slice(0,count);
}
function bullet(s: RunState, target: Enemy, p: DamagePacket, count: number) {
  const dx=target.x-195,dy=target.y-490,len=Math.hypot(dx,dy)||1;
  s.projectiles.push({id:s.nextEntityId++,x:195,y:490,tx:target.x,ty:target.y,vx:dx/len*700,vy:dy/len*700,travelRemaining:weaponRange(s,p.source),expires:s.tick+ticks(1.2),hitIds:[],remaining:count,falloff:Array.from({length:count},(_,i)=>i?.8:1),radius:4,blastRadius:0,packet:p,enemyDamage:0,enemySource:null,impactAt:0});
  emit(s,{kind:'shot',x:195,y:490,x2:target.x,y2:target.y,source:p.source});
}
function attack(s: RunState,w: WeaponState) {
  const all=threat(s).filter(e=>inWeaponRange(s,w.id,e));if(!all.length)return false;
  w.attacks++;let target=all[0];const n=treeWeaponStats(s,w),m=treeMods(s,w.id),p=packet(s,w),ultimate=ultimateFor(s,w.id)?.split(':')[0];
  if(w.id==='C01')all.slice(0,1+(m.targets??0)).forEach((t,i)=>bullet(s,t,{...p,raw:p.raw*(i?.55:1),exposure:i?undefined:p.exposure},1+(m.pierce??0)));
  if(w.id==='C02') {
    const direct={...p,stun:hasNode(s,'C02-B:2')&&w.attacks%5===0?ticks(.4*n.duration):undefined};
    emit(s,{kind:'beam',x:195,y:490,x2:target.x,y2:target.y,source:w.id});hitEnemy(s,target,direct);
    if((m.burstDamage??0)>0&&target.hp>0&&++target.arcCharges>=3) {
      target.arcCharges=0;const radius=(m.burstRadius??65)*n.radiusMultiplier,targets=area(s,target.x,target.y,radius);
      for(const e of targets)hitEnemy(s,e,{...p,skill:'magnetic-burst',raw:m.burstDamage!*(1+n.bonus),stun:ultimate==='C02-B'?ticks(.7*n.duration):undefined});
      emit(s,{kind:'explosion',affectedIds:targets.map(e=>e.id),x:target.x,y:target.y,radius,source:w.id});
    }
    const seen=new Set([target.id]);let factor=1;
    for(let i=0;i<1+(m.jumps??0);i++) {
      const next=alive(s).filter(e=>!seen.has(e.id)&&distance(e,target)<=90+(m.jumpRange??0)).sort((a,b)=>distance(a,target)-distance(b,target)||a.id-b.id)[0];if(!next)break;
      factor*=Math.min(.9,.6+(m.jumpPower??0));emit(s,{kind:'arc',x:target.x,y:target.y,x2:next.x,y2:next.y,source:w.id});
      hitEnemy(s,next,{...p,raw:p.raw*factor});seen.add(next.id);target=next;
    }
  }
  if(w.id==='C03') {
    target=all.sort((a,b)=>b.maxHp-a.maxHp||a.id-b.id)[0];
    const targets=targetsInLine(s,target,2+(m.pierce??0),w.id);
    // A core shot must reach its selected heavy target even if incidental enemies use all line slots.
    if(!targets.some(e=>e.id===target.id))targets[targets.length-1]=target;
    const end=targets.reduce((far,t)=>distance(t,{x:195,y:490})>distance(far,{x:195,y:490})?t:far,target);
    emit(s,{kind:'beam',x:195,y:490,x2:end.x,y2:end.y,source:w.id});
    targets.forEach((t,i)=>hitEnemy(s,t,{...p,raw:p.raw*Math.max(.5,1-.15*i)*(t.id===target.id&&ultimate==='C03-B'?1.85:1)*(['E07','E08','B01','B02','B03'].includes(t.defId)?1+(m.eliteDamage??0):1)}));
  }
  if(w.id==='C04') {
    // Snapshot the impact point before knockback mutates the target position.
    const impact={x:target.x,y:target.y};
    const targets=area(s,impact.x,impact.y,n.radius);
    for(const t of targets)hitEnemy(s,t,{...p,slow:{value:.2+(m.slow??0),duration:ticks(1.5*n.duration)},knockback:m.knockEvery&&w.attacks%m.knockEvery===0?m.knockback:undefined});
    emit(s,{kind:'explosion',affectedIds:targets.map(t=>t.id),x:impact.x,y:impact.y,radius:n.radius,source:w.id});
    if(m.fieldDamage) {
      // Relocation refreshes the same field without resetting its damage cadence.
      const previous=s.fields.find(f=>f.source===w.id&&f.kind==='gravity'&&f.expires>s.tick);
      const nextTick=previous?.nextTick??s.tick+15;
      s.fields=s.fields.filter(f=>!(f.source===w.id&&f.kind==='gravity'));
      s.fields.push({id:s.nextEntityId++,source:w.id,kind:'gravity',x:impact.x,y:impact.y,radius:Math.max(65,m.fieldRadius??0)*n.radiusMultiplier,expires:s.tick+ticks(m.fieldDuration??1.2),nextTick,dps:m.fieldDamage*(1+n.bonus),damageType:'gravity',slow:.25+(m.slow??0),slowDuration:ticks(.6*n.duration),pull:m.pull??12,burnDuration:0,armorIgnore:0});
    }
  }
  if(w.id==='C05') {
    p.burn={dps:4*n.burnDamage,duration:ticks(3*n.duration),armorIgnore:.5,key:'weapon'};
    s.projectiles.push({id:s.nextEntityId++,x:195,y:490,tx:target.x,ty:target.y,vx:0,vy:0,expires:s.tick+ticks(.45),hitIds:[],remaining:1,falloff:[1],radius:6,blastRadius:n.radius,packet:p,enemyDamage:0,enemySource:null,impactAt:s.tick+ticks(.45),...(m.fireDamage?{fire:{radius:70*n.radiusMultiplier,dps:m.fireDamage*n.burnDamage,duration:ticks(m.fireDuration??2),burnDuration:ticks(n.duration),armorIgnore:.5}}:{})});
    emit(s,{kind:'shot',x:195,y:490,x2:target.x,y2:target.y,source:w.id});
  }
  if(w.id==='C06') {
    const drones=(m.drones||ultimate==='C06-A')?2:1;
    for(let i=0;i<drones;i++) {
      const t=threat(s).find(e=>inWeaponRange(s,w.id,e));if(!t)break;
      emit(s,{kind:'beam',x:195+(i?12:0),y:490,x2:t.x,y2:t.y,source:w.id});
      hitEnemy(s,t,{...p,raw:p.raw*(i?(ultimate==='C06-A'?.8:.5):1),exposure:i?undefined:p.exposure});w.droneAttacks[i]++;
    }
  }
  return true;
}
export function stepTreeWeapons(s: RunState) {
  for(const w of s.weapons) {
    const m=treeMods(s,w.id);
    if(m.autoShield&&s.tick>=w.shieldAt) {addShield(s,`${w.id}-tree`,m.autoShield,ticks(6+(hasNode(s,'C06-C:3')?3:0)));w.shieldAt=s.tick+ticks(m.shieldInterval??15);}
    if(s.tick>=w.nextAttack&&attack(s,w))w.nextAttack=s.tick+treeWeaponStats(s,w).interval;
  }
}
