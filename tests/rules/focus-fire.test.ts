import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION, LEGACY_CONTENT_VERSION, RANGE_CONTENT_VERSION, PREVIOUS_TREE_VERSION } from '../../src/data/content';
import { deepTreesFor, DEEP_NODE_MAP } from '../../src/data/deep-trees';
import { command, createRun, restoreRun, snapshotRun } from '../../src/sim/engine';
import { createEnemy, hitEnemy, threat } from '../../src/sim/combat';
import { stepWeapons } from '../../src/sim/weapons';
import { DamageAccumulator, isCriticalHit } from '../../src/game/effects';
import type { VisualEvent } from '../../src/sim/types';

function fixture(version = CONTENT_VERSION) {
  const s = createRun({ stageId: 'S01', squadIds: ['C01', 'C02', 'C03', 'C04', 'C05'], captainId: 'C01', seed: 101 }, version);
  s.enemies = []; s.events = [];
  return s;
}

describe('manual focus preserves automatic rules and saves', () => {
  it('outranks charging bosses, toggles off and clears immediately on death', () => {
    const s = fixture(), boss = createEnemy(s, 'B01', 90, 300), selected = createEnemy(s, 'E01', 280, 200);
    boss.chargeKind = 'boss'; boss.chargeUntil = s.tick + 60;
    expect(threat(s)[0]).toBe(boss);
    expect(command(s, { type: 'focus-target', targetId: selected.id })).toBe(true);
    expect(threat(s)[0]).toBe(selected);
    expect(s.actions.at(-1)?.command).toEqual({ type: 'focus-target', targetId: selected.id });
    command(s, { type: 'focus-target', targetId: null });
    expect(threat(s)[0]).toBe(boss);
    command(s, { type: 'focus-target', targetId: selected.id });
    hitEnemy(s, selected, { source: 'C01', skill: 'weapon', raw: 1e6, damageType: 'plasma', armorIgnore: 1, shieldMultiplier: 1 });
    expect(s.focusTargetId).toBeNull(); expect(threat(s)[0]).toBe(boss);
  });
  it('rejects unavailable targets and input during a pause', () => {
    const s = fixture(), e = createEnemy(s, 'E01', 200, 250);
    expect(command(s, { type: 'focus-target', targetId: -1 })).toBe(false);
    command(s, { type: 'pause', reason: 'user' });
    expect(command(s, { type: 'focus-target', targetId: e.id })).toBe(false);
    command(s, { type: 'resume', reason: 'user' }); e.hp = 0;
    expect(command(s, { type: 'focus-target', targetId: e.id })).toBe(false);
  });
  it.each([CONTENT_VERSION, PREVIOUS_TREE_VERSION, RANGE_CONTENT_VERSION, LEGACY_CONTENT_VERSION])('all five weapons, including sniper, aim at the focus in %s', version => {
    const s = fixture(version);
    createEnemy(s, 'B01', 50, 390);
    const target = createEnemy(s, 'E01', 290, 270); target.hp = target.maxHp = 10000;
    command(s, { type: 'focus-target', targetId: target.id });
    stepWeapons(s);
    for (const source of ['C01', 'C02', 'C03', 'C05']) expect(s.events.find(e => e.source === source && (e.kind === 'shot' || e.kind === 'beam'))).toMatchObject({ x2: target.x, y2: target.y });
    expect(s.events.find(e => e.source === 'C04' && e.kind === 'explosion')).toMatchObject({ x: target.x, y: target.y });
  });
  it('an out-of-range focus does not prevent nearer enemies being attacked', () => {
    const s = fixture(), far = createEnemy(s, 'E01', 195, 20), near = createEnemy(s, 'E03', 195, 350);
    command(s, { type: 'focus-target', targetId: far.id }); stepWeapons(s);
    expect(s.events.find(e => e.source === 'C02' && e.kind === 'beam')).toMatchObject({ x2: near.x, y2: near.y });
    expect(s.focusTargetId).toBe(far.id);
  });
  it('passes existing periodic criticals to presentation without adding extra damage', () => {
    const s = fixture();
    const node = deepTreesFor('C03', s).flatMap(t => t.nodes).find(n => n.mods.critEvery)!;
    const parents = (id: string): string[] => { const node = DEEP_NODE_MAP[id]; return [...(node.requires === 'any' ? node.parents.slice(0, 1) : node.parents).flatMap(parents), id]; };
    s.treeNodes = [...new Set(parents(node.id))];
    const enemy = createEnemy(s, 'E03', 195, 300); enemy.hp = enemy.maxHp = 100000;
    s.weapons.forEach(w => w.nextAttack = 999999);
    const sniper = s.weapons.find(w => w.id === 'C03')!;
    const hits: VisualEvent[] = [];
    for (let i = 0; i < node.mods.critEvery!; i++) {
      sniper.nextAttack = s.tick; stepWeapons(s);
      hits.push(s.events.filter(e => e.kind === 'hit' && e.source === 'C03').at(-1)!);
    }
    expect(hits.slice(0, -1).every(e => !e.critical)).toBe(true);
    expect(hits.at(-1)!.critical).toBe(true);
    expect(isCriticalHit(hits.at(-1)!)).toBe(true);
    expect(hits.at(-1)!.value!).toBeCloseTo(hits[0].value! * (1 + (node.mods.critPower ?? .5)));
  });
  it('restores old snapshots and persists a valid focus without changing RNG', () => {
    const s = fixture(), e = createEnemy(s, 'E01', 200, 250, 0, 1), rng = structuredClone(s.rng);
    expect(restoreRun(snapshotRun(s)).focusTargetId).toBeUndefined();
    command(s, { type: 'focus-target', targetId: e.id });
    expect(restoreRun(snapshotRun(s)).focusTargetId).toBe(e.id);
    expect(s.rng).toEqual(rng);
    s.focusTargetId = 999999;
    expect(restoreRun(snapshotRun(s)).focusTargetId).toBeNull();
  });
});

const hit = (targetId: number, value: number, extra: Partial<VisualEvent> = {}): VisualEvent => ({ seq: 1, tick: 1, kind: 'hit', skill: 'burn', x: 100, y: 200, targetId, value, ...extra });
describe('damage presentation windows', () => {
  it('merges sources per enemy for 300ms and never counts another enemy or repeats a flush', () => {
    const cache = new DamageAccumulator();
    expect(cache.update([hit(1, 2), hit(2, 7)], 0)).toEqual([]);
    expect(cache.update([hit(1, 3, { source: 'C05' })], 299)).toEqual([]);
    expect(cache.update([], 300).map(c => [c.targetId, c.total])).toEqual([[1, 5], [2, 7]]);
    expect(cache.update([], 600)).toEqual([]); expect(cache.size).toBe(0);
  });
  it('shows direct weakness/guard breaks immediately while keeping DOTs small', () => {
    const cache = new DamageAccumulator();
    const critical = hit(1, 20, { skill: 'weapon', weakness: true });
    expect(isCriticalHit(critical)).toBe(true);
    expect(isCriticalHit(hit(1, 2, { weakness: true }))).toBe(false);
    const cues = cache.update([critical, hit(1, 30, { skill: 'weapon', shieldBroken: true }), hit(1, 3)], 0);
    expect(cues).toMatchObject([{ total: 50, kind: 'critical' }]);
    expect(cache.update([], 300)).toMatchObject([{ total: 3, kind: 'dot' }]);
  });
});
