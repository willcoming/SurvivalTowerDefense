import { describe, expect, it } from 'vitest';
import { CHARACTER_MAP, ticks } from '../../src/data/content';
import { createRun } from '../../src/sim/engine';
import { createEnemy } from '../../src/sim/combat';
import { applyUpgrade, stepWeapons, weaponStats } from '../../src/sim/weapons';
import type { CharacterId, RunState } from '../../src/sim/types';

function fixture(id: CharacterId, branch: 'A' | 'B', rank = 3) {
  const state = createRun({ stageId: 'S01', squadIds: [id], captainId: id, seed: 101 });
  state.enemies = []; const weapon = state.weapons[0]; weapon.branch = branch; weapon.rank = rank;
  return state;
}
function target(state: RunState, x = 195, y = 200) {
  const enemy = createEnemy(state, 'E01', x, y); enemy.hp = enemy.maxHp = 100000; return enemy;
}

describe('AC03/W01–W12 · twelve distinct evolution behaviors', () => {
  it('C01-A targets up to three distinct enemies and never triples fire into one target', () => {
    for (const count of [1, 2, 3, 4]) {
      const state = fixture('C01', 'A'); for (let i = 0; i < count; i++) target(state, 100 + i * 40);
      stepWeapons(state);
      expect(state.projectiles).toHaveLength(Math.min(3, count));
      expect(new Set(state.projectiles.map(p => `${p.tx},${p.ty}`)).size).toBe(Math.min(3, count));
      expect(state.projectiles[0].packet!.raw).toBeCloseTo(CHARACTER_MAP.C01.damage * .65 * 1.15);
    }
  });
  it('C01-B uses1/.8/.8 penetration,2xshield and correct replacement base', () => {
    const state = fixture('C01', 'B'); target(state); stepWeapons(state);
    const shot = state.projectiles[0];
    expect(shot.remaining).toBe(3); expect(shot.falloff).toEqual([1, .8, .8]);
    expect(shot.packet!.shieldMultiplier).toBe(2);
    expect(shot.packet!.raw).toBeCloseTo(CHARACTER_MAP.C01.damage * 1.8 * 1.2);
    expect(weaponStats(state, state.weapons[0]).interval).toBe(ticks(CHARACTER_MAP.C01.interval * 1.25));
  });
  it('C02-A has at most four unique chain jumps with multiplicative75% decay', () => {
    const state = fixture('C02', 'A');
    const enemies = Array.from({ length: 6 }, (_, i) => target(state, 150 + i * 10));
    stepWeapons(state);
    enemies.slice(0, 5).forEach((e, i) => expect(100000 - e.hp).toBeCloseTo(CHARACTER_MAP.C02.damage * (.75 ** i)));
    expect(enemies[5].hp).toBe(100000);
  });
  it('C02-B charges three main hits per target and bursts once without secondary recursion', () => {
    const state = fixture('C02', 'B'); const main = target(state, 195); const adjacent = target(state, 210);
    for (let n = 0; n < 3; n++) { state.tick = state.weapons[0].nextAttack; stepWeapons(state); }
    expect(main.arcCharges).toBe(0);
    expect(100000 - adjacent.hp).toBeCloseTo(70);
    expect(100000 - main.hp).toBeCloseTo(3 * CHARACTER_MAP.C02.damage * 1.2 + 70);
  });
  it('C03-A has six line hits with descending nonrecursive coefficients', () => {
    const state = fixture('C03', 'A'); const enemies = Array.from({ length: 7 }, (_, i) => target(state, 195, 200 + i * 20));
    stepWeapons(state);
    const nearFirst = [...enemies].reverse();
    nearFirst.slice(0, 6).forEach((e, i) => expect(100000 - e.hp).toBeCloseTo(CHARACTER_MAP.C03.damage * 1.15 * (1 - .1 * i)));
    expect(nearFirst[6].hp).toBe(100000);
  });
  it('C03-B cancels penetration and adds elite/Boss damage to existing damage bonuses once', () => {
    const state = fixture('C03', 'B'); const boss = createEnemy(state, 'B03', 195, 150); boss.armor = 0; const normal = target(state, 195, 300); normal.maxHp = 100;
    const before = boss.hp; stepWeapons(state);
    expect(before - boss.hp).toBeCloseTo(CHARACTER_MAP.C03.damage * 2.2 * 1.35);
    expect(normal.hp).toBe(100000);
  });
  it('C04-A replaces direct fire with one finite field whose duration does not grow withG06', () => {
    const state = fixture('C04', 'A'); state.commonRanks.G06 = 2; const enemy = target(state); stepWeapons(state);
    expect(enemy.hp).toBe(100000); expect(state.fields).toHaveLength(1);
    expect(state.fields[0].radius).toBeCloseTo(85 * 1.15);
    expect(state.fields[0].dps).toBe(14); expect(state.fields[0].expires).toBe(90);
    state.tick = state.weapons[0].nextAttack; stepWeapons(state);
    expect(state.fields).toHaveLength(1);
  });
  it('C04-B only knocks back on each fifth main attack', () => {
    const state = fixture('C04', 'B'); const enemy = target(state, 195, 300);
    for (let n = 0; n < 4; n++) { state.tick = state.weapons[0].nextAttack; stepWeapons(state); }
    expect(enemy.y).toBe(300);
    state.tick = state.weapons[0].nextAttack; stepWeapons(state);
    expect(enemy.y).toBe(230);
  });
  it('C05-A carries snapshot fire parameters and reduced explosion, whileB cancels new burns', () => {
    const a = fixture('C05', 'A'); target(a); stepWeapons(a);
    expect(a.projectiles[0].packet!.raw).toBeCloseTo(CHARACTER_MAP.C05.damage * .8);
    expect(a.projectiles[0].fire!.dps).toBe(10);
    expect(a.projectiles[0].fire!.duration).toBe(120);
    const b = fixture('C05', 'B'); target(b); stepWeapons(b);
    expect(b.projectiles[0].packet!.burn).toBeUndefined();
    expect(b.projectiles[0].fire).toBeUndefined();
    expect(b.projectiles[0].packet!.raw).toBeCloseTo(CHARACTER_MAP.C05.damage * 2.2 * 1.2);
    expect(b.projectiles[0].blastRadius).toBeCloseTo(48 * 1.4 * 1.15);
  });
  it('C06-A counts drones independently and keeps one20% exposure effect', () => {
    const state = fixture('C06', 'A'); const enemy = target(state);
    for (let n = 0; n < 4; n++) { state.tick = state.weapons[0].nextAttack; stepWeapons(state); }
    expect(state.weapons[0].droneAttacks).toEqual([4, 4]);
    expect(enemy.effects.filter(e => e.kind === 'exposure')).toHaveLength(1);
    expect(enemy.effects.find(e => e.kind === 'exposure')?.value).toBe(.2);
  });
  it('C06-B provides100shield for6seconds every15seconds and never heals', () => {
    const state = fixture('C06', 'B'); state.weapons[0].shieldAt = 450; state.wallHp = 500;
    state.tick = 449; stepWeapons(state); expect(state.shields).toHaveLength(0);
    state.tick = 450; stepWeapons(state);
    expect(state.shields[0].value).toBe(100); expect(state.shields[0].expires).toBe(630);
    expect(state.weapons[0].shieldAt).toBe(900); expect(state.wallHp).toBe(500);
  });
});

describe('DMG05–06/W15 · upgrade replacement and snapshots', () => {
  it('adds shared and local damage and scales remaining attack timer rather than granting a free attack', () => {
    const state = fixture('C01', 'A', 1); state.commonRanks.G01 = 2;
    expect(weaponStats(state, state.weapons[0]).damage).toBeCloseTo(CHARACTER_MAP.C01.damage * 1.31);
    state.weapons[0].nextAttack = 10;
    const oldInterval = weaponStats(state, state.weapons[0]).interval;
    applyUpgrade(state, 'C01-A-2');
    const newInterval = weaponStats(state, state.weapons[0]).interval;
    expect(state.weapons[0].nextAttack).toBe(Math.ceil(10 * newInterval / oldInterval));
    expect(state.weapons[0].attacks).toBe(0);
  });
  it('an existing projectile keeps old damage and burn after choosing a replacement evolution', () => {
    const state = fixture('C05', 'B', 2); target(state); stepWeapons(state);
    const oldProjectile = structuredClone(state.projectiles[0]);
    applyUpgrade(state, 'C05-B-3');
    expect(state.projectiles[0]).toEqual(oldProjectile);
    state.tick = state.weapons[0].nextAttack; stepWeapons(state);
    expect(state.projectiles[1].packet!.burn).toBeUndefined();
    expect(state.projectiles[0].packet!.burn).toBeDefined();
  });
});
