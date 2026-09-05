import 'fake-indexeddb/auto';
import { it,expect,afterEach } from 'vitest';
import { GameRepository,createDefaultSave,STORE_NAME,SAVE_KEY,SaveConflictError } from '../../src/storage/repository';
import { createRun } from '../../src/sim/engine';
import { FREE_CONTENT_VERSION } from '../../src/data/deep-trees';
const repos:GameRepository[]=[];const repo=(name:string)=>{const r=new GameRepository(name);repos.push(r);return r;};
afterEach(()=>{for(const r of repos)r.close();repos.length=0;});
async function rawPut(name:string,data:unknown){await new Promise<void>((resolve,reject)=>{const q=indexedDB.open(name,1);q.onupgradeneeded=()=>q.result.createObjectStore(STORE_NAME);q.onsuccess=()=>{const db=q.result,tx=db.transaction(STORE_NAME,'readwrite');tx.objectStore(STORE_NAME).put(data,SAVE_KEY);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};q.onerror=()=>reject(q.error);});}
it('retroactive first-clear rewards migrate once, atomically across two simultaneous loaders',async()=>{
  const name=crypto.randomUUID(),old=createDefaultSave() as any;delete old.collection;delete old.preferences.branches.C07;delete old.preferences.branches.C08;old.profile.cleared=['S01','S02','S03'];old.profile.challengeClears=['S01:four','S01:four','S02:no-skill'];
  old.activeRun=createRun({stageId:'S03',squadIds:['C01'],captainId:'C01',seed:101},FREE_CONTENT_VERSION);const snapshot=structuredClone(old.activeRun);await rawPut(name,old);
  const a=repo(name),b=repo(name),[x,y]=await Promise.all([a.load(),b.load()]);
  for(const s of [x,y]){expect(s.collection.tickets).toBe(3);expect(s.collection.points).toBe(50);expect(s.collection.claimed).toHaveLength(5);expect(s.activeRun).toEqual(snapshot);}
  expect(x.revision).toBe(y.revision);expect((await a.load()).collection).toEqual(x.collection);
});
it('only one concurrent draw can consume the same revision; reload reveals the saved result',async()=>{
  const name=crypto.randomUUID(),seed=createDefaultSave();seed.profile.cleared=['S01'];await rawPut(name,seed);const a=repo(name),b=repo(name),[x,y]=await Promise.all([a.load(),b.load()]);
  const results=await Promise.allSettled([a.collect(x.revision,{type:'draw'}),b.collect(y.revision,{type:'draw'})]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);const failed=results.find(r=>r.status==='rejected') as PromiseRejectedResult;expect(failed.reason).toBeInstanceOf(SaveConflictError);
  const saved=await a.load();expect(saved.collection.tickets).toBe(0);expect(saved.collection.sequence).toBe(1);expect(saved.collection.lastReceipt).not.toBeNull();expect((await b.load()).collection.lastReceipt).toEqual(saved.collection.lastReceipt);
});
it('a pre-draw autosave queued afterwards cannot undo a committed draw in the same repository',async()=>{
  const name=crypto.randomUUID(),seed=createDefaultSave();seed.profile.cleared=['S01'];await rawPut(name,seed);const r=repo(name),before=await r.load(),after=await r.collect(before.revision,{type:'draw'});
  await expect(r.save(before)).rejects.toBeInstanceOf(SaveConflictError);expect((await r.load()).collection).toEqual(after.collection);
});
it('invalid draws/exchanges roll back all balances and forbid spending during an active run',async()=>{
  const name=crypto.randomUUID(),r=repo(name),s=await r.load();await expect(r.collect(s.revision,{type:'draw'})).rejects.toThrow('招募需要');expect((await r.load()).collection).toEqual(s.collection);
  s.profile.cleared=['S01'];s.activeRun=createRun({stageId:'S01',squadIds:['C01'],captainId:'C01',seed:1});await r.save(s);const saved=await r.load();await expect(r.collect(saved.revision,{type:'draw'})).rejects.toThrow('進行中的行動');expect((await r.load()).collection.tickets).toBe(1);
});
