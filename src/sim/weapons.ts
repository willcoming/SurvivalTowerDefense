import { CHARACTER_MAP, ticks, WORLD } from '../data/content';
import { addShield, alive, applyEffect, area, distance, emit, hitEnemy, threat } from './combat';
import type { CharacterId, DamagePacket, Enemy, RunState, WeaponState } from './types';
export function weaponStats(s:RunState,w:WeaponState){
  const d=CHARACTER_MAP[w.id],a=w.branch==='A',b=w.branch==='B',r=w.rank,e=r===3;
  let bonus=(s.commonRanks.G01??0)*.08,as=(s.commonRanks.G02??0)*.06;
  let base=d.damage,interval=d.interval,radius=w.id==='C04'?45:w.id==='C05'?48:0;
  let radiusBonus=(s.commonRanks.G03??0)*.1,durationBonus=(s.commonRanks.G06??0)*.1,burnBonus=bonus;
  if(w.id==='C01'){if(r>=1)bonus+=a?.15:.2;if(a&&r>=2)as+=.15;if(e){base*=a?.65:1.8;if(b)interval*=1.25;}}
  if(w.id==='C02'){if(b&&r>=1)bonus+=.2;if(b&&r>=2)as+=.15;}
  if(w.id==='C03'){if(a&&r>=1)bonus+=.15;if(a&&r>=2)as+=.12;if(b&&r>=2)bonus+=.15;if(b&&e){base*=2.2;interval*=1.4;}}
  if(w.id==='C04'){if(a&&r>=1)radiusBonus+=.15;if(a&&r>=2)durationBonus+=.2;if(b&&r>=1)bonus+=.15;if(b&&r>=2)as+=.15;if(a&&e){base=14;interval=4;radius=85;}}
  if(w.id==='C05'){if(a&&r>=1)burnBonus+=.25;if(b&&r>=1)bonus+=.2;if(r>=2)radiusBonus+=.15;if(e){base*=a?.8:2.2;if(b){interval*=1.6;radius*=1.4;}}}
  if(w.id==='C06'){if(r>=1)bonus+=.15;if(b&&r>=2)as+=.15;if(e)base*=a?.65:1.3;}
  return {damage:base*(1+bonus),bonus,interval:ticks(Math.max(.1,interval/(1+as))),radius:radius*(1+radiusBonus),duration:1+durationBonus,burnDamage:1+burnBonus,radiusMultiplier:1+radiusBonus};
}
function packet(s:RunState,w:WeaponState):DamagePacket{
  const n=weaponStats(s,w);return{source:w.id,skill:'weapon',raw:n.damage,damageType:CHARACTER_MAP[w.id].damageType,armorIgnore:w.id==='C03'?.35:0,shieldMultiplier:w.id==='C02'?1.25:w.id==='C01'&&w.branch==='B'&&w.rank>=2?(w.rank===3?2:1.5):1,exposureBonus:w.id==='C01'?.15/(1+n.bonus):0};
}
function scaled(p:DamagePacket,n:number){return {...p,raw:p.raw*n};}
function beam(s:RunState,w:WeaponState,e:Enemy,p:DamagePacket){emit(s,{kind:'beam',x:195,y:490,x2:e.x,y2:e.y,source:w.id});hitEnemy(s,e,p);}
function lineTargets(s:RunState,target:Enemy,count:number):Enemy[]{
  const dx=target.x-195,dy=target.y-490,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
  return alive(s).filter(e=>{const x=e.x-195,y=e.y-490;return x*ux+y*uy>=0&&Math.abs(x*uy-y*ux)<=e.radius+7;}).sort((a,b)=>distance(a,WORLD_ORIGIN)-distance(b,WORLD_ORIGIN)||a.id-b.id).slice(0,count);
}
const WORLD_ORIGIN={x:WORLD.originX,y:WORLD.originY};
function fireBullet(s:RunState,target:Enemy,p:DamagePacket,count:number){
  const dx=target.x-195,dy=target.y-490,len=Math.hypot(dx,dy);
  s.projectiles.push({id:s.nextEntityId++,x:195,y:490,tx:target.x,ty:target.y,vx:dx/len*700,vy:dy/len*700,expires:s.tick+ticks(1.2),hitIds:[],remaining:count,falloff:[1,.8,.8],radius:4,blastRadius:0,packet:p,enemyDamage:0,enemySource:null,impactAt:0});
  emit(s,{kind:'shot',x:195,y:490,x2:target.x,y2:target.y,source:p.source});
}
function attack(s:RunState,w:WeaponState){
  const all=threat(s);if(!all.length)return false;let target=all[0];const n=weaponStats(s,w),p=packet(s,w),e=w.rank===3,a=w.branch==='A';w.attacks++;
  if(w.id==='C01'){for(const t of all.slice(0,e&&a?3:1))fireBullet(s,t,p,e&&!a?3:1);}
  if(w.id==='C02'){
    beam(s,w,target,p);
    if(e&&!a){if(target.hp>0&&++target.arcCharges>=3){target.arcCharges=0;for(const t of area(s,target.x,target.y,70*n.radiusMultiplier))hitEnemy(s,t,{...p,skill:'magnetic-burst',raw:70*(1+(s.commonRanks.G01??0)*.08),stun:ticks(n.duration)});emit(s,{kind:'explosion',x:target.x,y:target.y,radius:70*n.radiusMultiplier,source:w.id});}}
    else {const hits=new Set([target.id]);const jumps=e&&a?4:1;const coefficient=a&&w.rank>=2?.75:.6;const range=90*(a&&w.rank>=1?1.2:1);let factor=1;
      for(let i=0;i<jumps;i++){const next=alive(s).filter(t=>!hits.has(t.id)&&distance(t,target)<=range).sort((x,y)=>distance(x,target)-distance(y,target)||x.id-y.id)[0];if(!next)break;factor*=coefficient;emit(s,{kind:'arc',x:target.x,y:target.y,x2:next.x,y2:next.y,source:w.id});hitEnemy(s,next,scaled(p,factor));hits.add(next.id);target=next;}
    }
  }
  if(w.id==='C03'){
    target=all.sort((x,y)=>y.maxHp-x.maxHp||x.id-y.id)[0];const targets=e&&!a?[target]:lineTargets(s,target,e&&a?6:2);const falloff=e&&a?[1,.9,.8,.7,.6,.5]:[1,.7];
    emit(s,{kind:'beam',x:195,y:490,x2:target.x,y2:target.y,source:w.id});
    targets.forEach((t,i)=>hitEnemy(s,t,scaled(p,(falloff[i]??1)*(!a&&w.rank>=1&&['E07','E08','B01','B02','B03'].includes(t.defId)?(1+n.bonus+.2)/(1+n.bonus):1))));
  }
  if(w.id==='C04'){
    if(e&&a){s.fields=s.fields.filter(f=>!(f.source===w.id&&f.kind==='gravity'));s.fields.push({id:s.nextEntityId++,source:w.id,kind:'gravity',x:target.x,y:target.y,radius:n.radius,expires:s.tick+ticks(3),nextTick:s.tick+15,dps:n.damage,damageType:'gravity',slow:.3,slowDuration:ticks(.6*n.duration),pull:18,burnDuration:0,armorIgnore:0});}
    else {for(const t of area(s,target.x,target.y,n.radius))hitEnemy(s,t,{...p,slow:{value:.2,duration:ticks(1.5*n.duration)},knockback:e&&!a&&w.attacks%5===0?70:0});emit(s,{kind:'explosion',x:target.x,y:target.y,radius:n.radius,source:w.id});}
  }
  if(w.id==='C05'){
    if(!(e&&!a))p.burn={dps:4*n.burnDamage,duration:ticks(3*n.duration),armorIgnore:.5,key:'weapon'};
    s.projectiles.push({id:s.nextEntityId++,x:195,y:490,tx:target.x,ty:target.y,vx:0,vy:0,expires:s.tick+ticks(.45),hitIds:[],remaining:1,falloff:[1],radius:6,blastRadius:n.radius,packet:p,enemyDamage:0,enemySource:null,impactAt:s.tick+ticks(.45),...(e&&a?{fire:{radius:70*n.radiusMultiplier,dps:8*n.burnDamage,duration:ticks(4),burnDuration:ticks(n.duration),armorIgnore:.5}}:{})});emit(s,{kind:'shot',x:195,y:490,x2:target.x,y2:target.y,source:w.id});
  }
  if(w.id==='C06'){
    for(let drone=0;drone<(e&&a?2:1);drone++){
      const t=threat(s)[0];if(!t)break;beam(s,w,t,p);w.droneAttacks[drone]++;
      if(w.droneAttacks[drone]%4===0)applyEffect(s,t,{id:`exposure:${w.id}`,kind:'exposure',source:w.id,value:e&&a?.2:.1,expires:s.tick+ticks((4+(a&&w.rank>=2?2:0))*n.duration),armorIgnore:0,nextTick:0});
    }
  }
  return true;
}
export function stepWeapons(s:RunState){
  for(const w of s.weapons){
    if(w.id==='C06'&&w.branch==='B'&&w.rank===3&&s.tick>=w.shieldAt){addShield(s,'C06-B',100,ticks(6));w.shieldAt=s.tick+ticks(15);}
    if(s.tick>=w.nextAttack&&attack(s,w))w.nextAttack=s.tick+weaponStats(s,w).interval;
  }
}
export function tacticalCooldown(s:RunState){return ticks(CHARACTER_MAP[s.config.captainId].cooldown*(1-(s.commonRanks.G04??0)*.06));}
export function castTactical(s:RunState):boolean{
  const id=s.config.captainId;if(s.tick<s.tacticalReadyAt||s.config.challengeId==='no-skill')return false;
  const target=threat(s)[0];if(!target&&id!=='C06')return false;let visualTarget=target;
  const bonus=1+(s.commonRanks.G01??0)*.08,duration=1+(s.commonRanks.G06??0)*.1,radius=1+(s.commonRanks.G03??0)*.1;
  const p:DamagePacket={source:id,skill:'tactical',raw:0,damageType:CHARACTER_MAP[id].damageType,armorIgnore:0,shieldMultiplier:id==='C02'?1.25:1};
  if(id==='C01'){for(const t of area(s,target.x,target.y,90*radius))hitEnemy(s,t,{...p,raw:35*bonus});for(let i=1;i<4;i++)s.scheduled.push({at:s.tick+i*ticks(.2),packet:{...p,raw:35*bonus},x:target.x,y:target.y,radius:90*radius,enemyDamage:0,enemySource:null});}
  if(id==='C02')for(const t of alive(s))hitEnemy(s,t,{...p,raw:60*bonus,stun:ticks(1.5*duration)});
  if(id==='C03'){const t=alive(s).sort((a,b)=>b.maxHp-a.maxHp||a.id-b.id)[0];visualTarget=t;hitEnemy(s,t,{...p,raw:420*bonus,armorIgnore:1});emit(s,{kind:'beam',x:195,y:490,x2:t.x,y2:t.y,source:id,skill:'tactical'});}
  if(id==='C04')for(const t of alive(s))hitEnemy(s,t,{...p,raw:0,slow:{value:.5,duration:ticks(5*duration)},knockback:60});
  if(id==='C05')for(const t of area(s,target.x,target.y,100*radius))hitEnemy(s,t,{...p,raw:160*bonus,burn:{dps:12*bonus,duration:ticks(5*duration),armorIgnore:.5,key:'tactical'}});
  if(id==='C06')addShield(s,'tactical:C06',220,ticks(8));
  s.tacticalReadyAt=s.tick+tacticalCooldown(s);s.stats.casts.push(s.tick);emit(s,{kind:'tactical',x:visualTarget?.x??195,y:visualTarget?.y??450,source:id,radius:(id==='C01'?90:100)*radius});return true;
}
export function applyUpgrade(s:RunState,nodeId:string){
  const before=new Map(s.weapons.map(w=>[w.id,weaponStats(s,w).interval]));const oldCooldown=tacticalCooldown(s);
  if(nodeId.startsWith('C')){const [id,branch,rank]=nodeId.split('-');const w=s.weapons.find(w=>w.id===id)!;w.branch=branch as 'A'|'B';w.rank=Number(rank);if(w.rank===2)w.readyAt=s.tick;if(w.rank===3){s.evolvedCount++;w.shieldAt=s.tick+ticks(15);emit(s,{kind:'evolution',x:195,y:490,source:w.id});}}
  if(nodeId.startsWith('G')){const [id,rank]=nodeId.split('-');s.commonRanks[id]=Number(rank);if(id==='G05'){s.wallMaxHp+=100;s.wallHp+=100;}}
  for(const w of s.weapons)w.nextAttack=s.tick+Math.ceil(Math.max(0,w.nextAttack-s.tick)*weaponStats(s,w).interval/before.get(w.id)!);
  s.tacticalReadyAt=s.tick+Math.ceil(Math.max(0,s.tacticalReadyAt-s.tick)*tacticalCooldown(s)/oldCooldown);
}
