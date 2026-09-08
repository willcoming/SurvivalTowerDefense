import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {createCommander,commanderProgress,commanderXpAt,COMMANDER_MAX_XP,upgradeCommander,validateCommander} from '../../src/data/commander';
import {awardCommander,migrateCommander,commanderVictoryXp} from '../../src/storage/commander';
import {createDefaultSave,completeRun,GameRepository} from '../../src/storage/repository';
import {createRun,command,restoreRun,stepRun} from '../../src/sim/engine';
import {deepLegalNodes,deepMods,deepPointCost} from '../../src/sim/deep-tree';
import {openDraft} from '../../src/sim/draft';
import {DEEP_NODE_MAP} from '../../src/data/deep-trees';
import {pathTo} from '../helpers/deep-build';

const run=()=>createRun({stageId:'S01',squadIds:['C01'],captainId:'C01',seed:101});
const won=()=>{const s=run();s.outcome='victory';s.phase='ended';return s;};
describe('commander experience and permanent common skills',()=>{
  it('starts at level one, earns one point per level, and caps at level thirteen',()=>{
    const state=createCommander();expect(commanderProgress(state)).toMatchObject({level:1,available:0,required:100});
    for(let level=2;level<=13;level++){
      state.xp=commanderXpAt(level)-1;expect(commanderProgress(state).level).toBe(level-1);
      state.xp++;expect(commanderProgress(state)).toMatchObject({level,available:level-1});
    }
    expect(state.xp).toBe(3840);expect(commanderProgress(state).required).toBe(0);
  });
  it('awards first clear once across difficulties and guards replayed settlements beyond the recent list',()=>{
    const save=createDefaultSave(),first=won();completeRun(save,first);
    expect(save.profile.commander!.xp).toBe(120);expect(save.profile.recentRuns[0].commanderReward).toMatchObject({xp:120,points:1,afterLevel:2,firstClear:true});
    const before=structuredClone(save.profile.commander);completeRun(save,first);expect(save.profile.commander).toEqual(before);
    for(let i=0;i<11;i++)completeRun(save,won());
    expect(save.profile.recentRuns.some(r=>r.runId===first.runId)).toBe(false);
    const xp=save.profile.commander!.xp;completeRun(save,first);expect(save.profile.commander!.xp).toBe(xp);
    const hard=won();hard.config.difficulty='hard';completeRun(save,hard);
    expect(save.profile.recentRuns[0].commanderReward).toMatchObject({xp:100,firstClear:false});
    expect(commanderVictoryXp('S01','hard',true)).toBe(120);
  });
  it('rewards actual defeat progress, never abandonment or unfinished runs, and caps excess XP',()=>{
    const state=createCommander(),s=run();expect(awardCommander(state,s).xp).toBe(0);
    s.stats.kills=s.spawnPlan.length/2;s.outcome='wall';expect(awardCommander(state,s).xp).toBe(10);
    const abandoned=won();abandoned.outcome='abandoned';expect(awardCommander(state,abandoned).xp).toBe(0);
    state.xp=COMMANDER_MAX_XP-5;expect(awardCommander(state,won()).xp).toBe(5);expect(awardCommander(state,won()).xp).toBe(0);
  });
  it('migrates only unique old clears and persists the migrated profile exactly once',async()=>{
    const expected=migrateCommander(['S01','S01','S02']);expect(expected.xp).toBe(250);expect(expected.firstClears).toEqual(['S01','S02']);
    const repository=new GameRepository(`commander-migration-${crypto.randomUUID()}`);
    try{const save=await repository.load();delete save.profile.commander;save.profile.cleared=['S01','S02'];await repository.save(save);const loaded=await repository.load();expect(loaded.profile.commander).toEqual(expected);expect((await repository.load()).profile.commander).toEqual(expected);}finally{repository.close();}
  });
  it('rejects prerequisite bypasses, duplicate purchases, overspending and corrupt saves',async()=>{
    const state=createCommander();expect(upgradeCommander(state,'TEAM/0')).toBe(false);
    state.xp=100;expect(upgradeCommander(state,'TEAM/2')).toBe(false);expect(upgradeCommander(state,'C01-A/0')).toBe(false);
    expect(upgradeCommander(state,'TEAM/0')).toBe(true);expect(upgradeCommander(state,'TEAM/0')).toBe(false);expect(upgradeCommander(state,'TEAM/4')).toBe(false);
    state.skillIds=[];expect(commanderProgress(state).available).toBe(1);expect(upgradeCommander(state,'TEAM/4')).toBe(true);
    for(const invalid of [{...state,xp:-1},{...state,xp:100.5},{...state,skillIds:['TEAM/4','TEAM/5']},{...state,skillIds:['TEAM/1']}])expect(()=>validateCommander(invalid)).toThrow();
    const repository=new GameRepository(`commander-validation-${crypto.randomUUID()}`);try{const save=await repository.load();save.profile.commander!.skillIds=['TEAM/0'];await expect(repository.save(save)).rejects.toThrow('指揮官');}finally{repository.close();}
  });
  it('snapshots permanent skills on deployment and never charges or offers them in battle',()=>{
    const ids=['TEAM/0','TEAM/1','TEAM/2','TEAM/3'],s=createRun({...run().config,commanderNodes:ids});
    ids.splice(0);expect(s.config.commanderNodes).toHaveLength(4);expect(s.wallHp).toBe(1100);expect(s.wallMaxHp).toBe(1100);
    expect(deepMods(s,'common')).toMatchObject({periodicRepair:12,pulseShield:35});expect(s.choicesSpent).toBe(0);expect(s.treeNodes).toEqual([]);
    expect(deepLegalNodes(s).some(n=>n.startsWith('TEAM/'))).toBe(false);
    s.xp=60;s.choicesEarned=2;openDraft(s);const before=structuredClone(s);
    expect(command(s,{type:'buy-node',offerId:s.draft!.id,nodeId:'TEAM/0'})).toBe(false);expect(s).toEqual(before);
    expect(restoreRun(s)).toEqual(s);expect(()=>createRun({...s.config,commanderNodes:['TEAM/2']})).toThrow();
  });
  it('finishes a solo character with an odd remaining node without an impossible mandatory allocation',()=>{
    const s=createRun({stageId:'S12',squadIds:['C04'],captainId:'C04',seed:101});s.xp=720;s.choicesEarned=24;openDraft(s);
    for(const id of pathTo('C04-A/10'))expect(command(s,{type:'buy-node',offerId:s.draft!.id,nodeId:id})).toBe(true);
    let partial=false;
    while(s.draft){const shadow={...s,treeNodes:[...s.treeNodes!]},ids:string[]=[];
      while(deepPointCost(ids,s)<s.draft.pointTarget!-s.choicesSpent){const id=deepLegalNodes(shadow).find(id=>DEEP_NODE_MAP[id].kind!=='ultimate');if(!id)break;ids.push(id);shadow.treeNodes.push(id);}
      if(deepPointCost(ids,s)<s.draft.pointTarget!-s.choicesSpent)partial=true;
      s.draft.pendingNodeIds=ids;expect(command(s,{type:'confirm-node',offerId:s.draft.id,nodeIds:ids})).toBe(true);
    }
    expect(partial).toBe(true);expect(deepLegalNodes(s)).toEqual([]);expect(s.choicesSpent).toBeLessThan(24);expect(restoreRun(s)).toEqual(s);
    s.enemies=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.bossKilled=true;stepRun(s);expect(s.outcome).toBe('victory');
  });
});
