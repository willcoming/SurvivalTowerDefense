import { ticks, WORLD } from '../data/content';
import { deepMods, teamMod } from './deep-tree';
import { usesFreeSkills } from '../data/deep-trees';
import { addShield, alive, emit, hitEnemy, knockback } from './combat';
import type { RunState } from './types';
import { equippedForm, usesCollection } from '../data/forms';

export function repairWall(s:RunState,amount:number){
  if(!s.support||s.wallHp<=0)return;
  const healed=Math.min(s.wallMaxHp-s.wallHp,amount*(1+teamMod(s,'repairBonus')));
  s.wallHp+=healed;s.support.repaired+=healed;
  if(healed>0)emit(s,{kind:'shield',x:195,y:450,value:healed,color:'#7fd4b2',skill:'repair'});
}
export function emergencySupport(s:RunState){
  const state=s.support;if(!usesFreeSkills(s)||!state||s.wallHp<=0)return;
  const shield=teamMod(s,'emergencyShield')+(deepMods(s,'C06').emergencyShield??0)*(equippedForm(s,'C06').shield-1);
  if(shield&&s.wallHp/s.wallMaxHp<.35&&s.tick>=state.emergencyAt){addShield(s,'emergency',shield,ticks(8));state.emergencyAt=s.tick+ticks(45);}
  const rescue=teamMod(s,'secondWind');
  if(rescue&&!state.secondWindUsed&&s.wallHp/s.wallMaxHp<.2){state.secondWindUsed=1;repairWall(s,rescue);}
}
export function stepSupport(s:RunState){
  const state=s.support;if(!usesFreeSkills(s)||!state)return;
  const m=deepMods(s,'common');
  if(m.periodicRepair&&s.tick>=state.repairAt){repairWall(s,m.periodicRepair);state.repairAt=s.tick+ticks(20);}
  if(m.pulseShield&&s.tick>=state.pulseAt){addShield(s,'common-pulse',m.pulseShield,ticks(8));state.pulseAt=s.tick+ticks(18);}
  if(m.emergencyRepulse&&s.tick>=state.repulseAt&&alive(s).some(e=>e.y>=WORLD.wallY-8)){
    const targets=alive(s).filter(e=>e.y>=WORLD.wallY-85);for(const e of targets)knockback(s,e,m.emergencyRepulse);
    emit(s,{kind:'explosion',source:s.config.captainId,x:195,y:440,radius:90,affectedIds:targets.map(e=>e.id),skill:'repulse'});state.repulseAt=s.tick+ticks(20);
  }
  emergencySupport(s);
}
export function reflectShield(s:RunState,absorbed:number){
  const rate=teamMod(s,'shieldReflect');if(!rate||!absorbed||!s.support)return;
  const target=alive(s).sort((a,b)=>b.y-a.y||a.id-b.id)[0];if(!target)return;
  const value=absorbed*Math.min(1,rate);s.support.reflected+=value;
  hitEnemy(s,target,{source:s.config.squadIds.includes('C06')?'C06':s.config.captainId,skill:'shield-reflect',raw:value,damageType:'plasma',armorIgnore:1,shieldMultiplier:1,secondary:true});
  emit(s,{kind:'beam',source:usesCollection(s)&&s.config.squadIds.includes('C06')?'C06':s.config.captainId,x:195,y:440,x2:target.x,y2:target.y,skill:'shield-reflect'});
}
