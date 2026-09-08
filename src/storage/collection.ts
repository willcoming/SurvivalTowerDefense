import { CHALLENGES, MAIN_IDS, SIDE_IDS } from '../data/campaign';
import { FORM_MAP, POOL, STARTER_FORMS, originalForm } from '../data/forms';
import type { CharacterId, FormId, RunState } from '../sim/types';
import { RECRUIT_RULES, pickRecruitment } from '../data/recruitment';

export interface CollectionReceipt {id:number;kind:'draw'|'exchange';formId:FormId;duplicate:boolean;spent:'ticket'|'points';guaranteed?:boolean;pointsGained?:number}
export interface CollectionState {
  drawsSinceNew?:number;
  difficultyClaims?:Record<string,number>;
  rewardVersion?:2;
  version:2;owned:FormId[];equipped:Partial<Record<CharacterId,FormId>>;
  tickets:number;points:number;claimed:string[];completionGranted:boolean;
  sequence:number;lastReceipt:CollectionReceipt|null;
}
export type CollectionAction={type:'draw'}|{type:'exchange';formId:FormId}|{type:'equip';formId:FormId};
export const REWARD_GOALS=[...[...MAIN_IDS,...SIDE_IDS].map(id=>`stage:${id}`),...MAIN_IDS.flatMap(id=>CHALLENGES.map(c=>`challenge:${id}:${c}`))];
export const createCollection=():CollectionState=>({version:2,rewardVersion:2,owned:[...STARTER_FORMS],equipped:{},tickets:0,points:0,claimed:[],completionGranted:false,sequence:0,lastReceipt:null});

type LegacyCollection = Omit<CollectionState,'version'|'lastReceipt'> & {
  version:1;fragments:number;
  lastReceipt:(Omit<CollectionReceipt,'spent'|'pointsGained'> & {spent:'ticket'|'points'|'fragments';fragmentsGained?:number})|null;
};
/** Repository callers write this conversion in the same revision-checked transaction. */
export function migrateCollection(raw:unknown):CollectionState {
  if(!raw||typeof raw!=='object')throw new Error('招募紀錄損壞');
  const source=raw as CollectionState|LegacyCollection;
  if(source.version===1){
    if(![source.points,source.fragments,source.points+source.fragments].every(n=>Number.isSafeInteger(n)&&n>=0))throw new Error('共鳴點數紀錄損壞');
    const {fragments,lastReceipt,...rest}=source;
    let receipt:CollectionReceipt|null=null;
    if(lastReceipt){
      const {fragmentsGained,spent,...oldReceipt}=lastReceipt;
      if(fragmentsGained!==undefined&&(!Number.isSafeInteger(fragmentsGained)||fragmentsGained<0))throw new Error('招募結果紀錄損壞');
      receipt={...oldReceipt,spent:spent==='fragments'?'points':spent,pointsGained:fragmentsGained??(lastReceipt.duplicate?10:0)};
    }
    const migrated:CollectionState={...rest,version:2,points:source.points+fragments,lastReceipt:receipt};
    validateCollection(migrated);
    return migrated;
  }
  validateCollection(source);
  return source;
}
export const missingForms=(c:CollectionState)=>POOL.filter(f=>!c.owned.includes(f.id));
export const ownedForm=(c:CollectionState,id:CharacterId)=>c.equipped[id]??(c.owned.includes(originalForm(id))?originalForm(id):c.owned.find(f=>FORM_MAP[f].ownerId===id));
export const isPlayable=(c:CollectionState,id:CharacterId)=>!!ownedForm(c,id);
export function syncRewards(c:CollectionState,profile:{cleared:string[];challengeClears:string[]},legacyRewards=false){
  const completed=new Set([...profile.cleared.map(id=>`stage:${id}`),...profile.challengeClears.map(id=>`challenge:${id}`)]);
  for(const goal of REWARD_GOALS)if(completed.has(goal)&&!c.claimed.includes(goal)){c.claimed.push(goal);if(legacyRewards){if(goal.startsWith('stage:'))c.tickets++;else c.points+=25;}}
  if(!c.completionGranted&&c.claimed.length===REWARD_GOALS.length){c.owned.push(...missingForms(c).map(f=>f.id));c.completionGranted=true;}
}
export function validateCollection(c:CollectionState){
  if(c?.rewardVersion!==undefined&&c.rewardVersion!==2)throw new Error('獎勵紀錄版本不相容');
  if(c?.drawsSinceNew!==undefined&&(!Number.isInteger(c.drawsSinceNew)||c.drawsSinceNew<0||c.drawsSinceNew>=RECRUIT_RULES.guaranteeAt))throw new Error('招募保底紀錄損壞');
  if(c?.lastReceipt&&(c.lastReceipt.guaranteed!==undefined&&typeof c.lastReceipt.guaranteed!=='boolean'||c.lastReceipt.pointsGained!==undefined&&(!Number.isSafeInteger(c.lastReceipt.pointsGained)||c.lastReceipt.pointsGained<0)))throw new Error('招募結果紀錄損壞');
  if(c?.difficultyClaims!==undefined&&(!c.difficultyClaims||Array.isArray(c.difficultyClaims)||typeof c.difficultyClaims!=='object'||Object.entries(c.difficultyClaims).some(([key,tier])=>!([...MAIN_IDS,...SIDE_IDS] as string[]).includes(key.split(':')[0])||!/^.+:(easy|hard|challenge:(four|no-skill|two-evolutions))$/.test(key)||key.includes(':challenge:')&&!MAIN_IDS.includes(key.split(':')[0] as typeof MAIN_IDS[number])||!Number.isInteger(tier)||tier<0||tier>3)))throw new Error('難度獎勵紀錄損壞');
  if(!c||c.version!==2||Object.hasOwn(c,'fragments')||!Array.isArray(c.owned)||new Set(c.owned).size!==c.owned.length||c.owned.some(id=>!FORM_MAP[id])||STARTER_FORMS.some(id=>!c.owned.includes(id))||!c.equipped||Object.entries(c.equipped).some(([id,f])=>!f||!c.owned.includes(f)||FORM_MAP[f].ownerId!==id)||![c.tickets,c.points,c.sequence].every(n=>Number.isSafeInteger(n)&&n>=0)||!Array.isArray(c.claimed)||new Set(c.claimed).size!==c.claimed.length||c.claimed.some(id=>!REWARD_GOALS.includes(id))||typeof c.completionGranted!=='boolean')throw new Error('招募紀錄損壞');
  if(c.completionGranted&&(c.claimed.length!==51||missingForms(c).length))throw new Error('收集保底紀錄損壞');
  if(c.lastReceipt&&(!FORM_MAP[c.lastReceipt.formId]||!Number.isSafeInteger(c.lastReceipt.id)||c.lastReceipt.id<1||c.lastReceipt.id>c.sequence||!['draw','exchange'].includes(c.lastReceipt.kind)||typeof c.lastReceipt.duplicate!=='boolean'||!['ticket','points'].includes(c.lastReceipt.spent)))throw new Error('招募結果紀錄損壞');
}
/** Mutate only a transaction-local copy; sample randomness after revision validation. */
export function applyCollectionAction(c:CollectionState,action:CollectionAction,random:()=>number){
  if(action.type==='equip'){
    const f=FORM_MAP[action.formId];if(!f||!c.owned.includes(f.id))throw new Error('尚未取得這個形態');c.equipped[f.ownerId]=f.id;c.sequence++;return;
  }
  if(!missingForms(c).length)throw new Error('本期已全收集，保留所有未使用資源');
  let formId:FormId,spent:CollectionReceipt['spent'],guaranteed=false;
  if(action.type==='exchange'){
    if(c.points<RECRUIT_RULES.exchangeCost||!POOL.some(f=>f.id===action.formId)||c.owned.includes(action.formId))throw new Error('需 100 共鳴點數並選擇尚未持有的形態');
    c.points-=RECRUIT_RULES.exchangeCost;formId=action.formId;spent='points';
  }else{
    if(c.tickets>0){c.tickets--;spent='ticket';}else if(c.points>=RECRUIT_RULES.drawCost){c.points-=RECRUIT_RULES.drawCost;spent='points';}else throw new Error('招募需要 1 張招募券或 100 共鳴點數');
    guaranteed=(c.drawsSinceNew??0)>=RECRUIT_RULES.guaranteeAt-1;
    formId=pickRecruitment(guaranteed?missingForms(c):POOL,random());
  }
  const duplicate=c.owned.includes(formId),pointsGained=duplicate?RECRUIT_RULES.duplicatePoints:0;
  if(duplicate)c.points+=pointsGained;else c.owned.push(formId);
  if(action.type==='draw')c.drawsSinceNew=duplicate?(c.drawsSinceNew??0)+1:0;
  c.lastReceipt={id:++c.sequence,kind:action.type,formId,duplicate,spent,guaranteed,pointsGained};
}
export function validateRoster(c:CollectionState,config:RunState['config']){
  for(const id of config.squadIds){const f=config.forms?.[id]??originalForm(id);if(!c.owned.includes(f)||FORM_MAP[f].ownerId!==id)throw new Error('隊伍含有尚未取得的形態');}
}
