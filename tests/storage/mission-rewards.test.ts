import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {createDefaultSave,completeRun,GameRepository} from '../../src/storage/repository';
import {createRun,restoreRun} from '../../src/sim/engine';
import {hitWall} from '../../src/sim/combat';
import {waveStats} from '../../src/sim/operations';
import {claimedTier, ratingTier, hardUnlocked, challengesUnlocked, hardClearedStages, EASY_CAMPAIGN, easyClearedStages, selectedDifficulty} from '../../src/storage/mission-rewards';
import {syncRewards,validateCollection} from '../../src/storage/collection';
import type {RunConfig,RunState} from '../../src/sim/types';
function victory(difficulty:RunConfig['difficulty'],hp:number,stageId:RunConfig['stageId']='S01'){
  const run=createRun({stageId,difficulty,squadIds:['C01'],captainId:'C01',seed:42});
  run.wallHp=hp;run.outcome='victory';run.phase='ended';return run;
}
it('awards each reached milestone once, independently per stage and difficulty',()=>{
  const save=createDefaultSave();
  for(const [difficulty,hp,points,tickets] of [['easy',100,25,0],['easy',500,50,0],['easy',1000,100,0],['easy',900,100,0],['hard',100,100,1],['hard',500,100,3],['hard',1000,100,6],['hard',1000,100,6]] as const){
    const run=victory(difficulty,hp);completeRun(save,run);expect([save.collection.points,save.collection.tickets]).toEqual([points,tickets]);
    completeRun(save,run);expect([save.collection.points,save.collection.tickets]).toEqual([points,tickets]);
  }
  completeRun(save,victory('easy',1000,'S02'));expect(save.collection.points).toBe(200);expect(save.collection.tickets).toBe(6);
  validateCollection(save.collection);
});
it('hard first does not claim easy rewards or add a legacy first-clear ticket',()=>{
  const save=createDefaultSave();completeRun(save,victory('hard',1000));
  expect(save.collection.tickets).toBe(6);expect(claimedTier(save.collection,'S01','easy')).toBe(0);
  syncRewards(save.collection,save.profile);expect(save.collection.tickets).toBe(6);
  completeRun(save,victory('easy',1000));expect(save.collection.tickets).toBe(6);
});
it('keeps old first-clear tickets and claims while new unclaimed tiers use points',()=>{
  const save=createDefaultSave();save.collection.claimed=['stage:S01'];save.collection.tickets=1;save.profile.cleared=['S01'];
  completeRun(save,victory('hard',1000));expect(save.collection.tickets).toBe(7);
  completeRun(save,victory('easy',1000));expect(save.collection.tickets).toBe(7);expect(save.collection.points).toBe(75);
});
it('uses exact rating boundaries and grants nothing on failure or abandonment',()=>{
  for(const [hp,tier] of [[0,0],[9.99,0],[10,1],[499.99,1],[500,2],[999.99,2],[1000,3]])expect(ratingTier(victory('easy',hp))).toBe(tier);
  for(const outcome of ['defeat','timeout','abandoned'] as RunState['outcome'][]){
    const save=createDefaultSave(),run=victory('hard',1000);run.outcome=outcome;completeRun(save,run);
    expect(save.collection.tickets).toBe(0);expect(save.profile.cleared).toEqual([]);
  }
});
it('persists reward entitlements and difficulty preference across database reloads',async()=>{
  const repo=new GameRepository(crypto.randomUUID());try{
    const save=await repo.load();save.preferences.difficulty='hard';completeRun(save,victory('hard',500));await repo.save(save);
    const loaded=await repo.load();expect(loaded.preferences.difficulty).toBe('hard');
    completeRun(loaded,victory('hard',1000));expect(loaded.collection.tickets).toBe(6);
    expect(loaded.profile.recentRuns[0]).toMatchObject({difficulty:'hard',rating:3,rewards:{tickets:3}});
    await repo.save(loaded);expect((await repo.load()).collection.tickets).toBe(6);
  }finally{repo.close();}
});
it('rejects malformed entitlements',()=>{
  for(const difficultyClaims of [{'S99:easy':1},{'S01:easy':4},{'S01:hard':-1},{'S01:hard':1.5}] as Record<string,number>[]){
    expect(()=>validateCollection({...createDefaultSave().collection,difficultyClaims})).toThrow();
  }
});

it('a victory below one percent clears the stage without awarding a ticket',()=>{
  const save=createDefaultSave();completeRun(save,victory('easy',9.99));syncRewards(save.collection,save.profile);
  expect(save.profile.cleared).toContain('S01');expect(save.collection.tickets).toBe(0);
  completeRun(save,victory('easy',10));expect(save.collection.points).toBe(25);expect(save.collection.tickets).toBe(0);
});
it('hard increases every wave and boss health plus wall damage; resume preserves the choice',()=>{
  const easy=victory('easy',1000),hard=victory('hard',1000),legacy=victory(undefined,1000);
  for(const wave of [1,7,9])for(const id of ['E01','E03','B01'] as const){
    expect(waveStats(hard,id,wave).hp).toBeCloseTo(waveStats(easy,id,wave).hp*1.5);
    expect(waveStats(legacy,id,wave)).toEqual(waveStats(easy,id,wave));
  }
  hitWall(easy,100,'E01');hitWall(hard,100,'E01');expect(easy.wallHp).toBe(900);expect(hard.wallHp).toBe(875);
  expect(restoreRun(hard).config.difficulty).toBe('hard');
});

it('unlocks hard per stage after an easy win, including low-durability wins',async()=>{
  const repo=new GameRepository(crypto.randomUUID());try{
    const save=await repo.load();save.preferences.difficulty='hard';
    expect(selectedDifficulty(save,'S01')).toBe('easy');
    completeRun(save,victory('easy',5,'S01'));
    expect(hardUnlocked(save,'S01')).toBe(true);expect(hardUnlocked(save,'S02')).toBe(false);
    completeRun(save,victory('hard',1000,'S02'));expect(hardUnlocked(save,'S02')).toBe(false);
    await repo.save(save);const loaded=await repo.load();expect(hardUnlocked(loaded,'S01')).toBe(true);
    expect(loaded.profile.easyCleared).toEqual(['S01']);expect(selectedDifficulty(loaded,'S01')).toBe('hard');
    expect(selectedDifficulty(loaded,'S02')).toBe('easy');
  }finally{repo.close();}
});
it('recognizes legacy easy progress without counting hard-only records',()=>{
  const save=createDefaultSave();save.profile.cleared=[...EASY_CAMPAIGN];
  syncRewards(save.collection,save.profile);expect(hardUnlocked(save,'S01')).toBe(true);
  save.collection.difficultyClaims={'S01:easy':0,'S01:hard':3};
  expect(easyClearedStages(save)).not.toContain('S01');expect(hardUnlocked(save,'S01')).toBe(false);
});

it('unlocks challenges only after a hard victory on the same main stage and retains low-HP wins',async()=>{
  const repo=new GameRepository(crypto.randomUUID());try{
    const save=await repo.load();completeRun(save,victory('easy',1000));
    expect(challengesUnlocked(save,'S01')).toBe(false);
    for(const outcome of ['wall','timeout','abandoned'] as const){const run=victory('hard',1000);run.outcome=outcome;completeRun(save,run);expect(challengesUnlocked(save,'S01')).toBe(false);}
    completeRun(save,victory('hard',5));expect(claimedTier(save.collection,'S01','hard')).toBe(0);
    for(let i=0;i<11;i++)completeRun(save,victory('easy',1000));
    await repo.save(save);const loaded=await repo.load();
    expect(challengesUnlocked(loaded,'S01')).toBe(true);expect(challengesUnlocked(loaded,'S02')).toBe(false);
    completeRun(loaded,victory('hard',1000,'X01'));expect(challengesUnlocked(loaded,'X01')).toBe(false);
  }finally{repo.close();}
});
it('recognizes legacy hard entitlements and low-HP recent victories without inventing cleared stages',()=>{
  const save=createDefaultSave();delete save.profile.hardCleared;
  save.profile.cleared=['S01','S02'];save.collection.difficultyClaims={'S01:hard':2};
  expect(hardClearedStages(save)).toEqual(['S01']);
  completeRun(save,victory('hard',5,'S02'));delete save.profile.hardCleared;
  expect(hardClearedStages(save)).toEqual(['S01','S02']);
});

it('awards challenge tiers separately for each restriction, without repeating hard rewards or adding flat points',async()=>{
  const repo=new GameRepository(crypto.randomUUID());try{
    const save=await repo.load();completeRun(save,victory('easy',1000));completeRun(save,victory('hard',1000));
    for(const challengeId of ['four','no-skill','two-evolutions'] as const){
      const before=save.collection.tickets;
      for(const [hp,amount,tier] of [[10,3,1],[500,9,2],[1000,18,3],[1000,18,3]]){
        const run=victory('hard',hp);run.config.challengeId=challengeId;completeRun(save,run);completeRun(save,run);
        expect(save.collection.tickets).toBe(before+amount);expect(claimedTier(save.collection,'S01','hard',challengeId)).toBe(tier);
        expect(save.collection.points).toBe(100);
      }
    }
    expect(save.collection.tickets).toBe(60);await repo.save(save);expect((await repo.load()).collection).toEqual(save.collection);
  }finally{repo.close();}
});
