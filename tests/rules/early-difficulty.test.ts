import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/balance-v6.json';
import { CHARACTER_IDS, ENEMY_CODE, STAGES, STAGE_MAP } from '../../src/data/content';
import { battleLevelCost, battleXpAt, type ExperienceMode } from '../../src/data/battle-experience';
import { deepTreesFor } from '../../src/data/deep-trees';
import { EARLY_BOSS_APPROACH } from '../../src/data/early-pressure';
import { EARLY_PRESSURE, operationProfile, previousStageProfile, stageProfile } from '../../src/data/progression';
import { resolveSkillNode } from '../../src/data/reworked-skills';
import { deepLock, deepMods, deepNodeCost } from '../../src/sim/deep-tree';
import { difficultyTuning, pressure } from '../../src/sim/difficulty';
import { command, createRun, restoreRun, stepRun } from '../../src/sim/engine';
import { battleExperience } from '../../src/sim/experience';
import { waveAttackDamage, waveStats } from '../../src/sim/operations';
import { finalWave } from '../../src/sim/wave-flow';
import type { CharacterId, RunConfig, RunState } from '../../src/sim/types';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const count = (wave: string) => wave.split(' ').reduce((total, token) => total + Number(token.slice(1)), 0);
const waveCounts = (wave: string) => Object.fromEntries(wave.split(' ').map(token => [token[0], Number(token.slice(1))]));
const config: RunConfig = { stageId: 'S01', difficulty: 'easy', squadIds: ['C01', 'C02', 'C03', 'C06'], captainId: 'C01', seed: 101 };
const run = (config: RunConfig, balanceVersion: 6 | 7) => createRun(config, undefined, { balanceVersion, experienceVersion: 4 });
const laterMainFixtures = fixtures.filter(fixture => fixture.config.stageId.startsWith('S') && fixture.config.stageId !== 'S01');

/** Jump to the final wave, retaining its real spawn plan and engine entrance path. */
function bossEntrance(cfg: RunConfig, balanceVersion: 6 | 7) {
  const state = run(cfg, balanceVersion), wave = finalWave(state);
  state.enemies = [];
  state.waveFlow = { version: 1, wave, startedAt: state.tick, phase: 'combat' };
  const first = state.spawnPlan.findIndex(entry => entry.wave === wave);
  state.spawnCursor = first < 0 ? state.spawnPlan.length : first;
  stepRun(state);
  return state;
}

function skillContract(state: RunState, owner: CharacterId) {
  return deepTreesFor(owner, state).flatMap(tree => tree.nodes).map(node => ({
    ...resolveSkillNode(node, state.config.forms?.[owner]), cost: deepNodeCost(node.id, state),
  }));
}

function compareExperience(before: RunState, after: RunState) {
  const previous = operationProfile(before), current = operationProfile(after);
  const mode: ExperienceMode = after.config.mode === 'hundred' ? 'hundred' : 'campaign';
  expect(after.experienceVersion).toBe(4);
  expect(current.points).toBe(previous.points);
  expect(current.waves).toHaveLength(previous.waves.length);
  expect(current.waveXp).toEqual(previous.waveXp);
  expect(current.escortXp).toBe(previous.escortXp);
  expect(after.spawnPlan.reduce((total, entry) => total + entry.xp, 0))
    .toBe(before.spawnPlan.reduce((total, entry) => total + entry.xp, 0));
  for (let level = 1; level <= current.points + 1; level++) {
    const xp = battleXpAt(level, mode);
    expect(battleExperience({ ...after, xp })).toEqual(battleExperience({ ...before, xp }));
    expect(battleExperience({ ...after, xp }).required).toBe(battleLevelCost(level, mode));
    expect(battleLevelCost(level, mode)).toBe((mode === 'hundred' ? 40 : 30) + (level - 1) * (mode === 'hundred' ? 8 : 5));
    if (xp > 0) expect(battleExperience({ ...after, xp: xp - 1 })).toEqual(battleExperience({ ...before, xp: xp - 1 }));
  }
  expect(after.skillCostVersion).toBe(before.skillCostVersion);
  expect(after.weapons).toEqual(before.weapons);
  for (const owner of after.config.squadIds) {
    expect(skillContract(after, owner)).toEqual(skillContract(before, owner));
    const selected = { ...before, treeNodes: [] as string[] };
    const nodes = deepTreesFor(owner, before).flatMap(tree => tree.nodes);
    for (let point = 0; point < 4; point++) {
      const next = nodes.find(node => node.kind !== 'ultimate' && !deepLock(selected, node.id));
      expect(next).toBeDefined();
      selected.treeNodes = [...selected.treeNodes, next!.id];
    }
    expect(deepMods({ ...after, treeNodes: selected.treeNodes }, owner)).toEqual(deepMods(selected, owner));
  }
}

function compareEnemies(before: RunState, after: RunState, waves: number[]) {
  expect(operationProfile(after)).toEqual(operationProfile(before));
  expect(after.spawnPlan).toEqual(before.spawnPlan);
  expect(after.wavePlan).toEqual(before.wavePlan);
  expect(pressure(after)).toEqual(pressure(before));
  expect(difficultyTuning(after)).toEqual(difficultyTuning(before));
  const stage = STAGES.find(stage => stage.id === after.config.stageId)!;
  for (const wave of waves) {
    for (const id of [...stage.enemyIds, stage.bossId]) expect(waveStats(after, id, wave)).toEqual(waveStats(before, id, wave));
    expect(waveAttackDamage(after, wave, 100)).toBe(waveAttackDamage(before, wave, 100));
  }
}

describe('early difficulty balance v7', () => {
  it('preserves all 66 v6 profiles and exact snapshots, then continues restored battles identically', () => {
    expect(fixtures).toHaveLength(66);
    expect(new Set(fixtures.map(fixture => JSON.stringify(fixture.config))).size).toBe(66);
    for (const fixture of fixtures) {
      const state = run(fixture.config as RunConfig, 6);
      state.runId = 'balance-v6-fixture';
      expect(hash(operationProfile(state)), JSON.stringify(fixture.config)).toBe(fixture.profileHash);
      stepRun(state, 120);
      expect(hash(state), JSON.stringify(fixture.config)).toBe(fixture.stateHash);
      const restored = restoreRun(state);
      expect(restored).toEqual(state);
      stepRun(state, 60); stepRun(restored, 60);
      expect(restored).toEqual(state);
    }
  });

  it('starts new games on balance 7 while retaining experience version 4', () => {
    const state = createRun(config);
    expect(state.balanceVersion).toBe(7);
    expect(state.experienceVersion).toBe(4);
    expect(state.waveFlow).toMatchObject({ version: 1, wave: 1, phase: 'combat' });
    expect(restoreRun(state)).toEqual(state);
  });

  for (const fixture of fixtures) {
    const cfg = fixture.config as RunConfig;
    it(`${cfg.stageId}/${cfg.challengeId ?? cfg.difficulty}: keeps XP, point capacity and skill contracts`, () => {
      const before = run(cfg, 6), after = run(cfg, 7);
      compareExperience(before, after);
      const profile = operationProfile(after);
      expect(after.spawnPlan.filter(entry => entry.wave <= profile.waves.length)).toHaveLength(profile.enemies);
      profile.waveXp.forEach((xp, index) => {
        expect(after.spawnPlan.filter(entry => entry.wave === index + 1).reduce((total, entry) => total + entry.xp, 0)).toBe(xp);
      });
    });
  }

  it('keeps every character and outfit node modifier and point price unchanged', () => {
    for (const owner of CHARACTER_IDS) for (const theme of ['original', 'summer'] as const) {
      const cfg: RunConfig = { ...config, squadIds: [owner], captainId: owner, forms: { [owner]: `${owner}-${theme}` } };
      const before = run(cfg, 6), after = run(cfg, 7);
      const nodes = skillContract(after, owner);
      expect(nodes).toHaveLength(24);
      expect(nodes).toEqual(skillContract(before, owner));
      expect(nodes.every(node => node.cost === (node.kind === 'ultimate' ? 2 : 1))).toBe(true);
    }
  });

  it('leaves all side-story enemy profiles and combat multipliers unchanged', () => {
    for (const stage of STAGES.filter(stage => stage.id.startsWith('X'))) for (const difficulty of ['easy', 'hard'] as const) {
      const cfg = { ...config, stageId: stage.id, difficulty };
      const before = run(cfg, 6), after = run(cfg, 7), lastWave = operationProfile(after).waves.length;
      compareEnemies(before, after, [1, 3, lastWave, lastWave + 1]);
    }
  });

  it('preserves hundred-wave enemy balance and experience at every existing milestone', () => {
    const cfg: RunConfig = { ...config, stageId: 'S03', mode: 'hundred' };
    const before = run(cfg, 6), after = run(cfg, 7);
    compareExperience(before, after);
    compareEnemies(before, after, [1, 3, 10, 50, 99, 100]);
    expect(restoreRun(after)).toEqual(after);
  });

  it('raises S01–S04 enemy numbers and boss strength in every campaign mode', () => {
    for (const fixture of fixtures.filter(fixture => /^S0[1-4]$/.test(fixture.config.stageId))) {
      const cfg = fixture.config as RunConfig;
      const before = operationProfile(run(cfg, 6)), after = operationProfile(run(cfg, 7));
      expect(after.enemies, JSON.stringify(cfg)).toBeGreaterThan(before.enemies);
      expect(after.bossScale, JSON.stringify(cfg)).toBeGreaterThan(before.bossScale);
    }
  });

  it('calibrates early boss hits by stage and mode without changing other combat multipliers', () => {
    for (const fixture of fixtures) {
      const cfg = fixture.config as RunConfig;
      const before = pressure(run(cfg, 6)), after = pressure(run(cfg, 7));
      const factor = cfg.stageId === 'S01'
        ? cfg.challengeId === 'four' || cfg.challengeId === 'no-skill' ? .45 : .5
        : cfg.stageId === 'S03' ? .7 : 1;
      expect(after.bossDamage, JSON.stringify(cfg)).toBeCloseTo(before.bossDamage * factor);
      expect({ ...after, bossDamage: before.bossDamage }).toEqual(before);
    }
  });

  it('keeps every S02–S12 authored enemy in both formations and the actual spawn plan', () => {
    expect(laterMainFixtures).toHaveLength(55);
    for (const fixture of laterMainFixtures) {
      const cfg = fixture.config as RunConfig, state = run(cfg, 7), profile = operationProfile(state);
      expect(state.spawnPlan).toHaveLength(profile.enemies + (profile.escortCount ?? 0));
      expect(state.spawnPlan.filter(entry => entry.wave === finalWave(state))).toHaveLength(profile.escortCount ?? 0);
      profile.waves.forEach((wave, index) => {
        const expected = waveCounts(wave), groups = profile.formations?.[index];
        const entries = state.spawnPlan.filter(entry => entry.wave === index + 1);
        expect(groups, `${cfg.stageId}/${cfg.challengeId ?? cfg.difficulty} wave ${index + 1}`).toBeDefined();
        for (const [code, enemyId] of Object.entries(ENEMY_CODE)) {
          const context = `${cfg.stageId}/${cfg.challengeId ?? cfg.difficulty} wave ${index + 1}/${code}`;
          expect(groups!.reduce((total, group) => total + (group.code === code ? group.count : 0), 0), context).toBe(expected[code] ?? 0);
          expect(entries.filter(entry => entry.defId === enemyId), context).toHaveLength(expected[code] ?? 0);
        }
      });
    }
  });

  it('adds ordinary enemies while preserving v6 specialist limits and one armored enemy in constrained modes', () => {
    for (const fixture of laterMainFixtures) {
      const cfg = fixture.config as RunConfig;
      const before = operationProfile(run(cfg, 6)), after = operationProfile(run(cfg, 7));
      expect(after.enemies, JSON.stringify(cfg)).toBeGreaterThan(before.enemies);
      after.waves.forEach((wave, index) => {
        const current = waveCounts(wave), previous = waveCounts(before.waves[index]);
        for (const code of Object.keys(ENEMY_CODE).filter(code => code !== 'C')) {
          expect(current[code] ?? 0, `${cfg.stageId}/${cfg.challengeId ?? cfg.difficulty} wave ${index + 1}/${code}`)
            .toBeLessThanOrEqual(previous[code] ?? 0);
        }
        if (cfg.challengeId === 'four' || cfg.challengeId === 'no-skill') expect(current.P ?? 0).toBeLessThanOrEqual(1);
      });
    }
  });

  it('spawns and restores the S01 v7 boss approach without moving legacy, other-stage or hundred-wave entrances', () => {
    const opening = fixtures.filter(fixture => fixture.config.stageId === 'S01').map(fixture => fixture.config as RunConfig);
    const cases: { cfg: RunConfig; balanceVersion: 6 | 7; x: number; y: number }[] = [
      ...opening.map(cfg => ({ cfg, balanceVersion: 7 as const, x: EARLY_BOSS_APPROACH.x, y: EARLY_BOSS_APPROACH.y })),
      ...opening.map(cfg => ({ cfg, balanceVersion: 6 as const, x: 195, y: 150 })),
      ...STAGES.filter(stage => stage.id !== 'S01').map(stage => ({ cfg: { ...config, stageId: stage.id }, balanceVersion: 7 as const, x: 195, y: 150 })),
      { cfg: { ...config, stageId: 'S03', mode: 'hundred' }, balanceVersion: 7, x: 195, y: 150 },
    ];
    for (const { cfg, balanceVersion, x, y } of cases) {
      const state = bossEntrance(cfg, balanceVersion);
      const bosses = state.enemies.filter(enemy => enemy.defId === STAGE_MAP[cfg.stageId].bossId);
      expect(bosses).toHaveLength(1);
      expect(bosses[0]).toMatchObject({ x, y, wave: finalWave(state) });
      expect(state.bossIntro?.enemyId).toBe(bosses[0].id);
      const restored = restoreRun(JSON.parse(JSON.stringify(state)));
      expect(restored).toEqual(state);
      stepRun(restored, 30);
      expect(restored).toEqual(state);
      expect(command(state, { type: 'finish-boss-intro' })).toBe(true);
      expect(command(restored, { type: 'finish-boss-intro' })).toBe(true);
      stepRun(state, 30); stepRun(restored, 30);
      expect(restored).toEqual(state);
    }
  });

  it('follows the authored opening formula with a flatter rise in main-story base density and boss scale', () => {
    const main = STAGES.filter(stage => stage.id.startsWith('S')).sort((a, b) => a.id.localeCompare(b.id));
    const previousBoss: number[] = [], currentBoss: number[] = [], previousBase: number[] = [], currentBase: number[] = [];
    for (const stage of main) {
      const rank = Number(stage.id.slice(1));
      const previous = stageProfile(stage.id, 'easy', { balanceVersion: 6 });
      const current = stageProfile(stage.id, 'easy', { balanceVersion: 7 });
      previousBoss.push(previous.bossScale); currentBoss.push(current.bossScale);
      previousBase.push(count(previousStageProfile(stage.id, 'easy', { balanceVersion: 6 }).waves[0]));
      currentBase.push(count(previousStageProfile(stage.id, 'easy', { balanceVersion: 7 }).waves[0]));
      expect(current.bossScale).toBeCloseTo(Math.min(1.3, EARLY_PRESSURE.bossStart + rank * EARLY_PRESSURE.bossGrowth));
      expect(currentBase.at(-1)).toBe(EARLY_PRESSURE.base + Math.floor(rank * EARLY_PRESSURE.baseGrowth));
    }
    for (let index = 1; index < main.length; index++) {
      expect(currentBase[index]).toBeGreaterThanOrEqual(currentBase[index - 1]);
      expect(currentBoss[index]).toBeGreaterThanOrEqual(currentBoss[index - 1]);
      expect(currentBoss[index] - currentBoss[index - 1]).toBeLessThanOrEqual(EARLY_PRESSURE.bossGrowth + 1e-10);
    }
    expect(currentBase.at(-1)! - currentBase[0]).toBeLessThan(previousBase.at(-1)! - previousBase[0]);
    expect(currentBoss.at(-1)! - currentBoss[0]).toBeLessThan(previousBoss.at(-1)! - previousBoss[0]);
  });
});
