import 'fake-indexeddb/auto';
import { it,expect,afterEach } from 'vitest';
import { GameRepository,createDefaultSave,STORE_NAME,SAVE_KEY,SaveConflictError } from '../../src/storage/repository';
import { createRun } from '../../src/sim/engine';
import { FREE_CONTENT_VERSION } from '../../src/data/deep-trees';
const repos:GameRepository[]=[];const repo=(name:string)=>{const r=new GameRepository(name);repos.push(r);return r;};
afterEach(()=>{for(const r of repos)r.close();repos.length=0;});
async function rawPut(name:string,data:unknown){await new Promise<void>((resolve,reject)=>{const q=indexedDB.open(name,1);q.onupgradeneeded=()=>q.result.createObjectStore(STORE_NAME);q.onsuccess=()=>{const db=q.result,tx=db.transaction(STORE_NAME,'readwrite');tx.objectStore(STORE_NAME).put(data,SAVE_KEY);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};q.onerror=()=>reject(q.error);});}
async function rawGet(name:string){return new Promise<unknown>((resolve,reject)=>{const q=indexedDB.open(name,1);q.onsuccess=()=>{const db=q.result,tx=db.transaction(STORE_NAME,'readonly'),request=tx.objectStore(STORE_NAME).get(SAVE_KEY);tx.oncomplete=()=>{db.close();resolve(request.result);};tx.onabort=()=>reject(tx.error);};q.onerror=()=>reject(q.error);});}
it('retroactive first-clear rewards migrate once, atomically across two simultaneous loaders',async()=>{
  const name=crypto.randomUUID(),old=createDefaultSave() as any;delete old.collection;delete old.preferences.branches.C07;delete old.preferences.branches.C08;old.profile.cleared=['S01','S02','S03'];old.profile.challengeClears=['S01:four','S01:four','S02:no-skill'];
  old.activeRun=createRun({stageId:'S03',squadIds:['C01'],captainId:'C01',seed:101},FREE_CONTENT_VERSION);const snapshot=structuredClone(old.activeRun);await rawPut(name,old);
  const a=repo(name),b=repo(name),[x,y]=await Promise.all([a.load(),b.load()]);
  for(const s of [x,y]){expect(s.collection.tickets).toBe(3);expect(s.collection.points).toBe(50);expect(s.collection.claimed).toHaveLength(5);expect(s.activeRun).toEqual(snapshot);}
  expect(x.revision).toBe(y.revision);expect((await a.load()).collection).toEqual(x.collection);
});
it('only one concurrent draw can consume the same revision; reload reveals the saved result',async()=>{
  const name=crypto.randomUUID(),seed=createDefaultSave();seed.profile.cleared=['S01'];seed.collection.tickets=1;await rawPut(name,seed);const a=repo(name),b=repo(name),[x,y]=await Promise.all([a.load(),b.load()]);
  const results=await Promise.allSettled([a.collect(x.revision,{type:'draw'}),b.collect(y.revision,{type:'draw'})]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);const failed=results.find(r=>r.status==='rejected') as PromiseRejectedResult;expect(failed.reason).toBeInstanceOf(SaveConflictError);
  const saved=await a.load();expect(saved.collection.tickets).toBe(0);expect(saved.collection.sequence).toBe(1);expect(saved.collection.lastReceipt).not.toBeNull();expect((await b.load()).collection.lastReceipt).toEqual(saved.collection.lastReceipt);
});
it('a pre-draw autosave queued afterwards cannot undo a committed draw in the same repository',async()=>{
  const name=crypto.randomUUID(),seed=createDefaultSave();seed.profile.cleared=['S01'];seed.collection.tickets=1;await rawPut(name,seed);const r=repo(name),before=await r.load(),after=await r.collect(before.revision,{type:'draw'});
  await expect(r.save(before)).rejects.toBeInstanceOf(SaveConflictError);expect((await r.load()).collection).toEqual(after.collection);
});
it('invalid draws/exchanges roll back all balances and forbid spending during an active run',async()=>{
  const name=crypto.randomUUID(),r=repo(name),s=await r.load();await expect(r.collect(s.revision,{type:'draw'})).rejects.toThrow('招募需要');expect((await r.load()).collection).toEqual(s.collection);
  s.profile.cleared=['S01'];s.collection.tickets=1;s.activeRun=createRun({stageId:'S01',squadIds:['C01'],captainId:'C01',seed:1});await r.save(s);const saved=await r.load();await expect(r.collect(saved.revision,{type:'draw'})).rejects.toThrow('進行中的行動');expect((await r.load()).collection.tickets).toBe(1);
});

it('merges legacy balances once across simultaneous loaders and preserves the rest of the save',async()=>{
  const name=crypto.randomUUID(),base=createDefaultSave();
  base.revision=7;base.profile.cleared=['S01'];base.profile.challengeClears=['S01:four'];
  base.collection.owned.push('C01-summer');base.collection.equipped.C01='C01-summer';
  base.collection.claimed=['stage:S01'];base.collection.drawsSinceNew=8;base.collection.sequence=3;
  base.collection.difficultyClaims={'S01:easy':1};base.collection.tickets=3;
  base.activeRun=createRun({stageId:'S01',squadIds:['C01'],captainId:'C01',seed:12});
  const legacy={...base,collection:{...base.collection,version:1,points:75,fragments:45,lastReceipt:{id:3,kind:'draw',formId:'C01-summer',duplicate:true,spent:'ticket',fragmentsGained:20}}};
  await rawPut(name,legacy);
  const a=repo(name),b=repo(name),[x,y]=await Promise.all([a.load(),b.load()]);
  for(const s of [x,y]){
    // 75 old points + 45 old fragments + one unclaimed 25-point challenge.
    expect(s.collection.points).toBe(145);expect(s.collection.version).toBe(2);
    expect(s.collection).not.toHaveProperty('fragments');
    expect(s.collection.lastReceipt).toEqual({id:3,kind:'draw',formId:'C01-summer',duplicate:true,spent:'ticket',pointsGained:20});
    expect(s.collection.owned).toEqual(base.collection.owned);expect(s.collection.equipped).toEqual(base.collection.equipped);
    expect(s.collection.difficultyClaims).toEqual(base.collection.difficultyClaims);expect(s.collection.drawsSinceNew).toBe(8);
    expect(s.collection.tickets).toBe(3);expect(s.collection.sequence).toBe(3);
    expect(s.activeRun).toEqual(base.activeRun);expect(s.preferences).toEqual(base.preferences);
    expect(s.revision).toBe(8);
  }
  expect(await a.load()).toEqual(x);expect(await rawGet(name)).toEqual(x);
});

it('preserves the amount on pre-guarantee duplicate receipts and converts old exchange receipts',async()=>{
  for(const kind of ['draw','exchange'] as const){
    const name=crypto.randomUUID(),base=createDefaultSave();
    const legacy={...base,collection:{...base.collection,version:1,points:30,fragments:20,sequence:1,lastReceipt:{id:1,kind,formId:'C01-summer',duplicate:kind==='draw',spent:kind==='draw'?'ticket':'fragments'}}};
    await rawPut(name,legacy);const saved=await repo(name).load();
    expect(saved.collection.points).toBe(50);
    expect(saved.collection.lastReceipt).toMatchObject({spent:kind==='draw'?'ticket':'points',pointsGained:kind==='draw'?10:0});
  }
});

it('rejects invalid or overflowing legacy currency without changing the raw save',async()=>{
  for(const [points,fragments] of [[-1,20],[20,-1],[20,.5],[Number.MAX_SAFE_INTEGER,1],[NaN,0]]){
    const name=crypto.randomUUID(),base=createDefaultSave(),legacy={...base,collection:{...base.collection,version:1,points,fragments}};
    await rawPut(name,legacy);
    await expect(repo(name).load()).rejects.toThrow('原始資料已保留');
    expect(await rawGet(name)).toEqual(legacy);
  }
});

it('does not silently discard a malformed legacy receipt amount or fragments in a current save',async()=>{
  const base=createDefaultSave();
  const badReceipt={...base,collection:{...base.collection,version:1,fragments:10,sequence:1,lastReceipt:{id:1,kind:'draw',formId:'C01-summer',duplicate:true,spent:'ticket',fragmentsGained:null}}};
  const badCurrent={...base,collection:{...base.collection,fragments:10}};
  for(const invalid of [badReceipt,badCurrent]){
    const name=crypto.randomUUID();await rawPut(name,invalid);
    await expect(repo(name).load()).rejects.toThrow('原始資料已保留');expect(await rawGet(name)).toEqual(invalid);
  }
});

it('concurrent draw and exchange cannot both spend the same 100 resonance points',async()=>{
  const name=crypto.randomUUID(),seed=createDefaultSave();seed.collection.points=100;await rawPut(name,seed);
  const a=repo(name),b=repo(name),[x,y]=await Promise.all([a.load(),b.load()]);
  const results=await Promise.allSettled([a.collect(x.revision,{type:'draw'}),b.collect(y.revision,{type:'exchange',formId:'C07-original'})]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason).toBeInstanceOf(SaveConflictError);
  const saved=await a.load();expect(saved.collection.points).toBe(0);expect(saved.collection.sequence).toBe(1);
  expect(saved.collection.lastReceipt?.spent).toBe('points');expect((await b.load()).collection).toEqual(saved.collection);
});
