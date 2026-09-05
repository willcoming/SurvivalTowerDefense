import { usesFreeSkills } from '../data/deep-trees';
import { deepMods, teamMod } from './deep-tree';
import { waveStats, eventMultiplier } from './operations';
import { emergencySupport, repairWall, reflectShield } from './deep-support';
import { usesSkillTrees } from '../data/skill-trees';
import { ultimateFor } from './skill-tree';
import { CHARACTER_MAP, ENEMY_MAP, ticks, WORLD } from '../data/content';
import type { CharacterId, DamagePacket, Effect, Enemy, EnemyId, RunState, VisualEvent } from './types';
import { visualPriority } from './visual';
export const boss=(e:Enemy)=>e.defId.startsWith('B');
export const alive=(s:RunState)=>s.enemies.filter(e=>e.hp>0);
export const distance=(a:{x:number,y:number},b:{x:number,y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
export function emit(s:RunState,e:Omit<VisualEvent,'seq'|'tick'>){
  const weapon=e.source?s.weapons.find(w=>w.id===e.source):undefined;
  s.events.push({...e,...(weapon&&usesSkillTrees(s)?{weaponTree:ultimateFor(s,weapon.id)?.split(/[:/]/)[0]}:{}),...(weapon?{weaponRank:weapon.rank,weaponBranch:weapon.branch}:{}),seq:++s.eventSeq,tick:s.tick});
  // Shed old decoration before primary attacks, and primary attacks before skill cues.
  if(s.events.length>100){
    // Already-presented old attacks must not permanently crowd out new hit/DoT cues.
    // Active visual lifetimes are owned by the renderer, independently of this delivery queue.
    // Retain at least one complete 3× catch-up batch (15 simulation steps).
    let index=s.events.findIndex(event=>event.tick<s.tick-15);
    if(index<0){index=0;let priority=4;for(let i=0;i<s.events.length;i++){const p=visualPriority(s.events[i]);if(p<priority){index=i;priority=p;if(!p)break;}}}
    s.events.splice(index,1);
  }
}
export function threat(s:RunState):Enemy[]{
  const rank=(e:Enemy)=>(e.chargeKind&&e.chargeUntil>s.tick)?(boss(e)?4:e.defId==='E05'?3:0):(e.y>=WORLD.wallY?2:0);
  return alive(s).sort((a,b)=>rank(b)-rank(a)||b.y-a.y||a.id-b.id);
}
export function area(s:RunState,x:number,y:number,radius:number){return alive(s).filter(e=>distance(e,{x,y})<=radius+e.radius).sort((a,b)=>distance(a,{x,y})-distance(b,{x,y})||a.id-b.id).slice(0,20);}
export function computeDamage(raw:number,shield:number,armor:number,ignore=0,exposure=0,multiplier=1,armorBreak=0){
  const shieldDamage=Math.min(Math.max(0,shield),raw*multiplier);
  const hpDamage=Math.max(0,raw-shieldDamage/multiplier)*(1-Math.min(.7,Math.max(0,armor-armorBreak))*(1-ignore))*(1+Math.min(.25,Math.max(0,exposure)));
  return {shieldDamage,hpDamage};
}
export function interrupt(s:RunState,e:Enemy){if(e.chargeKind&&!e.chargeCancelled&&e.chargeUntil>s.tick){e.chargeCancelled=true;emit(s,{kind:'interrupt',x:e.x,y:e.y});}}
export function applyEffect(s:RunState,e:Enemy,effect:Effect){
  if(e.hp<=0)return;
  if(effect.kind==='stun'&&boss(e)){
    if(e.stunImmuneUntil>s.tick)return;
    effect={...effect,expires:Math.min(effect.expires,s.tick+ticks(.25))};e.stunImmuneUntil=s.tick+ticks(6);
  }
  if(effect.kind==='slow')effect={...effect,value:Math.min(effect.value,boss(e)?.2:.6)};
  let same=e.effects.find(f=>f.id===effect.id);
  if(same&&effect.kind==='burn'&&(same.value!==effect.value||same.armorIgnore!==effect.armorIgnore)){same.id+=`@${s.tick}:${same.value}`;same=undefined;}
  if(same){const cadence=effect.kind==='burn'?Math.min(same.nextTick,effect.nextTick):effect.nextTick;Object.assign(same,effect);same.nextTick=cadence;}else e.effects.push({...effect});
  if(effect.kind==='stun')interrupt(s,e);
}
export function knockback(s:RunState,e:Enemy,amount:number){
  if(boss(e)){if(e.moveImmuneUntil>s.tick)return;e.moveImmuneUntil=s.tick+ticks(6);amount*=.25;}
  if(usesFreeSkills(s))amount*=eventMultiplier(s,e.wave,'displacement');
  e.y=Math.max(WORLD.spawnY,e.y-amount);e.attackAt=0;interrupt(s,e);
}
export function addShield(s:RunState,source:string,value:number,duration:number){
  s.shields=s.shields.filter(x=>x.expires>s.tick&&x.value>0);
  const existing=s.shields.find(x=>x.source===source);const others=s.shields.filter(x=>x!==existing).reduce((n,x)=>n+x.value,0);
  const next=Math.min(300+(usesFreeSkills(s)?teamMod(s,'shieldCapacity'):0)-others,Math.max(existing?.value??0,value));
  if(existing){existing.value=next;existing.expires=s.tick+duration;}else s.shields.push({source,value:next,expires:s.tick+duration});
  emit(s,{kind:'shield',x:195,y:450,value:next});
}
export function hitWall(s:RunState,value:number,source:EnemyId){
  const free=usesFreeSkills(s);if(free)emergencySupport(s);
  const reduction=free?Math.min(.4,teamMod(s,'wallReduction')):0;
  let remaining=value*(1-reduction),absorbed=0;if(s.support)s.support.prevented+=value-remaining;
  s.shields=s.shields.filter(x=>x.expires>s.tick&&x.value>0).sort((a,b)=>a.expires-b.expires||a.source.localeCompare(b.source));
  for(const shield of s.shields){const v=Math.min(remaining,shield.value);shield.value-=v;remaining-=v;s.stats.shieldAbsorbed+=v;absorbed+=v;}
  const damage=Math.min(s.wallHp,remaining);s.wallHp-=damage;s.stats.wallDamageByEnemy[source]=(s.stats.wallDamageByEnemy[source]??0)+damage;
  emit(s,{kind:'wall-hit',x:195,y:450,value:damage});
  if(free&&s.support){const repair=teamMod(s,'emergencyRepair');if(repair)s.support.damageTaken+=damage;if(repair&&s.support.damageTaken>=100){const count=Math.floor(s.support.damageTaken/100);s.support.damageTaken%=100;repairWall(s,repair*count);}reflectShield(s,absorbed);emergencySupport(s);}
}
export function hitEnemy(s:RunState,e:Enemy,p:DamagePacket){
  if(e.hp<=0)return;
  const exposure=Math.max(e.exposureUntil>s.tick?.25:0,...e.effects.filter(f=>f.kind==='exposure'&&f.expires>s.tick).map(f=>f.value),0);
  const free=usesFreeSkills(s),direct=p.skill!=='burn'&&p.skill!=='gravity-field';
  const controlled=e.effects.some(f=>(f.kind==='slow'||f.kind==='stun')&&f.expires>s.tick);
  const conditional=free&&direct?(exposure>0?teamMod(s,'teamExposeDamage'):0)+(controlled?(p.controlledBonus??0)+teamMod(s,'teamControlDamage'):0)+(e.hp/e.maxHp<=(p.executeThreshold??0)?p.executeDamage??0:0):0;
  const raw=p.raw*(1+(exposure>0?(p.exposureBonus??0):0)+conditional)*(free?eventMultiplier(s,e.wave,p.damageType):1);
  const armorBreak=free&&e.armorBroken&&e.armorBroken.expires>s.tick?e.armorBroken.value:0;
  const result=computeDamage(raw,e.shield,e.armor,p.armorIgnore,exposure,p.shieldMultiplier,armorBreak);
  const previousShield=e.shield;e.shield-=result.shieldDamage;const damage=Math.min(e.hp,result.hpDamage);e.hp-=damage;
  s.stats.damageByCharacter[p.source]+=damage;s.stats.shieldDamageByCharacter[p.source]+=result.shieldDamage;
  emit(s,{kind:'hit',x:e.x,y:e.y,value:damage+result.shieldDamage,source:p.source,color:CHARACTER_MAP[p.source].color,targetId:e.id,enemyDefId:e.defId,skill:p.skill});
  if(previousShield>0&&e.shield<=0&&e.defId==='B02'){interrupt(s,e);e.exposureUntil=s.tick+ticks(6);}
  if(e.hp<=0){
    s.stats.kills++;s.xp+=e.xp;s.choicesEarned=free?Math.min(24,2*Math.floor(s.xp/60)):Math.min(18,Math.floor(s.xp/40));
    if(boss(e))s.bossKilled=true;emit(s,{kind:'death',x:e.x,y:e.y,source:p.source,targetId:e.id,enemyDefId:e.defId});
    if(free){
      const m=deepMods(s,p.source),near=alive(s).filter(t=>distance(t,e)<=100).sort((a,b)=>distance(a,e)-distance(b,e)||a.id-b.id);
      if(m.markSpread&&exposure>0)for(const t of near.slice(0,m.markSpread))applyEffect(s,t,{id:`exposure:${p.source}:spread`,kind:'exposure',source:p.source,value:.1,expires:s.tick+ticks(4),armorIgnore:0,nextTick:0});
      const fire=e.effects.filter(f=>f.kind==='burn'&&f.expires>s.tick).sort((a,b)=>b.value-a.value)[0];
      if(m.fireSpread&&fire)for(const t of near.slice(0,m.fireSpread))applyEffect(s,t,{...fire,id:`burn:${p.source}:spread`,nextTick:s.tick+15});
      const repair=teamMod(s,'killRepair');if(repair&&s.stats.kills%12===0)repairWall(s,repair);
    }
    return;
  }
  if(free&&p.armorBreak)e.armorBroken={value:Math.max(e.armorBroken&&e.armorBroken.expires>s.tick?e.armorBroken.value:0,p.armorBreak),expires:s.tick+ticks(4)};
  if(p.exposure)applyEffect(s,e,{id:`exposure:${p.source}`,kind:'exposure',source:p.source,value:p.exposure.value,expires:s.tick+p.exposure.duration,armorIgnore:0,nextTick:0});
  if(p.burn)applyEffect(s,e,{id:`burn:${p.source}:${p.burn.key}`,kind:'burn',source:p.source,value:p.burn.dps,expires:s.tick+p.burn.duration,nextTick:s.tick+15,armorIgnore:p.burn.armorIgnore});
  if(p.slow)applyEffect(s,e,{id:`slow:${p.source}:${p.skill}`,kind:'slow',source:p.source,value:p.slow.value,expires:s.tick+p.slow.duration,nextTick:0,armorIgnore:0});
  if(p.stun)applyEffect(s,e,{id:`stun:${p.source}:${p.skill}`,kind:'stun',source:p.source,value:1,expires:s.tick+p.stun,nextTick:0,armorIgnore:0});
  if(p.knockback)knockback(s,e,p.knockback);
  if(!e.phaseTriggered&&e.hp<=e.maxHp/2){
    if(e.defId==='E07'){e.phaseTriggered=true;e.shield+=300;}
    if(e.defId==='B03'){e.phaseTriggered=true;e.shield+=1500;}
    if(e.defId==='E08'){e.phaseTriggered=true;e.chargeKind='rush';e.chargeUntil=s.tick+ticks(1.2);e.chargeCancelled=false;}
  }
}
export function stepEffects(s:RunState){
  for(const e of alive(s)){
    const burns=e.effects.filter(f=>f.kind==='burn'&&f.expires>=s.tick);
    for(const source of new Set(burns.map(f=>f.source))){
      const own=burns.filter(f=>f.source===source);const best=own.sort((a,b)=>b.value-a.value||b.armorIgnore-a.armorIgnore)[0];
      if(best&&best.nextTick<=s.tick){hitEnemy(s,e,{source:source as CharacterId,skill:'burn',raw:best.value*.5,damageType:'thermal',armorIgnore:best.armorIgnore,shieldMultiplier:1});for(const f of own)f.nextTick=s.tick+15;}
    }
    e.effects=e.effects.filter(f=>f.expires>s.tick);
    for(const source of new Set(e.effects.filter(f=>f.kind==='slow'||f.kind==='stun').map(f=>f.source)))if(source!=='boss')s.stats.controlTicks[source]++;
  }
}
export function createEnemy(s:RunState,defId:EnemyId,x:number,y:number,xp=0,wave=0):Enemy{
  const d=ENEMY_MAP[defId];const isBoss=defId.startsWith('B');const multiplier=isBoss?1:({S01:1,S02:1.1,S03:1.2}[s.config.stageId]);
  const e:Enemy={id:s.nextEntityId++,defId,x,y,hp:d.hp*multiplier,maxHp:d.hp*multiplier,shield:d.shield*multiplier,armor:d.armor,speed:d.speed,radius:d.radius,xp,wave,spawnedAt:s.tick,effects:[],attackAt:0,abilityAt:s.tick+ticks(defId==='B03'?5:isBoss?d.interval:8),summonAt:s.tick+ticks(defId==='B01'?18:defId==='B02'?20:24),chargeUntil:0,chargeKind:null,chargeCancelled:false,phaseTriggered:false,rushUntil:0,stunImmuneUntil:0,moveImmuneUntil:0,exposureUntil:0,summonCount:0,arcCharges:0};
  if(usesFreeSkills(s)){const values=waveStats(s,defId,wave);e.hp=e.maxHp=values.hp;e.shield=values.shield;e.armor=values.armor;e.speed=values.speed;}
  s.enemies.push(e);if(!s.stats.encountered.includes(defId))s.stats.encountered.push(defId);emit(s,{kind:'spawn',x,y});return e;
}
