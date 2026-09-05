import { CHARACTER_MAP, ticks, WORLD } from '../data/content';
import { deepMods, teamMod } from './deep-tree';
import { alive, addShield, area, distance, emit, hitEnemy, threat } from './combat';
import { inWeaponRange, weaponRange } from './range';
import type { CharacterId, DamagePacket, Enemy, RunState, WeaponState } from './types';

export function deepWeaponStats(s:RunState,w:WeaponState){
  const d=CHARACTER_MAP[w.id],m=deepMods(s,w.id),bonus=m.damage??0;
  const haste=(m.haste??0)+teamMod(s,'teamHaste')+(s.shields.some(x=>x.expires>s.tick&&x.value>0)?m.shieldHaste??0:0);
  const radiusMultiplier=1+(m.radius??0);
  return {damage:d.damage*(1+bonus),bonus,interval:ticks(Math.max(.12,d.interval/(1+haste))),radius:(w.id==='C04'?45:w.id==='C05'?48:0)*radiusMultiplier,duration:1+(m.duration??0),burnDamage:1+(m.burn??0),radiusMultiplier};
}
function packet(s:RunState,w:WeaponState):DamagePacket{
  const m=deepMods(s,w.id),n=deepWeaponStats(s,w),every=m.exposureEvery??(w.id==='C06'?4:0);
  const own=every&&w.attacks%every===0?{value:Math.min(.25,(w.id==='C06'?.1:0)+(m.exposureValue??0)),duration:ticks(((w.id==='C06'?4:0)+(m.exposureSeconds??0))*n.duration)}:undefined;
  const shared=deepMods(s,'common'),common=shared.teamMarkEvery&&w.attacks%shared.teamMarkEvery===0?{value:shared.teamMarkValue??.08,duration:ticks(3)}:undefined;
  return {source:w.id,skill:'weapon',raw:n.damage*(m.critEvery&&w.attacks%m.critEvery===0?1+(m.critPower??.5):1),damageType:CHARACTER_MAP[w.id].damageType,armorIgnore:Math.min(1,(w.id==='C03'?.35:0)+(m.armor??0)),shieldMultiplier:(w.id==='C02'?1.25:1)+(m.shield??0),exposureBonus:(w.id==='C01'?.15:0)+(m.exposureDamage??0),exposure:own&&common?{value:Math.max(own.value,common.value),duration:Math.max(own.duration,common.duration)}:own??common,armorBreak:m.armorBreak,executeDamage:m.executeDamage,executeThreshold:m.executeThreshold,controlledBonus:m.controlledDamage};
}
function bullet(s:RunState,t:Enemy,p:DamagePacket,count:number){
  const dx=t.x-195,dy=t.y-490,len=Math.hypot(dx,dy)||1;
  s.projectiles.push({id:s.nextEntityId++,x:195,y:490,tx:t.x,ty:t.y,vx:dx/len*700,vy:dy/len*700,travelRemaining:weaponRange(s,p.source),expires:s.tick+ticks(2),hitIds:[],remaining:count,falloff:Array.from({length:count},(_,i)=>i?.8:1),radius:4,blastRadius:0,packet:p,enemyDamage:0,enemySource:null,impactAt:0});
  emit(s,{kind:'shot',x:195,y:490,x2:t.x,y2:t.y,source:p.source});
}
function blast(s:RunState,x:number,y:number,radius:number,p:DamagePacket){
  const targets=area(s,x,y,radius);for(const target of targets)hitEnemy(s,target,p);
  emit(s,{kind:'explosion',affectedIds:targets.map(e=>e.id),x,y,radius,source:p.source,skill:p.skill});
}
function lineTargets(s:RunState,target:Enemy,count:number,id:CharacterId){
  const dx=target.x-WORLD.originX,dy=target.y-WORLD.originY,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
  const ts=alive(s).filter(e=>inWeaponRange(s,id,e)).filter(e=>{const x=e.x-195,y=e.y-490;return x*ux+y*uy>=0&&Math.abs(x*uy-y*ux)<=e.radius+7;}).sort((a,b)=>distance(a,WORLD_ORIGIN)-distance(b,WORLD_ORIGIN)||a.id-b.id).slice(0,count);
  if(!ts.includes(target))ts[ts.length-1]=target;
  return ts;
}
const WORLD_ORIGIN={x:195,y:490};
function attack(s:RunState,w:WeaponState){
  const all=threat(s).filter(e=>inWeaponRange(s,w.id,e));if(!all.length)return false;
  w.attacks++;const n=deepWeaponStats(s,w),m=deepMods(s,w.id),p=packet(s,w);let target=all[0];
  if(w.id==='C01'){
    all.slice(0,1+(m.targets??0)).forEach((t,i)=>bullet(s,t,{...p,raw:p.raw*(i?Math.min(1,.45+(m.secondaryPower??0)):1),exposure:i?undefined:p.exposure},1+(m.pierce??0)));
    if(m.salvoEvery&&w.attacks%m.salvoEvery===0)for(let i=0;i<(m.salvoShots??1);i++)bullet(s,target,{...p,raw:p.raw*.45,exposure:undefined},1+(m.pierce??0));
  }
  if(w.id==='C02'){
    const first=target,point={x:target.x,y:target.y};
    emit(s,{kind:'beam',x:195,y:490,x2:target.x,y2:target.y,source:w.id});
    hitEnemy(s,target,{...p,stun:m.stunEvery&&w.attacks%m.stunEvery===0?ticks((m.stunSeconds??.4)*n.duration):undefined});
    if(m.burstDamage&&++target.arcCharges>=(m.burstEvery??3)){target.arcCharges=0;blast(s,point.x,point.y,(m.burstRadius??65)*n.radiusMultiplier,{...p,skill:'magnetic-burst',raw:m.burstDamage*(1+n.bonus),stun:m.burstStun?ticks(m.burstStun*n.duration):undefined});}
    const seen=new Set([target.id]);let factor=1;
    for(let i=0;i<1+(m.jumps??0);i++){
      const next=alive(s).filter(e=>!seen.has(e.id)&&distance(e,target)<=90+(m.jumpRange??0)).sort((a,b)=>distance(a,target)-distance(b,target)||a.id-b.id)[0];if(!next)break;
      factor*=Math.min(.95,.6+(m.jumpPower??0));emit(s,{kind:'arc',x:target.x,y:target.y,x2:next.x,y2:next.y,source:w.id});hitEnemy(s,next,{...p,raw:p.raw*factor});seen.add(next.id);target=next;
    }
    if(m.chainReturn&&seen.size>1&&first.hp>0){emit(s,{kind:'arc',x:target.x,y:target.y,x2:first.x,y2:first.y,source:w.id});hitEnemy(s,first,{...p,raw:p.raw*m.chainReturn,skill:'chain-return'});}
    if(m.chainBurst&&seen.size>1)blast(s,target.x,target.y,60*n.radiusMultiplier,{...p,skill:'chain-burst',raw:p.raw*m.chainBurst});
  }
  if(w.id==='C03'){
    target=all.sort((a,b)=>b.maxHp-a.maxHp||a.id-b.id)[0];const targets=lineTargets(s,target,2+(m.pierce??0),w.id),end=targets.at(-1)??target;
    emit(s,{kind:'beam',x:195,y:490,x2:end.x,y2:end.y,source:w.id});
    for(const [i,t] of targets.entries())hitEnemy(s,t,{...p,raw:p.raw*Math.min(1,Math.max(.5,1-.15*i)+(i?m.linePower??0:0))*(t.id===target.id?1+(m.mainDamage??0):1)*(['E07','E08','B01','B02','B03'].includes(t.defId)?1+(m.eliteDamage??0):1)});
    if(m.lineShock)blast(s,end.x,end.y,40,{...p,skill:'overpenetration',raw:p.raw*m.lineShock,secondary:true});
  }
  if(w.id==='C04'){
    const impact={x:target.x,y:target.y},targets=area(s,impact.x,impact.y,n.radius),pushing=!!m.knockEvery&&w.attacks%m.knockEvery===0;
    for(const t of targets){const y=t.y;hitEnemy(s,t,{...p,slow:{value:.2+(m.slow??0),duration:ticks(1.5*n.duration)},knockback:pushing?m.knockback:undefined});
      if(pushing&&m.collision&&t.y!==y){const nearby=area(s,t.x,t.y,40).filter(e=>e.id!==t.id);for(const e of nearby)hitEnemy(s,e,{...p,skill:'collision',raw:p.raw*m.collision,secondary:true});emit(s,{kind:'explosion',x:t.x,y:t.y,radius:40,affectedIds:nearby.map(e=>e.id),source:w.id,skill:'collision'});}
    }
    emit(s,{kind:'explosion',x:impact.x,y:impact.y,radius:n.radius,affectedIds:targets.map(t=>t.id),source:w.id});
    if(m.fieldDamage){const previous=s.fields.find(f=>f.source===w.id&&f.kind==='gravity'&&f.expires>s.tick),nextTick=previous?.nextTick??s.tick+15;s.fields=s.fields.filter(f=>!(f.source===w.id&&f.kind==='gravity'));
      s.fields.push({id:s.nextEntityId++,source:w.id,kind:'gravity',...impact,radius:(m.fieldRadius??65)*n.radiusMultiplier,expires:s.tick+ticks(m.fieldDuration??1.5),nextTick,dps:m.fieldDamage*(1+n.bonus),damageType:'gravity',slow:.25+(m.slow??0),slowDuration:ticks(.6*n.duration),pull:m.pull??12,burnDuration:0,armorIgnore:0,exposure:m.fieldExposure});}
  }
  if(w.id==='C05'){
    const ignore=Math.min(1,.5+(m.burnArmor??0));p.burn={dps:4*n.burnDamage,duration:ticks(3*n.duration),armorIgnore:ignore,key:'weapon'};
    s.projectiles.push({id:s.nextEntityId++,x:195,y:490,tx:target.x,ty:target.y,vx:0,vy:0,expires:s.tick+ticks(.45),hitIds:[],remaining:1,falloff:[1],radius:6,blastRadius:n.radius,packet:p,enemyDamage:0,enemySource:null,impactAt:s.tick+ticks(.45),...(m.fireDamage?{fire:{radius:70*n.radiusMultiplier,dps:m.fireDamage*n.burnDamage,duration:ticks(m.fireDuration??2),burnDuration:ticks(n.duration),armorIgnore:ignore}}:{}),...(m.blastEcho?{echo:{count:m.echoCount??1,damage:p.raw*m.blastEcho,radius:n.radius*.65}}:{})});
    emit(s,{kind:'shot',x:195,y:490,x2:target.x,y2:target.y,source:w.id});
  }
  if(w.id==='C06'){
    const count=Math.min(5,1+(m.drones??0)),seen=new Set<number>();
    for(let i=0;i<count;i++){
      const options=threat(s).filter(e=>inWeaponRange(s,w.id,e));const t=options.find(e=>!seen.has(e.id))??options[0];if(!t)break;seen.add(t.id);
      emit(s,{kind:'beam',x:195+(i-(count-1)/2)*12,y:490,x2:t.x,y2:t.y,source:w.id});hitEnemy(s,t,{...p,raw:p.raw*(i?Math.min(1,.45+(m.dronePower??0)):1),exposure:i?undefined:p.exposure});w.droneAttacks[i?1:0]++;
    }
    if(m.missiles&&w.attacks%(m.missileEvery??4)===0){const t=threat(s).find(e=>inWeaponRange(s,w.id,e));if(t){s.projectiles.push({id:s.nextEntityId++,x:195,y:490,tx:t.x,ty:t.y,vx:0,vy:0,expires:s.tick+ticks(.3),hitIds:[],remaining:1,falloff:[1],radius:4,blastRadius:35,packet:{...p,raw:p.raw*m.missiles,skill:'micro-missile',secondary:true},enemyDamage:0,enemySource:null,impactAt:s.tick+ticks(.3)});emit(s,{kind:'shot',x:195,y:490,x2:t.x,y2:t.y,source:w.id,skill:'micro-missile'});}}
  }
  return true;
}
export function stepDeepWeapons(s:RunState){
  for(const w of s.weapons){const m=deepMods(s,w.id);
    if(m.autoShield&&s.tick>=w.shieldAt){addShield(s,`${w.id}-tree`,m.autoShield,ticks(m.shieldDuration??6));w.shieldAt=s.tick+ticks(m.shieldInterval??15);}
    if(s.tick>=w.nextAttack&&attack(s,w))w.nextAttack=s.tick+deepWeaponStats(s,w).interval;
  }
}
