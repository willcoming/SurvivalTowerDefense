import { CHALLENGES, MAIN_IDS, SIDE_IDS } from '../data/campaign';
import { FORM_MAP, POOL, STARTER_FORMS, originalForm } from '../data/forms';
import type { CharacterId, FormId, RunState } from '../sim/types';

export interface CollectionReceipt {id:number;kind:'draw'|'exchange';formId:FormId;duplicate:boolean;spent:'ticket'|'points'|'fragments'}
export interface CollectionState {
  version:1;owned:FormId[];equipped:Partial<Record<CharacterId,FormId>>;
  tickets:number;points:number;fragments:number;claimed:string[];completionGranted:boolean;
  sequence:number;lastReceipt:CollectionReceipt|null;
}
export type CollectionAction={type:'draw'}|{type:'exchange';formId:FormId}|{type:'equip';formId:FormId};
export const REWARD_GOALS=[...[...MAIN_IDS,...SIDE_IDS].map(id=>`stage:${id}`),...MAIN_IDS.flatMap(id=>CHALLENGES.map(c=>`challenge:${id}:${c}`))];
export const createCollection=():CollectionState=>({version:1,owned:[...STARTER_FORMS],equipped:{},tickets:0,points:0,fragments:0,claimed:[],completionGranted:false,sequence:0,lastReceipt:null});
export const missingForms=(c:CollectionState)=>POOL.filter(f=>!c.owned.includes(f.id));
export const ownedForm=(c:CollectionState,id:CharacterId)=>c.equipped[id]??(c.owned.includes(originalForm(id))?originalForm(id):c.owned.find(f=>FORM_MAP[f].ownerId===id));
export const isPlayable=(c:CollectionState,id:CharacterId)=>!!ownedForm(c,id);
export function syncRewards(c:CollectionState,profile:{cleared:string[];challengeClears:string[]}){
  const completed=new Set([...profile.cleared.map(id=>`stage:${id}`),...profile.challengeClears.map(id=>`challenge:${id}`)]);
  for(const goal of REWARD_GOALS)if(completed.has(goal)&&!c.claimed.includes(goal)){c.claimed.push(goal);if(goal.startsWith('stage:'))c.tickets++;else c.points+=25;}
  if(!c.completionGranted&&c.claimed.length===REWARD_GOALS.length){c.owned.push(...missingForms(c).map(f=>f.id));c.completionGranted=true;}
}
export function validateCollection(c:CollectionState){
  if(!c||c.version!==1||!Array.isArray(c.owned)||new Set(c.owned).size!==c.owned.length||c.owned.some(id=>!FORM_MAP[id])||STARTER_FORMS.some(id=>!c.owned.includes(id))||!c.equipped||Object.entries(c.equipped).some(([id,f])=>!f||!c.owned.includes(f)||FORM_MAP[f].ownerId!==id)||![c.tickets,c.points,c.fragments,c.sequence].every(n=>Number.isSafeInteger(n)&&n>=0)||!Array.isArray(c.claimed)||new Set(c.claimed).size!==c.claimed.length||c.claimed.some(id=>!REWARD_GOALS.includes(id))||typeof c.completionGranted!=='boolean')throw new Error('招募紀錄損壞');
  if(c.completionGranted&&(c.claimed.length!==51||missingForms(c).length))throw new Error('收集保底紀錄損壞');
  if(c.lastReceipt&&(!FORM_MAP[c.lastReceipt.formId]||!Number.isSafeInteger(c.lastReceipt.id)||c.lastReceipt.id<1||c.lastReceipt.id>c.sequence||!['draw','exchange'].includes(c.lastReceipt.kind)||typeof c.lastReceipt.duplicate!=='boolean'||!['ticket','points','fragments'].includes(c.lastReceipt.spent)))throw new Error('招募結果紀錄損壞');
}
/** Mutate only a transaction-local copy; sample randomness after revision validation. */
export function applyCollectionAction(c:CollectionState,action:CollectionAction,random:()=>number){
  if(action.type==='equip'){
    const f=FORM_MAP[action.formId];if(!f||!c.owned.includes(f.id))throw new Error('尚未取得這個形態');c.equipped[f.ownerId]=f.id;c.sequence++;return;
  }
  if(!missingForms(c).length)throw new Error('本期已全收集，保留所有未使用資源');
  let formId:FormId,spent:CollectionReceipt['spent'];
  if(action.type==='exchange'){
    if(c.fragments<100||!POOL.some(f=>f.id===action.formId)||c.owned.includes(action.formId))throw new Error('需 100 共鳴碎片並選擇尚未持有的形態');
    c.fragments-=100;formId=action.formId;spent='fragments';
  }else{
    if(c.tickets>0){c.tickets--;spent='ticket';}else if(c.points>=100){c.points-=100;spent='points';}else throw new Error('招募需要 1 張招募券或 100 招募點數');
    const roll=random();if(!Number.isFinite(roll)||roll<0||roll>=1)throw new Error('招募亂數無效');formId=POOL[Math.floor(roll*POOL.length)].id;
  }
  const duplicate=c.owned.includes(formId);if(duplicate)c.fragments+=10;else c.owned.push(formId);
  c.lastReceipt={id:++c.sequence,kind:action.type,formId,duplicate,spent};
}
export function validateRoster(c:CollectionState,config:RunState['config']){
  for(const id of config.squadIds){const f=config.forms?.[id]??originalForm(id);if(!c.owned.includes(f)||FORM_MAP[f].ownerId!==id)throw new Error('隊伍含有尚未取得的形態');}
}
