import { describe, expect, it } from 'vitest';
import { command, createRun, stepRun } from '../../src/sim/engine';
import { createEnemy } from '../../src/sim/combat';
import { getLegalNodeIds } from '../../src/sim/draft';
import { CHARACTER_IDS, STAGES } from '../../src/data/content';
import type { CharacterId, RunState } from '../../src/sim/types';

const base = (captain: CharacterId = 'C01') => createRun({ stageId: 'S01', squadIds: [captain], captainId: captain, seed: 101 });

describe('AC02/AC11 · valid squads and one legal tactical', () => {
  it('accepts one through five characters, rejects zero/six/duplicates and absent captain', () => {
    for (let count = 1; count <= 5; count++) expect(() => createRun({ stageId: 'S01', squadIds: CHARACTER_IDS.slice(0, count), captainId: 'C01', seed: 101 })).not.toThrow();
    for (const squadIds of [[], CHARACTER_IDS, ['C01', 'C01']] as CharacterId[][]) expect(() => createRun({ stageId: 'S01', squadIds, captainId: 'C01', seed: 101 })).toThrow();
    expect(() => createRun({ stageId: 'S01', squadIds: ['C01'], captainId: 'C02', seed: 101 })).toThrow();
  });
  it('only C06 may cast without a target and no failed cast consumes cooldown', () => {
    for (const captain of CHARACTER_IDS) {
      const state = base(captain); state.enemies = [];
      expect(command(state, { type: 'cast' })).toBe(captain === 'C06');
      expect(state.tacticalReadyAt > 0).toBe(captain === 'C06');
      expect(state.stats.casts.length).toBe(captain === 'C06' ? 1 : 0);
      expect(state.wallHp).toBe(1000);
    }
  });
  it('cannot cast twice in one tick or while paused, and no-skill challenge rejects at core API', () => {
    const state = base('C06');
    expect(command(state, { type: 'cast' })).toBe(true);
    expect(command(state, { type: 'cast' })).toBe(false);
    const paused = base('C06'); command(paused, { type: 'pause', reason: 'user' });
    expect(command(paused, { type: 'cast' })).toBe(false);
    const challenge = createRun({ stageId: 'S01', squadIds: ['C06'], captainId: 'C06', seed: 101, challengeId: 'no-skill' });
    expect(command(challenge, { type: 'cast' })).toBe(false);
  });
  it('C01 tactical deals its four bursts exactly at cast tick, +6, +12 and +18', () => {
    const state = base('C01'); state.enemies = []; state.weapons = []; state.spawnPlan = []; state.spawnCursor = 0;
    const target = createEnemy(state, 'E01', 195, 150); target.speed = 0;
    expect(command(state, { type: 'cast' })).toBe(true);
    expect(target.hp).toBe(105);
    expect(state.scheduled.map(shot => shot.at)).toEqual([6, 12, 18]);
    for (const [before, at, hp] of [[5, 6, 70], [11, 12, 35], [17, 18, 0]]) {
      stepRun(state, before - state.tick); expect(target.hp).toBe(hp + 35);
      stepRun(state); expect(state.tick).toBe(at); expect(target.hp).toBe(hp);
    }
    expect(state.stats.damageByCharacter.C01).toBe(140);
  });
  it('only offers status extension when a currently owned weapon or tactical can apply status', () => {
    expect(getLegalNodeIds(base('C01'))).not.toContain('G06-1');
    expect(getLegalNodeIds(base('C03'))).not.toContain('G06-1');
    expect(getLegalNodeIds(base('C02'))).toContain('G06-1');
    expect(getLegalNodeIds(base('C06'))).toContain('G06-1');
  });
});

describe('AC06/TIME01–03 · all pause reasons and independent update frequency', () => {
  it('resuming one reason leaves all other reasons and the full simulation frozen', () => {
    const state = base();
    for (const reason of ['user', 'hidden', 'orientation', 'error', 'tutorial'] as const) command(state, { type: 'pause', reason });
    const frozen = JSON.stringify(state);
    stepRun(state, 300);
    expect(JSON.stringify(state)).toBe(frozen);
    command(state, { type: 'resume', reason: 'user' });
    expect(state.phase).toBe('paused');
    const tick = state.tick;
    stepRun(state, 300);
    expect(state.tick).toBe(tick);
    for (const reason of ['hidden', 'orientation', 'error', 'tutorial'] as const) command(state, { type: 'resume', reason });
    stepRun(state);
    expect(state.tick).toBe(tick + 1);
  });
  it('frame batches with the same effective ticks have identical state regardless of visual RNG draws', () => {
    const a = base('C03'), b = structuredClone(a);
    for (let i = 0; i < 100; i++) stepRun(a);
    for (let i = 0; i < 20; i++) stepRun(b, 5);
    expect(b).toEqual(a);
  });
});

describe('TIME04/DRAFT14 · exact spawn distribution and XP budget', () => {
  it('all three stages have eight exact90XP waves, balanced eight spawn groups, and elites at+20seconds', () => {
    for (const stage of STAGES) for (const seed of [101, 211, 307, 401, 503, 601, 709, 809, 907, 1009]) {
      const state = createRun({ stageId: stage.id, squadIds: ['C01'], captainId: 'C01', seed });
      for (let wave = 1; wave <= 8; wave++) {
        const entries = state.spawnPlan.filter(p => p.wave === wave);
        expect(entries.reduce((n, p) => n + p.xp, 0)).toBe(90);
        const at = (wave - 1) * 1350;
        const groups = Array.from({ length: 8 }, (_, i) => entries.filter(p => p.at === at + i * 150).length);
        expect(Math.max(...groups) - Math.min(...groups)).toBeLessThanOrEqual(1);
        expect(groups.reduce((a, b) => a + b, 0)).toBe(entries.length);
        expect(entries.filter(p => p.defId === 'E07' || p.defId === 'E08').every(p => p.at === at + 600)).toBe(true);
      }
      expect(state.spawnPlan.reduce((n, p) => n + p.xp, 0)).toBe(720);
      expect(state.spawnPlan.every(p => p.at < 14400 && p.x >= 37 && p.x <= 353)).toBe(true);
    }
  });
  it('birth bands are seeded random, rather than fixing all early groups to leftmost lanes', () => {
    const band = (x: number) => [45, 120, 195, 270, 345].sort((a, b) => Math.abs(a - x) - Math.abs(b - x))[0];
    const firstBands = [101, 211, 307, 401, 503, 601, 709, 809, 907, 1009].map(seed => {
      const state = createRun({ stageId: 'S01', squadIds: ['C01'], captainId: 'C01', seed });
      return band(state.spawnPlan[0].x);
    });
    expect(new Set(firstBands).size).toBeGreaterThan(1);
  });
});

describe('AC07/TIME05–08 · exact boss and deadline boundaries', () => {
  function finalTick(): RunState {
    const state = base(); state.tick = 14399; state.enemies = []; state.weapons = [];
    state.spawnPlan = []; state.spawnCursor = 0; state.bossSpawned = true;
    const boss = createEnemy(state, 'B01', 195, 150); boss.hp = 1;
    state.scheduled = [{ at: 14400, packet: { source: 'C01', skill: 'endpoint', raw: 10, damageType: 'plasma', armorIgnore: 1, shieldMultiplier: 1 }, x: 195, y: 150, radius: 90, enemyDamage: 0, enemySource: null }];
    return state;
  }
  it('spawns first group at tick0 and boss at10800 exactly', () => {
    const state = base();
    expect(state.enemies.length).toBe(state.spawnPlan.filter(p => p.at === 0).length);
    state.enemies = []; state.weapons = []; state.spawnCursor = state.spawnPlan.length; state.tick = 10799;
    stepRun(state);
    expect(state.tick).toBe(10800);
    expect(state.enemies.some(e => e.defId === 'B01')).toBe(true);
  });
  it('the final legal tick14400 can kill the boss and win, ahead of timeout', () => {
    const state = finalTick(); stepRun(state);
    expect(state.tick).toBe(14400);
    expect(state.outcome).toBe('victory');
  });
  it('simultaneous wall death outranks victory and no upgrade can revive a finished run', () => {
    const state = finalTick(); state.enemies[0].xp = 40;
    state.scheduled.push({ at: 14400, packet: null, x: 195, y: 450, radius: 0, enemyDamage: 1000, enemySource: 'B01' });
    stepRun(state);
    expect(state.outcome).toBe('wall');
    expect(state.draft).toBeNull();
    expect(command(state, { type: 'cast' })).toBe(false);
    expect(command(state, { type: 'choose', offerId: 1, nodeId: 'G05-1' })).toBe(false);
    const snapshot = JSON.stringify(state); stepRun(state, 100);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
  it('boss dead with a surviving summoned minion cannot win', () => {
    const state = finalTick(); const minion = createEnemy(state, 'E01', 45, 20, 0);
    stepRun(state);
    expect(state.bossKilled).toBe(true);
    expect(state.enemies.some(e => e.id === minion.id)).toBe(true);
    expect(state.outcome).toBe('timeout');
  });
});
