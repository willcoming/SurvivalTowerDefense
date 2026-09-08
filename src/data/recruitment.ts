import { POOL, type FormDef } from './forms';

export const RECRUIT_RULES = { guaranteeAt:10, duplicatePoints:20, drawCost:100, exchangeCost:100 } as const;
export const recruitmentWeight = (form:FormDef) => form.theme==='original'?12:7;
const totalWeight=POOL.reduce((sum,form)=>sum+recruitmentWeight(form),0);
export const recruitmentRate = (form:FormDef) => recruitmentWeight(form)/totalWeight*100;
/** Guaranteed draws renormalize these same weights over unowned entries. */
export function pickRecruitment(pool:FormDef[],roll:number){
  if(!pool.length||!Number.isFinite(roll)||roll<0||roll>=1)throw new Error('招募亂數無效');
  const total=pool.reduce((sum,form)=>sum+recruitmentWeight(form),0);
  let cursor=roll*total;
  for(const form of pool){cursor-=recruitmentWeight(form);if(cursor<0)return form.id;}
  return pool[pool.length-1].id;
}
