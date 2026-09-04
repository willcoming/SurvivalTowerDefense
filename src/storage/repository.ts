import { CHARACTER_IDS, CONTENT_VERSION, SCHEMA_VERSION, STAGE_MAP } from '../data/content';
import { restoreRun } from '../sim/engine';
import type { Branch, CharacterId, EnemyId, RunState, StageId } from '../sim/types';
export const DB_NAME='starfall-defense';export const STORE_NAME='records';export const SAVE_KEY='save';
export type BattleSpeed = 1 | 2 | 3;
export interface RunSummary {runId:string;stageId:StageId;seed:number;squadIds:CharacterId[];captainId:CharacterId;outcome:RunState['outcome'];tick:number;wallHp:number;stats:RunState['stats'];challengeId:RunState['config']['challengeId']}
export interface GameSave {
 revision:number;
 profile:{schemaVersion:1;cleared:StageId[];seenEnemies:EnemyId[];best:Record<string,{time:number;hp:number}>;challengeClears:string[];recentRuns:RunSummary[]};
 preferences:{squadIds:CharacterId[];captainId:CharacterId;branches:Record<CharacterId,Branch>;musicVolume:number;sfxVolume:number;reducedEffects:boolean;tutorialSeen:boolean;battleSpeed:BattleSpeed;autoTactical:boolean};
 activeRun:RunState|null;
}
export class SaveConflictError extends Error {constructor(){super('另一個分頁已更新存檔，請重新讀取最新進度');this.name='SaveConflictError';}}
export class SaveValidationError extends Error {constructor(message='本機紀錄格式損壞，原始資料已保留'){super(message);this.name='SaveValidationError';}}
export class IncompatibleRunError extends SaveValidationError {preservedSave:GameSave;constructor(save:GameSave){super('本局內容版本不相容；可保留解鎖進度並放棄舊局');this.name='IncompatibleRunError';this.preservedSave=structuredClone(save);}}
export function createDefaultSave():GameSave{return{revision:0,profile:{schemaVersion:1,cleared:[],seenEnemies:[],best:{},challengeClears:[],recentRuns:[]},preferences:{squadIds:['C01','C02','C04','C05','C06'],captainId:'C02',branches:Object.fromEntries(CHARACTER_IDS.map(id=>[id,'A'])) as Record<CharacterId,Branch>,musicVolume:.35,sfxVolume:.65,reducedEffects:false,tutorialSeen:false,battleSpeed:1,autoTactical:false},activeRun:null};}
export function summarizeRun(run:RunState):RunSummary{return structuredClone({runId:run.runId,stageId:run.config.stageId,seed:run.config.seed,squadIds:run.config.squadIds,captainId:run.config.captainId,outcome:run.outcome,tick:run.tick,wallHp:run.wallHp,stats:run.stats,challengeId:run.config.challengeId??null});}
export function completeRun(save:GameSave,run:RunState){
 if(!run.outcome)throw new Error('戰局尚未結束');
 for(const id of run.stats.encountered)if(!save.profile.seenEnemies.includes(id))save.profile.seenEnemies.push(id);
 if(!save.profile.recentRuns.some(r=>r.runId===run.runId))save.profile.recentRuns=[summarizeRun(run),...save.profile.recentRuns].slice(0,10);
 if(run.outcome==='victory'){
  if(!save.profile.cleared.includes(run.config.stageId))save.profile.cleared.push(run.config.stageId);
  const key=run.config.stageId,old=save.profile.best[key];if(!old||run.tick<old.time||(run.tick===old.time&&run.wallHp>old.hp))save.profile.best[key]={time:run.tick,hp:run.wallHp};
  if(run.config.challengeId){const challenge=`${key}:${run.config.challengeId}`;if(!save.profile.challengeClears.includes(challenge))save.profile.challengeClears.push(challenge);}
 }
 if(save.activeRun?.runId===run.runId)save.activeRun=null;
}
function validSave(raw:unknown):GameSave{
 if(!raw||typeof raw!=='object')throw new SaveValidationError();const s=structuredClone(raw) as GameSave;
 if(s.profile?.schemaVersion!==SCHEMA_VERSION)throw new SaveValidationError('存檔版本不相容，原始資料已保留');
 const p=s.preferences;
 if(!Number.isInteger(s.revision)||s.revision<0||!Array.isArray(s.profile.cleared)||s.profile.cleared.some(id=>!STAGE_MAP[id])||!Array.isArray(s.profile.seenEnemies)||!Array.isArray(s.profile.recentRuns)||!Array.isArray(s.profile.challengeClears)||!s.profile.best||!p||!Array.isArray(p.squadIds)||p.squadIds.length>5||new Set(p.squadIds).size!==p.squadIds.length||p.squadIds.some(id=>!CHARACTER_IDS.includes(id))||!CHARACTER_IDS.includes(p.captainId)||!p.branches||CHARACTER_IDS.some(id=>!['A','B'].includes(p.branches[id]))||![p.musicVolume,p.sfxVolume].every(v=>Number.isFinite(v)&&v>=0&&v<=1)||typeof p.tutorialSeen!=='boolean'||typeof p.reducedEffects!=='boolean')throw new SaveValidationError();
 // Older local saves have no speed preference; their active run remains unchanged.
 if(p.battleSpeed===undefined)p.battleSpeed=1;
 if(![1,2,3].includes(p.battleSpeed))throw new SaveValidationError();
 if(p.autoTactical===undefined)p.autoTactical=false;
 if(typeof p.autoTactical!=='boolean')throw new SaveValidationError();
 if(s.activeRun!==null){
   if(s.activeRun?.schemaVersion!==SCHEMA_VERSION||s.activeRun?.contentVersion!==CONTENT_VERSION)throw new IncompatibleRunError(s);
   try{restoreRun(s.activeRun);}catch{throw new SaveValidationError('進行中戰局損壞，原始資料已保留');}
 }
 return s;
}
export class GameRepository {
 private dbPromise:Promise<IDBDatabase>|null=null;private queue:Promise<unknown>=Promise.resolve();private revision=0;private loaded=false;
 constructor(private readonly name=DB_NAME){}
 private db(){
  if(!this.dbPromise)this.dbPromise=new Promise<IDBDatabase>((resolve,reject)=>{
   if(typeof indexedDB==='undefined'){reject(new Error('目前瀏覽器無法儲存進度'));return;}
   const request=indexedDB.open(this.name,1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE_NAME))request.result.createObjectStore(STORE_NAME);};
   request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
   request.onerror=()=>{this.dbPromise=null;reject(request.error??new Error('無法開啟本機儲存'));};
   request.onblocked=()=>reject(new Error('請先關閉其他遊戲分頁再重試'));
  });return this.dbPromise;
 }
 async load():Promise<GameSave>{
  await this.queue.catch(()=>{});const db=await this.db();
  const raw=await new Promise<unknown>((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readonly');const q=tx.objectStore(STORE_NAME).get(SAVE_KEY);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  if(raw===undefined){this.revision=0;this.loaded=true;return createDefaultSave();}
  try{const result=validSave(raw);this.revision=result.revision;this.loaded=true;return result;}catch(error){if(error instanceof IncompatibleRunError){this.revision=error.preservedSave.revision;this.loaded=true;}throw error;}
 }
 save(data:GameSave):Promise<number>{
  let copy:GameSave;try{copy=validSave(data);}catch(error){return Promise.reject(error);}
  const task=this.queue.catch(()=>{}).then(async()=>{
   if(!this.loaded)throw new Error('儲存前必須先讀取紀錄');const db=await this.db();const expected=this.revision;
   const revision=await new Promise<number>((resolve,reject)=>{
    const tx=db.transaction(STORE_NAME,'readwrite');const store=tx.objectStore(STORE_NAME);const request=store.get(SAVE_KEY);let failure:Error|null=null;
    request.onsuccess=()=>{const current=request.result as GameSave|undefined;if((current?.revision??0)!==expected){failure=new SaveConflictError();tx.abort();return;}copy.revision=expected+1;store.put(copy,SAVE_KEY);};
    tx.oncomplete=()=>resolve(expected+1);tx.onabort=()=>reject(failure??tx.error??new Error('寫入交易取消'));tx.onerror=()=>{failure??=tx.error??new Error('儲存失敗');};
   });this.revision=revision;return revision;
  });this.queue=task;return task;
 }
 async reset(){
  await this.queue.catch(()=>{});const db=await this.db();
  this.revision=await new Promise<number>((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readwrite');const store=tx.objectStore(STORE_NAME);const q=store.get(SAVE_KEY);let revision=1;q.onsuccess=()=>{revision=(Number.isSafeInteger(q.result?.revision)?q.result.revision:0)+1;const clean=createDefaultSave();clean.revision=revision;store.put(clean,SAVE_KEY);};tx.oncomplete=()=>resolve(revision);tx.onabort=()=>reject(tx.error);});
  this.loaded=true;
 }
 close(){void this.dbPromise?.then(db=>db.close());this.dbPromise=null;this.loaded=false;}
}
