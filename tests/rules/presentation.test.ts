import { describe, expect, it } from 'vitest';
import { createRun, stepRun } from '../../src/sim/engine';
import { createEnemy, emit, hitEnemy } from '../../src/sim/combat';
import { castTactical } from '../../src/sim/weapons';
import { capEffects, effectDetail, effectLifetime, LAYERS, poseFrame, type ActiveEffect } from '../../src/game/presentation';

describe('animation contracts without changing combat rules', () => {
  it.each([1, 3])('retains distinct fire, recoil and recovery frames at %s×', speed => {
    expect([0, 39, 40, 79, 80, 119].map(age => poseFrame(1000 + age, 1000, 60, speed, true))).toEqual([3, 3, 4, 4, 5, 5]);
    expect(poseFrame(1300, 1000, 3 * speed, speed, true)).toBe(2);
    expect(poseFrame(1500, 1000, 60, speed, false)).toBeLessThan(2);
  });
  it('reduces decoration under pressure while reserving skill and boss-death cues', () => {
    const effects: ActiveEffect[] = Array.from({ length: 250 }, (_, seq) => ({ event: { seq, tick: 1, kind: 'hit', x: 1, y: 1 }, born: 0, duration: 100 }));
    effects.unshift({ event: { seq: -1, tick: 1, kind: 'tactical', source: 'C03', x: 20, y: 50 }, born: 0, duration: 500 });
    effects.unshift({ event: { seq: -2, tick: 1, kind: 'death', enemyDefId: 'B03', x: 20, y: 50 }, born: 0, duration: 650 });
    const compact = capEffects(effects, effectDetail(false, 120, 400, 0));
    expect(compact).toHaveLength(24);
    expect(compact.filter(f => f.event.kind !== 'hit').map(f => f.event.kind).sort()).toEqual(['death', 'tactical']);
    expect(effectDetail(true, 0, 0, 0)).toBe('compact');
    expect(LAYERS.warningText).toBeGreaterThan(LAYERS.cutin);
    expect(LAYERS.warnings).toBeGreaterThan(LAYERS.effects);
  });
  it('identifies the exact damaged and defeated enemy without changing HP/XP accounting', () => {
    const state = createRun({ stageId: 'S01', squadIds: ['C01'], captainId: 'C01', seed: 101 });
    const enemy = createEnemy(state, 'E02', 50, 100, 4);
    const oldKills = state.stats.kills, oldXp = state.xp;
    hitEnemy(state, enemy, { source: 'C01', skill: 'weapon', raw: 999, damageType: 'plasma', armorIgnore: 0, shieldMultiplier: 1 });
    expect(state.events.slice(-2).map(e => [e.kind, e.targetId, e.enemyDefId])).toEqual([['hit', enemy.id, 'E02'], ['death', enemy.id, 'E02']]);
    expect(enemy.hp).toBe(0); expect(state.stats.kills).toBe(oldKills + 1); expect(state.xp).toBe(oldXp + 4);
  });
  it('keeps the latest weapon beams and chain links when hit decoration floods the queue', () => {
    const state = createRun({ stageId: 'S01', squadIds: ['C02', 'C03'], captainId: 'C03', seed: 101 });
    emit(state, { kind: 'beam', source: 'C03', x: 195, y: 490, x2: 200, y2: 100 });
    for (let i = 0; i < 5; i++) emit(state, { kind: i ? 'arc' : 'beam', source: 'C02', x: 195, y: 490, x2: 30 + i * 30, y2: 100 });
    for (let i = 0; i < 300; i++) emit(state, { kind: 'hit', source: 'C02', x: i, y: 100 });
    const compact = capEffects(state.events.map(event => ({ event, born: 0, duration: effectLifetime(event) })), 'compact');
    expect(compact.filter(f => f.event.kind === 'beam' || f.event.kind === 'arc')).toHaveLength(6);
    expect(compact.filter(f => f.event.kind === 'hit')).toHaveLength(22);
    expect(state.events).toHaveLength(100);
  });
  it('keeps skill cues after dense hits and targets the sniper skill at its actual victim', () => {
    const state = createRun({ stageId: 'S01', squadIds: ['C03'], captainId: 'C03', seed: 101 });
    state.enemies = [];
    createEnemy(state, 'E01', 40, 400);
    const boss = createEnemy(state, 'B01', 270, 150);
    const rng = structuredClone(state.rng), before = boss.hp;
    expect(castTactical(state)).toBe(true);
    expect(boss.hp).toBe(before - 420);
    for (let i = 0; i < 300; i++) emit(state, { kind: 'hit', x: i % 390, y: 100 });
    const cue = state.events.find(e => e.kind === 'tactical')!;
    expect(cue).toMatchObject({ x: 270, y: 150, source: 'C03' });
    expect(effectLifetime(cue)).toBe(500); expect(state.events).toHaveLength(100); expect(state.rng).toEqual(rng);
    const tick = state.tick; stepRun(state); expect(state.tick).toBe(tick + 1);
  });
});
