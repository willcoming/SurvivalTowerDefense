import { describe, expect, it } from 'vitest';
import { createRun } from '../../src/sim/engine';
import { addShield, applyEffect, area, computeDamage, createEnemy, hitEnemy, hitWall, knockback, stepEffects, threat } from '../../src/sim/combat';
import type { DamagePacket, Effect, RunState } from '../../src/sim/types';

const fixture = () => { const state = createRun({ stageId: 'S01', squadIds: ['C01', 'C02', 'C03', 'C04', 'C05'], captainId: 'C01', seed: 101 }); state.enemies = []; return state; };
const packet = (raw: number, overrides: Partial<DamagePacket> = {}): DamagePacket => ({ source: 'C01', skill: 'test', raw, damageType: 'plasma', armorIgnore: 0, shieldMultiplier: 1, ...overrides });
const effect = (kind: Effect['kind'], value: number, expires: number, id: string = kind): Effect => ({ id, kind, value, expires, source: 'C05', nextTick: 15, armorIgnore: 0 });

describe('DMG01–07 · shield overflow, armor and real damage statistics', () => {
  it('subtracts armor percentage points before ignoring remaining armor and applying exposure', () => {
    expect(computeDamage(100, 0, .55, .35, .25, 1, .2).hpDamage).toBeCloseTo(96.5625, 10);
    expect(computeDamage(100, 0, .2, .35, .25, 1, .9).hpDamage).toBe(125);
    expect(computeDamage(100, 0, .9).hpDamage).toBeCloseTo(30);
  });
  it('consumes raw damage used by shield before applying HP modifiers', () => {
    expect(computeDamage(100, 50, .5, 0, .2, 1.25)).toEqual({ shieldDamage: 50, hpDamage: 36 });
    expect(computeDamage(20, 100, .5, .35, .25, 1.25)).toEqual({ shieldDamage: 25, hpDamage: 0 });
  });
  it('uses strongest capped exposure and does not count overkill as actual HP damage', () => {
    const state = fixture();
    const enemy = createEnemy(state, 'E01', 195, 200);
    enemy.hp = 10;
    enemy.effects = [effect('exposure', .1, 90, 'one'), effect('exposure', .2, 90, 'two')];
    hitEnemy(state, enemy, packet(100));
    expect(enemy.hp).toBe(0);
    expect(state.stats.damageByCharacter.C01).toBe(10);
    expect(state.stats.kills).toBe(1);
    hitEnemy(state, enemy, packet(100));
    expect(state.stats.kills).toBe(1);
    expect(state.stats.damageByCharacter.C01).toBe(10);
  });
  it('records HP and shield damage separately and awards each enemy XP once', () => {
    const state = fixture();
    const enemy = createEnemy(state, 'E04', 195, 200, 40);
    hitEnemy(state, enemy, packet(1000));
    expect(state.stats.shieldDamageByCharacter.C01).toBe(300);
    expect(state.stats.damageByCharacter.C01).toBe(220);
    expect(state.xp).toBe(40);
    expect(state.choicesEarned).toBe(0);
    hitEnemy(state, enemy, packet(1000));
    expect(state.xp).toBe(40);
    const summoned = createEnemy(state, 'E01', 200, 200, 0);
    hitEnemy(state, summoned, packet(1000));
    expect(state.xp).toBe(40);
  });
});

describe('FX01–04 · caps and interruptions', () => {
  it('caps slow by target type and stun at eight quantized ticks with 180-tick immunity', () => {
    const state = fixture();
    const ordinary = createEnemy(state, 'E01', 100, 200);
    const boss = createEnemy(state, 'B03', 195, 150);
    applyEffect(state, ordinary, effect('slow', .9, 150));
    applyEffect(state, boss, effect('slow', .9, 150));
    expect(ordinary.effects[0].value).toBe(.6);
    expect(boss.effects[0].value).toBe(.2);
    boss.chargeKind = 'boss'; boss.chargeUntil = 60;
    applyEffect(state, boss, effect('stun', 1, 45, 'first-stun'));
    expect(boss.effects.find(e => e.kind === 'stun')?.expires).toBe(8);
    expect(boss.stunImmuneUntil).toBe(180);
    expect(boss.chargeCancelled).toBe(true);
    state.tick = 9; boss.chargeCancelled = false; boss.chargeUntil = 100;
    applyEffect(state, boss, effect('stun', 1, 60, 'second-stun'));
    expect(boss.effects.filter(e => e.kind === 'stun')).toHaveLength(1);
    expect(boss.chargeCancelled).toBe(false);
  });
  it('reduces boss knockback, prevents repeated movement and never moves past spawn boundary', () => {
    const state = fixture();
    const boss = createEnemy(state, 'B03', 195, 150);
    knockback(state, boss, 60);
    expect(boss.y).toBe(135);
    knockback(state, boss, 60);
    expect(boss.y).toBe(135);
    const normal = createEnemy(state, 'E01', 100, 30);
    normal.attackAt = 25;
    knockback(state, normal, 70);
    expect(normal.y).toBe(20);
    expect(normal.attackAt).toBe(0);
  });
  it('interrupting a charged attacker never deletes an already-fired projectile', () => {
    const state = fixture();
    const enemy = createEnemy(state, 'E05', 195, 250);
    enemy.chargeKind = 'shot'; enemy.chargeUntil = 30;
    // Directly isolate an already-fired enemy projectile from its source's next charge.
    state.projectiles.push({ id: 999, x: 195, y: 300, tx: 195, ty: 450, vx: 0, vy: 160, expires: 300, hitIds: [], remaining: 1, falloff: [1], radius: 4, blastRadius: 0, packet: null, enemyDamage: 35, enemySource: 'E05', impactAt: 0 });
    applyEffect(state, enemy, effect('stun', 1, 45));
    expect(enemy.chargeCancelled).toBe(true);
    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0].enemyDamage).toBe(35);
  });
});

describe('FX05–06 · independently expiring burns and refresh cadence', () => {
  function processUntil(state: RunState, until: number) {
    while (state.tick < until) { state.tick++; stepEffects(state); }
  }
  it('a weaker later burn does not extend or replace the stronger effect before it expires', () => {
    const state = fixture();
    const enemy = createEnemy(state, 'E03', 195, 200);
    enemy.armor = 0;
    applyEffect(state, enemy, effect('burn', 10, 90, 'strong'));
    processUntil(state, 15);
    applyEffect(state, enemy, { ...effect('burn', 4, 150, 'weak'), nextTick: 30 });
    processUntil(state, 90);
    const before = enemy.hp;
    expect(enemy.effects.some(f => f.id === 'strong')).toBe(false);
    expect(enemy.effects.some(f => f.id === 'weak')).toBe(true);
    processUntil(state, 105);
    expect(before - enemy.hp).toBeCloseTo(2);
  });
  it('refreshes cannot indefinitely postpone the next damage tick', () => {
    const state = fixture();
    const enemy = createEnemy(state, 'E03', 195, 200);
    enemy.armor = 0;
    const before = enemy.hp;
    for (let t = 0; t <= 60; t++) {
      state.tick = t;
      if (t % 10 === 0) applyEffect(state, enemy, { ...effect('burn', 8, t + 30, 'continuous-fire'), nextTick: t + 15 });
      stepEffects(state);
    }
    expect(before - enemy.hp).toBeCloseTo(16);
  });
  it('different character sources may burn simultaneously; same-source areas do not add DPS', () => {
    const state = fixture();
    const enemy = createEnemy(state, 'E03', 195, 200);
    enemy.armor = 0;
    applyEffect(state, enemy, effect('burn', 8, 60, 'fire-1'));
    applyEffect(state, enemy, effect('burn', 8, 60, 'fire-2'));
    applyEffect(state, enemy, { ...effect('burn', 6, 60, 'other-source'), source: 'C01' });
    const before = enemy.hp;
    state.tick = 15; stepEffects(state);
    expect(before - enemy.hp).toBeCloseTo(7);
  });
});

describe('FX08–09 · defense shields and enemy mechanisms', () => {
  it('refreshes the greater shield, caps total at300 and absorbs earliest expiry first', () => {
    const state = fixture();
    addShield(state, 'A', 220, 240);
    hitWall(state, 70, 'E01');
    addShield(state, 'A', 100, 240);
    expect(state.shields[0].value).toBe(150);
    addShield(state, 'A', 220, 240);
    addShield(state, 'B', 100, 180);
    expect(state.shields.reduce((n, s) => n + s.value, 0)).toBe(300);
    hitWall(state, 100, 'E01');
    expect(state.shields.find(s => s.source === 'B')?.value).toBe(0);
    expect(state.shields.find(s => s.source === 'A')?.value).toBe(200);
    expect(state.wallHp).toBe(1000);
    expect(state.stats.shieldAbsorbed).toBe(170);
  });
  it('expired shields cannot absorb and healing cannot erase real defense damage statistics', () => {
    const state = fixture();
    addShield(state, 'short', 220, 10);
    state.tick = 10;
    hitWall(state, 35, 'E05');
    expect(state.wallHp).toBe(965);
    expect(state.stats.wallDamageByEnemy.E05).toBe(35);
    state.wallHp += 100; state.wallMaxHp += 100;
    expect(state.stats.wallDamageByEnemy.E05).toBe(35);
  });
  it('boss shields break once per positive-to-zero transition and first-half-health shields occur only once', () => {
    const state = fixture();
    const b02 = createEnemy(state, 'B02', 195, 150);
    b02.shield = 50; b02.chargeKind = 'boss'; b02.chargeUntil = 60;
    hitEnemy(state, b02, packet(50));
    expect(b02.chargeCancelled).toBe(true);
    expect(b02.exposureUntil).toBe(180);
    state.tick = 30; hitEnemy(state, b02, packet(1));
    expect(b02.exposureUntil).toBe(180);
    const elite = createEnemy(state, 'E07', 100, 200);
    hitEnemy(state, elite, packet(501, { armorIgnore: 1 }));
    expect(elite.shield).toBe(300);
    hitEnemy(state, elite, packet(301, { armorIgnore: 1 }));
    expect(elite.shield).toBe(0);
    expect(elite.phaseTriggered).toBe(true);
  });
});

describe('EN08/W14 · targeting and bounded area ordering', () => {
  it('prioritizes charging boss, charging artillery, wall contact then y and entityId', () => {
    const state = fixture();
    const wall = createEnemy(state, 'E01', 100, 450);
    const artillery = createEnemy(state, 'E05', 195, 250); artillery.chargeKind = 'shot'; artillery.chargeUntil = 45;
    const boss = createEnemy(state, 'B03', 195, 150); boss.chargeKind = 'boss'; boss.chargeUntil = 90;
    const back = createEnemy(state, 'E01', 100, 200);
    expect(threat(state).map(e => e.id)).toEqual([boss.id, artillery.id, wall.id, back.id]);
  });
  it('selects nearest twenty area targets, not the most advanced twenty', () => {
    const state = fixture();
    const near = createEnemy(state, 'E01', 195, 200);
    for (let i = 0; i < 20; i++) createEnemy(state, 'E01', 195, 220 + i);
    const result = area(state, 195, 200, 100);
    expect(result).toHaveLength(20);
    expect(result[0].id).toBe(near.id);
    expect(result.some(e => e.y === 239)).toBe(false);
  });
});
