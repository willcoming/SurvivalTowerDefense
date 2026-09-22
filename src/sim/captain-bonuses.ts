import { usesReworkedSkills } from '../data/reworked-skills';
import type { Enemy, RunState } from './types';

export function captainDamageBonus(s:RunState,e:Enemy,direct:boolean,exposure:number,controlled:boolean){
 if(!usesReworkedSkills(s))return 0;
 switch(s.config.captainId){
  case 'C01':return direct&&exposure>0?.1:0;
  case 'C03':return direct&&(e.defId.startsWith('B')||['E07','E08'].includes(e.defId))?.08:0;
  case 'C04':return direct&&controlled?.1:0;
  case 'C05':return !direct?.15:0;
  case 'C07':return direct&&s.tick-e.spawnedAt>=240?.1:0;
  default:return 0;
 }
}
export const captainHaste=(s:RunState)=>usesReworkedSkills(s)&&s.config.captainId==='C08'&&s.enemies.some(e=>e.hp>0&&e.y>=350)?.1:0;
export const captainWallReduction=(s:RunState)=>usesReworkedSkills(s)&&s.config.captainId==='C06'&&s.shields.some(sh=>sh.value>0&&sh.expires>s.tick)?.1:0;
