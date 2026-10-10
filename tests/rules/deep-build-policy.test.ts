import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS, CONTENT_VERSION } from '../../src/data/content';
import { PRE_REWORK_VERSION } from '../../src/data/forms';
import { DEEP_NODE_MAP, deepTreesFor } from '../../src/data/deep-trees';
import { operationProfile } from '../../src/data/progression';
import { createRun } from '../../src/sim/engine';
import { deepLock, deepNodeCost, deepPointCost } from '../../src/sim/deep-tree';
import { allocateDeepPlan, buildCurrentPlan, buildPlan, CURRENT_TERMINALS, pathTo, playDeep, replayDeep, type DeepRunOptions } from '../helpers/deep-build';
import type { RunState } from '../../src/sim/types';

const comparable=(state:RunState)=>{const {runId,...rest}=state;return rest;};

describe('free-skill validation policies and exact replay',()=>{
  it('covers the current 24-node trees with exact weighted subject and operation budgets',()=>{
    expect(CURRENT_TERMINALS).toHaveLength(8);
    expect(new Set(CURRENT_TERMINALS.map(node=>node.ownerId))).toEqual(new Set(CHARACTER_IDS));
    for(const terminal of CURRENT_TERMINALS)for(const budget of [6,8])for(const total of [20,24,60]){
      const {squad,owner,plan}=buildCurrentPlan(terminal.id,budget,total);
      const state=createRun({stageId:'S03',squadIds:squad,captainId:owner,seed:101});
      expect(deepTreesFor(owner,state).flatMap(tree=>tree.nodes)).toHaveLength(24);
      expect(deepPointCost(plan,state)).toBe(total);
      expect(deepPointCost(plan.filter(id=>DEEP_NODE_MAP[id].ownerId===owner),state)).toBe(budget);
      expect(new Set(plan).size).toBe(plan.length);
      for(const id of plan){
        expect(deepLock(state,id),id).toBeNull();
        state.treeNodes=[...state.treeNodes!,id];
        state.choicesSpent+=deepNodeCost(id,state);
        if(DEEP_NODE_MAP[id].kind==='ultimate')state.evolvedCount++;
      }
      expect(state.treeNodes!.filter(id=>DEEP_NODE_MAP[id].ownerId===owner&&DEEP_NODE_MAP[id].kind==='ultimate')).toEqual([terminal.id]);
    }
    expect(()=>buildCurrentPlan('C01-A/9')).toThrow('Unknown current ultimate');
    expect(()=>buildCurrentPlan('C01-A4/4',5)).toThrow('Invalid point budget');
  });

  it.each([
    {name:'operation 3',compatibility:{}},
    {name:'operation 2',compatibility:{operationVersion:2 as const}},
    {name:'unversioned operations',compatibility:{legacyOperations:true}},
    {name:'unversioned balance',compatibility:{legacyBalance:true}},
  ])('replays $name without silently choosing a different operation version',({compatibility})=>{
    const {squad,owner,plan}=buildPlan('C01-A/9');
    const {s,restored}=playDeep({stageId:'S03',squadIds:squad,captainId:owner,seed:101},plan,true,{compatibility});
    expect(s.contentVersion).toBe(PRE_REWORK_VERSION);
    expect(s.outcome).toBe('victory');
    expect(restored).toBe(true);
    expect(comparable(replayDeep(s))).toEqual(comparable(s));
  });

  it.each([
    {name:'current defaults',compatibility:{},unspentAtVictory:0},
    {name:'saved wave balance and experience',compatibility:{balanceVersion:5 as const,experienceVersion:3 as const},unspentAtVictory:0},
    // The historical XP schedule awards its final two points with the boss escort, after the final draft.
    {name:'unversioned experience',compatibility:{balanceVersion:5 as const,experienceVersion:null},unspentAtVictory:2},
  ])('completes wave drafts and exactly replays $name',({compatibility,unspentAtVictory})=>{
    const {squad,owner}=buildCurrentPlan('C01-A4/4',8);
    const config={stageId:'S03' as const,squadIds:squad,captainId:owner,seed:101};
    const {plan}=buildCurrentPlan('C01-A4/4',8,operationProfile(createRun(config,CONTENT_VERSION,compatibility)).points);
    const {s,restored,bossDeadAt,bossSpawnedAt}=playDeep(config,plan,true,{contentVersion:CONTENT_VERSION,compatibility});
    expect(s.contentVersion).toBe(CONTENT_VERSION);
    expect(s.outcome).toBe('victory');
    expect(s.choicesEarned).toBe(operationProfile(s).points);
    expect(s.choicesSpent).toBe(operationProfile(s).points-unspentAtVictory);
    expect(deepPointCost(s.treeNodes!.filter(id=>DEEP_NODE_MAP[id].ownerId===owner),s)).toBe(8);
    expect(restored).toBe(true);
    expect(bossSpawnedAt).not.toBeNull();
    expect(bossDeadAt).toBeGreaterThan(bossSpawnedAt!);
    // Buying the last point does not close a wave draft; confirmation is a separate legal command.
    expect(s.actions.some(action=>action.command.type==='confirm-node'&&action.command.nodeIds.length===0)).toBe(true);
    expect(comparable(replayDeep(s))).toEqual(comparable(s));
  });

  it('retains a single remaining point instead of attempting an unaffordable ultimate',()=>{
    const {squad,owner}=buildCurrentPlan('C01-A4/4');
    const s=createRun({stageId:'S01',squadIds:squad,captainId:owner,seed:101});
    const path=pathTo('C01-A4/4');
    // Minimal allocation fixture: the four prerequisites are already bought and one point remains.
    s.treeNodes=path.slice(0,-1);s.choicesSpent=4;s.choicesEarned=5;
    s.waveFlow={version:1,wave:1,startedAt:0,phase:'allocation'};
    s.pauseReasons=['upgrade'];s.phase='choosing';
    s.draft={id:1,choice:1,cards:[],focusId:owner,selectedEvolution:null,pointTarget:5,pendingNodeIds:[]};
    expect(deepLock(s,path.at(-1)!)).toBeNull();
    allocateDeepPlan(s,path);
    expect(s.choicesSpent).toBe(4);
    expect(s.choicesEarned).toBe(5);
    expect(s.treeNodes).toEqual(path.slice(0,-1));
    expect(s.draft).toBeNull();
    expect(s.waveFlow.phase).toBe('combat');
    expect(s.actions.at(-1)?.command).toEqual({type:'confirm-node',offerId:1,nodeIds:[]});
  });

  it('still rejects illegal plans and corrupted replay commands',()=>{
    const {squad,owner,plan}=buildCurrentPlan('C01-A4/4');
    const config={stageId:'S01' as const,squadIds:squad,captainId:owner,seed:101};
    const options:DeepRunOptions={contentVersion:CONTENT_VERSION};
    expect(()=>playDeep(config,['C01-A4/4'],false,options)).toThrow('Invalid policy C01-A4/4');
    expect(()=>playDeep(config,[plan[0],plan[0]],false,options)).toThrow('duplicate nodes');
    const {s}=playDeep(config,plan,false,options);
    const corrupted=structuredClone(s);
    const action=corrupted.actions.find(action=>action.command.type==='buy-node')!;
    if(action.command.type==='buy-node')action.command.offerId+=1;
    expect(()=>replayDeep(corrupted)).toThrow(/Replay command rejected at action \d+, tick \d+/);
  });
});
