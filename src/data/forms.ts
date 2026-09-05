import { assetUrl } from '../assets';
import type { CharacterId, DamageType, EnemyId, FormId, RunState } from '../sim/types';

export const COLLECTION_CONTENT_VERSION = '0.4.0-dev.1';
export const usesCollection = (s: Pick<RunState, 'contentVersion'>) => s.contentVersion === COLLECTION_CONTENT_VERSION;
export const STARTER_IDS: CharacterId[] = ['C01','C02','C03','C04','C05','C06'];
export const ELEMENTS: Record<DamageType,{name:string;icon:string;color:string;dot:string}> = {
  kinetic:{name:'動能',icon:'◆',color:'#acd3ef',dot:'碎裂'},
  plasma:{name:'電漿',icon:'✦',color:'#fa765e',dot:'電漿侵蝕'},
  arc:{name:'電弧',icon:'ϟ',color:'#c7a8ff',dot:'電荷侵蝕'},
  thermal:{name:'熱能',icon:'▲',color:'#ffb758',dot:'燃燒'},
  gravity:{name:'重力',icon:'◎',color:'#60d5b9',dot:'重力侵蝕'},
};
export const WEAKNESSES: Record<EnemyId,DamageType> = {E01:'thermal',E02:'gravity',E03:'kinetic',E04:'arc',E05:'plasma',E06:'thermal',E07:'kinetic',E08:'gravity',B01:'thermal',B02:'arc',B03:'plasma'};
export interface FormDef { id:FormId; ownerId:CharacterId; theme:'original'|'summer'; name:string; damageType:DamageType; passive:string; direct:number; radius:number; shield:number }
const ORIGINAL_TYPES:DamageType[]=['plasma','arc','kinetic','gravity','thermal','plasma','kinetic','thermal'];
const SUMMER: [string,DamageType,string,number,number,number][] = [
  ['浪潮救援','thermal','武器直擊附加 8 DPS 燃燒 2 秒；所有直擊傷害 −20%。',.8,1,1],
  ['海岸 DJ','plasma','弧鏈額外跳躍 1 人；每次命中傷害 −15%。',.85,1,1],
  ['晴海狙擊','gravity','對精英與首領傷害 +20%；對普通敵人傷害 −15%。',1,1,1],
  ['浮環樂園','arc','武器控場區域半徑 +25%；直擊傷害 −15%。',.85,1.25,1],
  ['烈日烤宴','thermal','武器與隊長爆炸半徑 +25%；直擊傷害 −20%。',.8,1.25,1],
  ['晴海守望','kinetic','自身產生的護盾 +25%（仍受護盾上限限制）；武器傷害 −15%。',.85,1,1.25],
  ['潮汐布雷師','plasma','同時地雷上限 +2；部署間隔 +25%。',1,1,1],
  ['海風快槍','arc','散熱速度 +35%；滿熱增傷由 +100% 降為 +65%。',1,1,1],
];
export const FORMS: FormDef[] = ORIGINAL_TYPES.flatMap((damageType,i)=>{
  const ownerId=`C0${i+1}` as CharacterId,[name,summerType,passive,direct,radius,shield]=SUMMER[i];
  return [{id:`${ownerId}-original` as FormId,ownerId,theme:'original' as const,name:'原始形態',damageType,passive:'原始武裝，保留角色固有被動。',direct:1,radius:1,shield:1},
    {id:`${ownerId}-summer` as FormId,ownerId,theme:'summer' as const,name,damageType:summerType,passive,direct,radius,shield}];
});
export const FORM_MAP=Object.fromEntries(FORMS.map(f=>[f.id,f])) as Record<FormId,FormDef>;
export const POOL=FORMS.filter(f=>f.theme==='summer'||!STARTER_IDS.includes(f.ownerId));
export const STARTER_FORMS=STARTER_IDS.map(id=>`${id}-original` as FormId);
export const originalForm=(id:CharacterId):FormId=>`${id}-original`;
export const equippedForm=(s:RunState,id:CharacterId)=>FORM_MAP[usesCollection(s)?s.config.forms?.[id]??originalForm(id):originalForm(id)];
export const isSummer=(s:RunState,id:CharacterId)=>equippedForm(s,id).theme==='summer';
export const attackType=(s:RunState,id:CharacterId)=>equippedForm(s,id).damageType;
export function formPortrait(id:FormId){
  const form=FORM_MAP[id];
  if(form.theme==='original'&&STARTER_IDS.includes(form.ownerId))return assetUrl(`characters/${form.ownerId}-portrait.webp`);
  const revision=form.ownerId==='C07'||form.ownerId==='C08'?(form.theme==='summer'?'-pose-v4':'-stage-v3'):'';
  return assetUrl(`forms/${id}${revision}.webp`);
}
export const formMotion=(id:FormId)=>FORM_MAP[id].theme==='original'&&STARTER_IDS.includes(FORM_MAP[id].ownerId)?assetUrl(`animations/${FORM_MAP[id].ownerId}-motion.webp`):formPortrait(id);
