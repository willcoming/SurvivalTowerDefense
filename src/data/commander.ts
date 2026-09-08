import { COMMON_TREE } from './deep-trees';
import { STAGE_MAP } from './content';
import type { StageId } from '../sim/types';

export const COMMANDER_MAX_LEVEL=13;
export const commanderLevelCost=(level:number)=>100+(level-1)*40;
export const commanderXpAt=(level:number)=>Array.from({length:Math.max(0,Math.min(COMMANDER_MAX_LEVEL,level)-1)},(_,i)=>commanderLevelCost(i+1)).reduce((n,x)=>n+x,0);
export const COMMANDER_MAX_XP=commanderXpAt(COMMANDER_MAX_LEVEL);
export interface CommanderState { version:1; xp:number; skillIds:string[]; creditedRunIds:string[]; firstClears:StageId[] }
export interface CommanderReward { xp:number; beforeLevel:number; afterLevel:number; points:number; firstClear:boolean }
export const createCommander=():CommanderState=>({version:1,xp:0,skillIds:[],creditedRunIds:[],firstClears:[]});
export function commanderProgress(state:Pick<CommanderState,'xp'|'skillIds'>){
  let level=1;while(level<COMMANDER_MAX_LEVEL&&state.xp>=commanderXpAt(level+1))level++;
  return {level,earned:level-1,available:level-1-state.skillIds.length,current:state.xp-commanderXpAt(level),required:level===COMMANDER_MAX_LEVEL?0:commanderLevelCost(level)};
}
export function commanderSkillLock(ids:readonly string[],id:string):string|null {
  const node=COMMON_TREE.nodes.find(n=>n.id===id);
  if(!node)return '未知的共用技能';
  if(ids.includes(id))return '已升級';
  if(!node.parents.every(parent=>ids.includes(parent)))return '先升級上一階技能';
  return null;
}
export function validateCommanderSkills(ids:unknown):asserts ids is string[]{
  if(!Array.isArray(ids)||ids.length>COMMON_TREE.nodes.length)throw new Error('共用技能紀錄損壞');
  const owned:string[]=[];for(const id of ids){if(typeof id!=='string'||commanderSkillLock(owned,id))throw new Error('共用技能前置或點數損壞');owned.push(id);}
}
export function validateCommander(state:CommanderState){
  if(!state||state.version!==1||!Number.isSafeInteger(state.xp)||state.xp<0||state.xp>COMMANDER_MAX_XP)throw new Error('指揮官經驗紀錄損壞');
  validateCommanderSkills(state.skillIds);
  if(commanderProgress(state).available<0||!Array.isArray(state.creditedRunIds)||state.creditedRunIds.some(id=>typeof id!=='string'||!id)||new Set(state.creditedRunIds).size!==state.creditedRunIds.length||!Array.isArray(state.firstClears)||state.firstClears.some(id=>!STAGE_MAP[id])||new Set(state.firstClears).size!==state.firstClears.length)throw new Error('指揮官成長紀錄損壞');
}
export function upgradeCommander(state:CommanderState,id:string){
  validateCommander(state);
  if(commanderProgress(state).available<1||commanderSkillLock(state.skillIds,id))return false;
  state.skillIds=[...state.skillIds,id];return true;
}
