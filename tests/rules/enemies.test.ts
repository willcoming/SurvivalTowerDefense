import { describe, expect, it } from 'vitest';
import { ENEMY_MAP, ticks, WORLD } from '../../src/data/content';
import { applyEffect, createEnemy, hitEnemy, knockback } from '../../src/sim/combat';
import { createRun, stepRun } from '../../src/sim/engine';
import { stepEnemies } from '../../src/sim/enemies';
import type { RunState } from '../../src/sim/types';

function isolated(stageId: 'S01' | 'S03' = 'S01') {
  const state = createRun({ stageId, squadIds: ['C01'], captainId: 'C01', seed: 101 });
  state.enemies = []; state.weapons = []; state.spawnPlan = []; state.spawnCursor = 0;
  return state;
}
function until(state: RunState, tick: number) {
  while (state.tick < tick) { state.tick++; stepEnemies(state); }
}

describe('EN01–07 · independent enemy cooldowns and interruptible phases', () => {
  it('contact waits nine ticks and leaving the wall starts a new contact delay', () => {
    const state = isolated(), enemy = createEnemy(state, 'E01', 195, WORLD.wallY);
    stepEnemies(state);
    expect(enemy.attackAt).toBe(9);
    until(state, 8); expect(state.wallHp).toBe(1000);
    until(state, 9); expect(state.wallHp).toBe(992);
    knockback(state, enemy, 20);
    expect(enemy.attackAt).toBe(0);
    enemy.y = WORLD.wallY; stepEnemies(state);
    expect(enemy.attackAt).toBe(18);
    until(state, 17); expect(state.wallHp).toBe(992);
    until(state, 18); expect(state.wallHp).toBe(984);
  });

  it('artillery waits eight seconds before its 1.5-second charge and fires a retained projectile', () => {
    const state = isolated(), enemy = createEnemy(state, 'E05', 195, 250);
    until(state, 239);
    expect(enemy.y).toBe(250); expect(enemy.chargeKind).toBeNull(); expect(state.projectiles).toHaveLength(0);
    until(state, 240); expect(enemy.chargeKind).toBe('shot'); expect(enemy.chargeUntil).toBe(285);
    until(state, 284); expect(state.projectiles).toHaveLength(0);
    until(state, 285);
    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0]).toMatchObject({ enemySource: 'E05', enemyDamage: 35, vy: 160, tx: 195, ty: 450 });
    enemy.hp = 0;
    until(state, 300); expect(state.projectiles).toHaveLength(1);
  });

  it('healer waits a full cooldown, repairs five percent and excludes bosses, dead and distant allies', () => {
    const state = isolated(), healer = createEnemy(state, 'E06', 195, 100);
    const target = createEnemy(state, 'E01', 195, 100); target.hp = 14;
    const healthy = createEnemy(state, 'E03', 205, 100); healthy.hp = healthy.maxHp - 2;
    const dead = createEnemy(state, 'E01', 195, 100); dead.hp = 0;
    const distant = createEnemy(state, 'E01', 370, 100); distant.hp = 1;
    const boss = createEnemy(state, 'B01', 195, 150); boss.hp = 1;
    for (const enemy of state.enemies) enemy.speed = 0;
    until(state, 239); expect(target.hp).toBe(14);
    until(state, 240);
    expect(target.hp).toBe(14 + target.maxHp * .05);
    expect(healthy.hp).toBe(healthy.maxHp - 2);
    expect(dead.hp).toBe(0); expect(distant.hp).toBe(1); expect(boss.hp).toBe(1);
    expect(healer.abilityAt).toBe(480); expect(state.xp).toBe(0);
  });

  it('an interrupted first-half-health rush cannot retry after another damage hit', () => {
    const state = isolated(), enemy = createEnemy(state, 'E08', 195, 100);
    hitEnemy(state, enemy, { source: 'C01', skill: 'fixture', raw: 210, damageType: 'plasma', armorIgnore: 1, shieldMultiplier: 1 });
    expect(enemy.chargeKind).toBe('rush'); expect(enemy.chargeUntil).toBe(36);
    state.tick = 1;
    applyEffect(state, enemy, { id: 'test-stun', kind: 'stun', source: 'C02', value: 1, expires: 4, nextTick: 0, armorIgnore: 0 });
    until(state, 36);
    expect(enemy.rushUntil).toBe(0); expect(enemy.chargeKind).toBeNull();
    hitEnemy(state, enemy, { source: 'C01', skill: 'fixture', raw: 1, damageType: 'plasma', armorIgnore: 1, shieldMultiplier: 1 });
    expect(enemy.chargeKind).toBeNull(); expect(enemy.phaseTriggered).toBe(true);
  });

  it('B01 uses complete initial timers, summons six zero-XP allies, and stops summoning after death', () => {
    const state = isolated(), boss = createEnemy(state, 'B01', 195, 150);
    until(state, 419); expect(boss.chargeKind).toBeNull();
    until(state, 420); expect(boss.chargeUntil).toBe(480);
    until(state, 479); expect(state.wallHp).toBe(1000);
    until(state, 480); expect(state.wallHp).toBe(930);
    until(state, 539); expect(state.enemies).toHaveLength(1);
    until(state, 540);
    const allies = state.enemies.filter(enemy => enemy.defId === 'E01');
    expect(allies).toHaveLength(6); expect(allies.every(enemy => enemy.xp === 0)).toBe(true);
    boss.hp = 0; until(state, 1080);
    expect(state.enemies.filter(enemy => enemy.defId === 'E01')).toHaveLength(6);
  });

  it('B02 schedules three shots nine ticks apart and restores shield only at the 20-second cooldown', () => {
    const state = isolated(), boss = createEnemy(state, 'B02', 195, 150);
    boss.shield = 1600;
    until(state, 359); expect(boss.chargeKind).toBeNull();
    until(state, 360); expect(boss.chargeUntil).toBe(420);
    until(state, 419); expect(state.wallHp).toBe(1000);
    stepRun(state); expect(state.tick).toBe(420); expect(state.wallHp).toBe(975);
    expect(state.scheduled.map(shot => [shot.at, shot.enemyDamage, shot.enemySource])).toEqual([[429, 25, 'B02'], [438, 25, 'B02']]);
    stepRun(state, 8); expect(state.wallHp).toBe(975);
    stepRun(state); expect(state.tick).toBe(429); expect(state.wallHp).toBe(950);
    stepRun(state, 8); expect(state.wallHp).toBe(950);
    stepRun(state); expect(state.tick).toBe(438); expect(state.wallHp).toBe(925);
    until(state, 599); expect(boss.shield).toBe(1600);
    until(state, 600); expect(boss.shield).toBe(1800);
    boss.shield = 100; until(state, 1200); expect(boss.shield).toBe(700);
  });

  it('B03 interrupted charge still exposes on schedule; summons alternate and only allies receive stage scaling', () => {
    const state = isolated('S03'), boss = createEnemy(state, 'B03', 195, 150);
    expect(boss.maxHp).toBe(13000);
    until(state, 149); expect(boss.chargeKind).toBeNull();
    until(state, 150); expect(boss.chargeUntil).toBe(240);
    until(state, 239);
    applyEffect(state, boss, { id: 'test-stun', kind: 'stun', source: 'C02', value: 1, expires: 269, nextTick: 0, armorIgnore: 0 });
    until(state, 240);
    expect(state.wallHp).toBe(1000); expect(boss.exposureUntil).toBe(420); expect(boss.abilityAt).toBe(690);
    until(state, ticks(24));
    expect(state.enemies.filter(enemy => enemy.defId === 'E02')).toHaveLength(4);
    until(state, ticks(48));
    expect(state.enemies.filter(enemy => enemy.defId === 'E03')).toHaveLength(2);
    const allies = state.enemies.filter(enemy => !enemy.defId.startsWith('B'));
    expect(allies.every(enemy => enemy.xp === 0 && enemy.maxHp === ENEMY_MAP[enemy.defId].hp * 1.2)).toBe(true);
  });
});
