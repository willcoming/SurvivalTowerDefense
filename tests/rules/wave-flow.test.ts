import { battleXpAt } from '../../src/data/battle-experience';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STAGES } from '../../src/data/content';
import * as progression from '../../src/data/progression';
import { minimumWaveOperation } from '../../src/data/wave-progression';
import { hundredCleared } from '../../src/data/hundred';
import { command, createRun, restoreRun, stepRun } from '../../src/sim/engine';
import { createEnemy, hitEnemy } from '../../src/sim/combat';
import { deepLegalNodes } from '../../src/sim/deep-tree';
import { pressure } from '../../src/sim/difficulty';
import { finalWave } from '../../src/sim/wave-flow';
import type { RunConfig, RunState } from '../../src/sim/types';

const config: RunConfig = { stageId: 'S01', difficulty: 'easy', squadIds: ['C01','C02','C03','C05','C06'], captainId: 'C02', seed: 101 };
function defeatAll(s: RunState) {
  for (const enemy of [...s.enemies]) if (enemy.hp > 0) hitEnemy(s, enemy, {
    source: 'C01', skill: 'test', raw: 1e15, damageType: 'plasma', armorIgnore: 1, shieldMultiplier: 1,
  });
}
/** Resolve real spawn entries and award their real XP, with combat removed as a variable. */
function clearWave(s: RunState) {
  const wave = s.waveFlow!.wave;
  for (let guard = 0; guard < 3000 && !s.draft && !s.outcome && s.waveFlow!.wave === wave; guard++) {
    if (s.bossIntro) command(s, { type: 'finish-boss-intro' });
    defeatAll(s); stepRun(s);
  }
  expect(s.draft || s.outcome || s.waveFlow!.wave > wave).toBeTruthy();
}
function allocation(s = createRun(config)) {
  for (let wave = 0; wave < 10 && !s.draft; wave++) clearWave(s);
  expect(s.draft).not.toBeNull();
  return s;
}
afterEach(() => vi.restoreAllMocks());

describe('wave allocation version 1', () => {
  for (const stage of STAGES) for (const mode of ['easy','hard','four','no-skill','two-evolutions'] as const) {
    if (stage.id.startsWith('X') && !['easy','hard'].includes(mode)) continue;
    it(`${stage.id}/${mode}: expands short encounters and preserves authored totals and combat tuning`, () => {
      const c: RunConfig = { ...config, stageId: stage.id, squadIds: config.squadIds.slice(0,4),
        difficulty: mode === 'easy' ? 'easy' : 'hard', challengeId: mode === 'easy' || mode === 'hard' ? null : mode };
      const old = createRun(c, '0.6.0-dev.2'), s = createRun(c);
      const before = progression.operationProfile(old), p = progression.operationProfile(s);
      const ratio = Math.max(10, before.waves.length) / before.waves.length;
      expect(p.waves).toHaveLength(Math.max(10, before.waves.length));
      expect(p.enemies).toBe(Math.round(before.enemies * ratio));
      expect(p.points).toBe(2 * Math.round(before.points * ratio / 2));
      expect(p.escortCount).toBe(before.escortCount); expect(p.escortXp).toBeGreaterThanOrEqual(before.escortXp!);
      expect(pressure(s)).toEqual(pressure(old));
      expect(p.waveXp.reduce((a,b) => a+b, 0) + p.escortXp!).toBe(battleXpAt(p.points+1));
      expect(s.spawnPlan).toHaveLength(p.enemies + p.escortCount!);
      expect(s.spawnPlan.reduce((n,e) => n+e.xp, 0)).toBe(battleXpAt(p.points+1));
      p.waves.forEach((wave, i) => {
        const count = wave.split(' ').reduce((n,t) => n+Number(t.slice(1)), 0);
        const entries = s.spawnPlan.filter(e => e.wave === i+1);
        expect(entries).toHaveLength(count);
        expect(entries.reduce((n,e) => n+e.xp, 0)).toBe(p.waveXp[i]);
        expect(p.formations![i]!.reduce((n,g) => n+g.count, 0)).toBe(count);
        expect(entries.every(e => stage.enemyIds.includes(e.defId) && e.at >= 0)).toBe(true);
      });
      expect(restoreRun(s)).toEqual(s);
      expect(restoreRun(old)).toEqual(old); expect(old.waveFlow).toBeUndefined();
    });
  }

  it('accumulates multiple upgrades during a wave without interrupting or spawning the next wave', () => {
    const s = createRun(config); s.xp = battleXpAt(7); s.choicesEarned = 6; s.wallHp = s.wallMaxHp = 1e9;
    // Keep the current wave alive past the old global boss schedule.
    s.enemies[0].hp = s.enemies[0].maxHp = 1e12;
    for (const w of s.weapons) w.nextAttack = 1e9;
    stepRun(s, 8000);
    expect(s.draft).toBeNull(); expect(s.phase).toBe('running');
    expect(s.waveFlow!.wave).toBe(1); expect(s.enemies.every(e => e.wave === 1)).toBe(true);
    expect(s.bossSpawned).toBe(false);
    clearWave(s);
    expect(s.draft!.pointTarget).toBe(s.choicesEarned);
    expect(s.draft!.pointTarget).toBeGreaterThanOrEqual(6);
  });

  it('commits a partial batch once and carries banked points into the next allocation', () => {
    const s = allocation();
    // Bank the first single point so the next allocation can be partially spent.
    command(s,{type:'confirm-node',offerId:s.draft!.id,nodeIds:[]}); clearWave(s);
    const earned = s.choicesEarned, wave = s.waveFlow!.wave, tick = s.tick, offerId = s.draft!.id;
    expect(earned).toBeGreaterThanOrEqual(2);
    const nodeId = deepLegalNodes(s)[0];
    expect(command(s,{type:'confirm-node',offerId,nodeIds:[nodeId]})).toBe(true);
    expect(s.choicesSpent).toBe(1); expect(s.choicesEarned-s.choicesSpent).toBe(earned-1);
    expect(s.tick).toBe(tick); expect(s.waveFlow!.wave).toBe(wave+1); expect(s.draft).toBeNull();
    expect(command(s,{type:'confirm-node',offerId,nodeIds:[nodeId]})).toBe(false);
    expect(restoreRun(s)).toEqual(s);
    clearWave(s);
    expect(s.draft!.pointTarget).toBe(s.choicesEarned); expect(s.choicesSpent).toBe(1);
    expect(restoreRun(s)).toEqual(s);
  });

  it('banks all points, discards pending selections, and cannot immediately reopen the same allocation', () => {
    const s = allocation(), wave = s.waveFlow!.wave, earned = s.choicesEarned;
    s.draft!.pendingNodeIds = [deepLegalNodes(s)[0]];
    expect(command(s,{type:'confirm-node',offerId:s.draft!.id,nodeIds:[]})).toBe(true);
    expect(s.treeNodes).toEqual([]); expect(s.choicesEarned).toBe(earned);
    stepRun(s, 3); expect(s.draft).toBeNull(); expect(s.waveFlow!.wave).toBe(wave+1);
  });

  it('rejects over-budget, repeated and locked nodes without applying any part of the batch', () => {
    const s = allocation(), offerId = s.draft!.id, node = deepLegalNodes(s)[0];
    for (const nodeIds of [[node,node],['C01-A4/4'],['missing']]) {
      expect(command(s,{type:'confirm-node',offerId,nodeIds})).toBe(false);
      expect(s.choicesSpent).toBe(0); expect(s.treeNodes).toEqual([]);
    }
  });

  it('waits for pending spawn groups, summons, projectiles and delayed hostile damage', () => {
    const s = createRun(config); defeatAll(s); stepRun(s);
    expect(s.waveFlow!.wave).toBe(1); expect(s.draft).toBeNull();
    // Resolve the real remaining deployment before introducing a surviving summon.
    const end = s.spawnPlan.findIndex(e => e.wave === 2);
    s.tick = Math.max(...s.spawnPlan.slice(0,end).map(e => e.at));
    for (const entry of s.spawnPlan.slice(s.spawnCursor,end)) createEnemy(s,entry.defId,entry.x,20,entry.xp,1);
    s.spawnCursor = end; defeatAll(s);
    const summon = createEnemy(s,'E01',195,20,0,1); for (const w of s.weapons) w.nextAttack = 1e9;
    stepRun(s); expect(s.draft).toBeNull(); expect(s.waveFlow!.wave).toBe(1);
    summon.hp = 0; s.xp = battleXpAt(5); s.choicesEarned = 4;
    s.scheduled.push({at:s.tick+3,packet:null,x:195,y:450,radius:0,enemyDamage:1,enemySource:'E05'});
    s.projectiles.push({id:s.nextEntityId++,x:195,y:20,tx:195,ty:450,vx:0,vy:0,expires:s.tick+5,hitIds:[],remaining:1,falloff:[1],radius:1,blastRadius:0,packet:null,enemyDamage:1,enemySource:'E05',impactAt:0});
    stepRun(s,4); expect(s.draft).toBeNull(); expect(s.waveFlow!.wave).toBe(1);
    stepRun(s); expect(s.draft).not.toBeNull();
  });

  it('freezes ticks and cooldowns during allocation and respects additional pause reasons', () => {
    const s = allocation(), tick = s.tick, cooldowns = s.weapons.map(w => w.ultimateReadyAt);
    for (const steps of [30,60,90]) { stepRun(s,steps); expect(s.tick).toBe(tick); }
    expect(s.weapons.map(w => w.ultimateReadyAt)).toEqual(cooldowns);
    command(s,{type:'pause',reason:'hidden'});
    expect(command(s,{type:'confirm-node',offerId:s.draft!.id,nodeIds:[]})).toBe(false);
    command(s,{type:'resume',reason:'hidden'}); command(s,{type:'pause',reason:'user'});
    command(s,{type:'confirm-node',offerId:s.draft!.id,nodeIds:[]});
    expect(s.phase).toBe('paused'); stepRun(s); expect(s.tick).toBe(tick);
    command(s,{type:'resume',reason:'user'}); stepRun(s); expect(s.tick).toBe(tick+1);
  });

  it('skips a break without spendable points and ends after the boss despite banked points', () => {
    const s = createRun(config);
    for (let guard=0; guard<30 && !s.outcome; guard++) {
      clearWave(s);
      if (s.draft) command(s,{type:'confirm-node',offerId:s.draft.id,nodeIds:[]});
    }
    expect(s.outcome).toBe('victory'); expect(s.waveFlow!.wave).toBe(11);
    expect(s.choicesSpent).toBe(0); expect(s.choicesEarned).toBe(progression.operationProfile(s).points);
    expect(s.draft).toBeNull(); expect(restoreRun(s)).toEqual(s);
  });

  it('keeps 100 waves and the boss in wave 100 for the hundred challenge', () => {
    const s = createRun({...config,stageId:'S03',mode:'hundred'});
    expect(progression.operationProfile(s).waves).toHaveLength(100); expect(finalWave(s)).toBe(100);
    for (let guard=0; guard<105 && !s.outcome; guard++) {
      const wave=s.waveFlow!.wave; clearWave(s);
      expect(hundredCleared(s)).toBe(wave);
      expect(s.bossSpawned).toBe(wave===100);
      if(s.draft)command(s,{type:'confirm-node',offerId:s.draft.id,nodeIds:[]});
    }
    expect(s.outcome).toBe('victory'); expect(hundredCleared(s)).toBe(100);
  });

  it('supports authored operations beyond 100 waves without a common cap', () => {
    const base=minimumWaveOperation(progression.stageProfile('S01'),128);
    expect(base.waves).toHaveLength(128);
    const p={...base,waves:Array(128).fill('C1'),waveXp:Array(128).fill(60),points:256,enemies:128,escortCount:0,escortXp:0,formations:undefined,groupInterval:0};
    vi.spyOn(progression,'operationProfile').mockReturnValue(p);
    const s=createRun(config);
    for(let i=0;i<130&&!s.outcome;i++){clearWave(s);if(s.draft)command(s,{type:'confirm-node',offerId:s.draft.id,nodeIds:[]});}
    expect(s.waveFlow!.wave).toBe(129); expect(s.outcome).toBe('victory');
  });

  it('rejects missing, inconsistent or unsupported wave progress on restore', () => {
    const s=allocation();
    for(const mutate of [(r:RunState)=>{delete r.waveFlow;},(r:RunState)=>{r.waveFlow!.wave=999;},(r:RunState)=>{r.waveFlow!.startedAt=r.tick+1;},(r:RunState)=>{r.waveFlow!.phase='combat';}]){
      const copy=structuredClone(s);mutate(copy);expect(()=>restoreRun(copy)).toThrow();
    }
  });
});
