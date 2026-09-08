import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {POOL} from '../../src/data/forms';
import {recruitmentRate,RECRUIT_RULES,pickRecruitment} from '../../src/data/recruitment';
import {createCollection,applyCollectionAction,validateCollection} from '../../src/storage/collection';
import {GameRepository} from '../../src/storage/repository';

it('weights characters at 30 percent and outfits at 70 percent',()=>{
  expect(POOL.filter(f=>f.theme==='original').reduce((sum,f)=>sum+recruitmentRate(f),0)).toBe(30);
  expect(POOL.filter(f=>f.theme==='summer').reduce((sum,f)=>sum+recruitmentRate(f),0)).toBe(70);
  expect(pickRecruitment([POOL[9]],.9999)).toBe(POOL[9].id);
  for(const roll of [-1,1,NaN])expect(()=>pickRecruitment(POOL,roll)).toThrow();
});
it('guarantees a new item on the tenth draw after a new item and resets the counter',()=>{
  const c=createCollection();c.tickets=11;
  applyCollectionAction(c,{type:'draw'},()=>0);
  for(let i=0;i<9;i++)applyCollectionAction(c,{type:'draw'},()=>0);
  expect(c.drawsSinceNew).toBe(9);expect(c.points).toBe(180);
  applyCollectionAction(c,{type:'draw'},()=>0);
  expect(c.lastReceipt).toMatchObject({guaranteed:true,duplicate:false,pointsGained:0});
  expect(c.lastReceipt?.formId).not.toBe(POOL[0].id);expect(c.drawsSinceNew).toBe(0);expect(c.tickets).toBe(0);
  validateCollection(c);
});
it('exchange preserves draw guarantee progress and exact duplicate conversions',()=>{
  const c=createCollection();c.points=100;c.drawsSinceNew=8;
  applyCollectionAction(c,{type:'exchange',formId:'C07-original'},()=>{throw Error('must not roll');});
  expect(c.drawsSinceNew).toBe(8);expect(c.points).toBe(0);
  c.tickets=1;
  const before=POOL.slice(0,POOL.findIndex(f=>f.id==='C07-original')).reduce((sum,f)=>sum+recruitmentRate(f)/100,0);
  applyCollectionAction(c,{type:'draw'},()=>before+.01);
  expect(c.lastReceipt).toMatchObject({duplicate:true,pointsGained:RECRUIT_RULES.duplicatePoints});expect(c.points).toBe(20);
});
it('retains guarantee progress and existing currency across reload',async()=>{
  const repo=new GameRepository(crypto.randomUUID());try{
    const s=await repo.load();s.collection.tickets=2;s.collection.drawsSinceNew=9;s.collection.owned.push(POOL[0].id);await repo.save(s);
    const loaded=await repo.load();expect(loaded.collection.drawsSinceNew).toBe(9);
    const drawn=await repo.collect(loaded.revision,{type:'draw'});expect(drawn.collection.lastReceipt?.guaranteed).toBe(true);
    expect(drawn.collection.lastReceipt?.duplicate).toBe(false);expect(drawn.collection.tickets).toBe(1);
    expect((await repo.load()).collection).toEqual(drawn.collection);
  }finally{repo.close();}
});
it('validates guarantee counter and preserves old receipts without fabricating a reward amount',()=>{
  for(const drawsSinceNew of [-1,10,1.1])expect(()=>validateCollection({...createCollection(),drawsSinceNew})).toThrow();
  const c=createCollection();c.lastReceipt={id:1,kind:'draw',formId:'C01-summer',duplicate:true,spent:'ticket'};c.sequence=1;
  expect(()=>validateCollection(c)).not.toThrow();expect(c.lastReceipt.pointsGained).toBeUndefined();
});
