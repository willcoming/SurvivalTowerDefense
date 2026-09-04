import { describe, expect, it } from 'vitest';
import { ENEMIES, ENEMY_MAP } from '../../src/data/content';
import { command, createRun, restoreRun, snapshotRun } from '../../src/sim/engine';
import { createEnemy } from '../../src/sim/combat';
import { stepEnemies } from '../../src/sim/enemies';
import { advanceEnemyMotion, createEnemyMotion } from '../../src/game/enemy-motion';
import type { EnemyId } from '../../src/sim/types';

const state = () => createRun({ stageId: 'S03', squadIds: ['C06'], captainId: 'C06', seed: 101 });
describe('enemy movement presentation', () => {
  it.each(ENEMIES.map(e => e.id))('%s has six moving poses, idle, charge and a timed strike at 1× and 3×', id => {
    for (const speed of [1, 3]) {
      const s = state(), e = createEnemy(s, id, 195, 50), m = createEnemyMotion(e);
      const seen = new Set<number>();
      for (let elapsed = 0; elapsed < 1800; elapsed += 20) {
        advanceEnemyMotion(m, e, 100, 20, speed, true); seen.add(m.frame);
        expect(m.mode).toBe('move'); expect(m.fps).toBeLessThanOrEqual(14);
      }
      expect([...seen].sort()).toEqual([2, 3, 4, 5, 6, 7]);
      e.y = id.startsWith('B') ? 150 : id === 'E05' ? 250 : 450;
      seen.clear();
      for (let elapsed = 0; elapsed < 1000; elapsed += 50) { advanceEnemyMotion(m, e, 100, 50, speed, true); seen.add(m.frame); }
      expect(m.mode).toBe('idle'); expect([...seen].sort()).toEqual([0, 1]);
      e.chargeKind = id.startsWith('B') ? 'boss' : 'shot';
      const duration = id === 'B03' ? 90 : id.startsWith('B') ? 60 : 45;
      for (const remaining of [duration, duration * .7, 3]) {
        e.chargeUntil = 100 + remaining; advanceEnemyMotion(m, e, 100, 16, speed, true);
        expect(m.mode).toBe('charge'); expect([8, 10, 11]).toContain(m.frame);
      }
      e.chargeKind = null; e.lastAction = { tick: 101, kind: 'melee' };
      advanceEnemyMotion(m, e, 101, 16, speed, true);
      expect(m.mode).toBe('attack'); expect(m.frame).toBe(9); expect(m.releases).toBe(1);
      advanceEnemyMotion(m, e, 102, 100, speed, true); expect(m.frame).toBe(8);
    }
  });
  it('freezes pose and local time on pause/stun, with slowdown and a bounded fast gait', () => {
    const s = state(), e = createEnemy(s, 'E02', 100, 100), m = createEnemyMotion(e);
    advanceEnemyMotion(m, e, 10, 16, 3, true); const fast = m.fps;
    const paused = structuredClone(m); advanceEnemyMotion(m, e, 10, 400, 3, false); expect(m).toEqual(paused);
    e.effects.push({ id: 'test', kind: 'stun', source: 'C02', value: 1, expires: 100, nextTick: 0, armorIgnore: 0 });
    advanceEnemyMotion(m, e, 20, 300, 3, true);
    expect(m.mode).toBe('stunned'); expect(m.frame).toBe(paused.frame); expect(m.time).toBe(paused.time);
    e.effects = [{ id: 'slow', kind: 'slow', source: 'C04', value: .5, expires: 100, nextTick: 0, armorIgnore: 0 }];
    advanceEnemyMotion(m, e, 21, 16, 3, true); expect(m.fps).toBeLessThan(fast);
    const beforeGap = m.time; advanceEnemyMotion(m, e, 21, 1200, 3, true); expect(m.time).toBe(beforeGap);
  });
  it('uses real melee and cannon release ticks, and never releases a cancelled charge', () => {
    const s = state(); s.enemies = []; s.tick = 100;
    const melee = createEnemy(s, 'E03', 100, 450); melee.attackAt = 101;
    stepEnemies(s); expect(melee.lastAction).toBeUndefined(); expect(s.wallHp).toBe(1000);
    s.tick = 101; stepEnemies(s); expect(melee.lastAction).toEqual({ tick: 101, kind: 'melee' }); expect(s.wallHp).toBe(1000 - ENEMY_MAP.E03.damage);
    s.enemies = []; const cannon = createEnemy(s, 'E05', 100, 250); cannon.chargeKind = 'shot'; cannon.chargeUntil = 103;
    s.tick = 102; stepEnemies(s); expect(cannon.lastAction).toBeUndefined();
    s.tick = 103; stepEnemies(s); expect(cannon.lastAction).toEqual({ tick: 103, kind: 'shot' }); expect(s.projectiles.at(-1)?.enemySource).toBe('E05');
    const count = s.projectiles.length; cannon.chargeKind = 'shot'; cannon.chargeUntil = 104; cannon.chargeCancelled = true;
    s.tick = 104; stepEnemies(s); expect(cannon.lastAction?.tick).toBe(103); expect(s.projectiles).toHaveLength(count);
  });
  it('marks boss blasts, summons, shields, rushing and repair only at the real action', () => {
    for (const id of ['B01', 'B02', 'B03'] as EnemyId[]) {
      const s = state(); s.enemies = []; s.tick = 100;
      const e = createEnemy(s, id, 195, 150); e.chargeKind = 'boss'; e.chargeUntil = 100;
      stepEnemies(s); expect(e.lastAction).toEqual({ tick: 100, kind: id === 'B02' ? 'burst' : 'blast' });
      expect(s.wallHp).toBe(1000 - (id === 'B02' ? 25 : ENEMY_MAP[id].damage));
      e.summonAt = 101; s.tick = 101; stepEnemies(s); expect(e.lastAction?.kind).toBe(id === 'B02' ? 'shield' : 'summon');
    }
    const s = state(); s.enemies = []; s.tick = 100;
    const e = createEnemy(s, 'E08', 100, 100); e.chargeKind = 'rush'; e.chargeUntil = 100;
    stepEnemies(s); expect(e.lastAction?.kind).toBe('rush'); expect(e.rushUntil).toBe(160);
    const drone = createEnemy(s, 'E06', 110, 100); drone.abilityAt = 100;
    stepEnemies(s); expect(drone.lastAction).toBeUndefined();
    e.hp -= 50; const before = e.hp; drone.abilityAt = 101; s.tick = 101;
    stepEnemies(s); expect(drone.lastAction).toEqual({ tick: 101, kind: 'repair' }); expect(e.hp).toBe(before + e.maxHp * .05);
  });
  it('accepts old snapshots and consumes saved visual cues without replaying an attack', () => {
    const s = state(); s.enemies = [];
    const e = createEnemy(s, 'E01', 100, 100); s.tick = 100;
    command(s, { type: 'pause', reason: 'user' });
    const old = restoreRun(snapshotRun(s)); expect(old.enemies[0].lastAction).toBeUndefined();
    e.lastAction = { tick: 99, kind: 'melee' };
    const restored = restoreRun(snapshotRun(s)), m = createEnemyMotion(restored.enemies[0]);
    advanceEnemyMotion(m, restored.enemies[0], 100, 16, 3, true);
    expect(m.mode).toBe('move'); expect(m.releases).toBe(0);
    expect(restored.rng).toEqual(s.rng); expect(restored.wallHp).toBe(s.wallHp);
  });
});
