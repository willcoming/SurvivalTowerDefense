import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { createRun, command } from '../../src/sim/engine';
import { GameRepository, completeRun, createDefaultSave, recordHundred } from '../../src/storage/repository';
const run=()=>createRun({mode:'hundred',stageId:'S03',difficulty:'easy',squadIds:['C01'],captainId:'C01',seed:101});
it('stores better runs, ranks by waves then kills then HP, preserves campaign rewards, and survives reopening',async()=>{
 const repo=new GameRepository('hundred-score'),save=await repo.load();
 try{
  const collection=structuredClone(save.collection),profile=structuredClone(save.profile);
  const score=(waves:number,kills:number,hp:number)=>{
   const s=run();s.spawnCursor=s.spawnPlan.findIndex(e=>e.wave===waves+1);s.enemies=[];s.stats.kills=kills;s.wallHp=hp;
   command(s,{type:'abandon'});save.activeRun=s;completeRun(save,s);completeRun(save,s);return s;
  };
  const first=score(12,50,800);expect(save.profile.hundredBest?.runId).toBe(first.runId);
  expect(save.activeRun).toBeNull();expect(save.profile.recentRuns).toHaveLength(1);
  score(11,1000,1000);score(12,49,1000);score(12,50,700);
  expect(save.profile.hundredBest?.runId).toBe(first.runId);
  const higherKills=score(12,51,0);expect(save.profile.hundredBest?.runId).toBe(higherKills.runId);
  const higherHp=score(12,51,20);expect(save.profile.hundredBest?.runId).toBe(higherHp.runId);
  const higherWave=score(13,1,0);expect(save.profile.hundredBest?.runId).toBe(higherWave.runId);
  expect(save.collection).toEqual(collection);expect(save.profile.cleared).toEqual(profile.cleared);
  expect(save.profile.commander).toEqual(profile.commander);expect(save.profile.best).toEqual({});
  await repo.save(save);repo.close();
  const reopened=new GameRepository('hundred-score');
  try{expect((await reopened.load()).profile.hundredBest).toEqual(save.profile.hundredBest);}finally{reopened.close();}
 }finally{repo.close();}
});
it('victory records all 100 waves without awarding or unlocking the underlying campaign stage',()=>{
 const save=createDefaultSave(),before=structuredClone(save.collection),s=run();
 s.enemies=[];s.spawnCursor=s.spawnPlan.length;s.bossKilled=true;s.outcome='victory';s.phase='ended';completeRun(save,s);
 expect(save.profile.hundredBest?.waves).toBe(100);expect(save.profile.cleared).toEqual([]);
 expect(save.profile.challengeClears).toEqual([]);expect(save.profile.commander?.firstClears).toEqual(createDefaultSave().profile.commander?.firstClears);
 expect(save.collection).toEqual(before);
});
it('saves in-progress records independently of the disposable active battle and validates score data',async()=>{
 const repo=new GameRepository('hundred-progress');
 try{
  const save=await repo.load(),s=run();s.spawnCursor=s.spawnPlan.findIndex(e=>e.wave===3);s.enemies=[];
  recordHundred(save,s);await repo.save(save);
  expect((await repo.load({discardActiveRun:true})).profile.hundredBest?.waves).toBe(2);
  expect((await repo.load()).activeRun).toBeNull();
  save.profile.hundredBest!.waves=101;await expect(repo.save(save)).rejects.toThrow('百波挑戰');
 }finally{repo.close();}
});
