import { describe, expect, it } from 'vitest';
import { CHARACTERS as ALL_CHARACTERS, COMMON_UPGRADES, ENEMIES, ENEMY_CODE, ENEMY_MAP, ROUTES, STAGES as ALL_STAGES, getCardInfo, ticks } from '../../src/data/content';
import { nextRandom, seedValue } from '../../src/sim/rng';

const CHARACTERS=ALL_CHARACTERS.slice(0,6), STAGES=ALL_STAGES.slice(0,3);
describe('D01–D03 · finite original content and references', () => {
  it('contains six adult characters, one dedicated weapon each, and exactly two three-node routes each', () => {
    expect(CHARACTERS).toHaveLength(6);
    expect(new Set(CHARACTERS.map(c => c.id)).size).toBe(6);
    expect(new Set(CHARACTERS.map(c => c.weaponName)).size).toBe(6);
    expect(ROUTES).toHaveLength(12);
    const nodeIds: string[] = [];
    for (const character of CHARACTERS) {
      expect(character.age).toBeGreaterThanOrEqual(18);
      expect(Number.isFinite(character.damage)).toBe(true);
      expect(character.damage).toBeGreaterThan(0);
      expect(character.interval).toBeGreaterThan(0);
      expect(character.cooldown).toBeGreaterThan(0);
      const routes = ROUTES.filter(r => r.ownerId === character.id);
      expect(routes.map(r => r.branch).sort()).toEqual(['A', 'B']);
      for (const route of routes) {
        expect(route.nodes).toHaveLength(3);
        for (const rank of [1, 2, 3]) {
          const nodeId = `${route.id}-${rank}`;
          nodeIds.push(nodeId);
          expect(getCardInfo(nodeId).ownerId).toBe(character.id);
          expect(getCardInfo(nodeId).rank).toBe(rank);
          expect(getCardInfo(nodeId).description.length).toBeGreaterThan(0);
        }
      }
    }
    expect(new Set(nodeIds).size).toBe(36);
    expect(COMMON_UPGRADES.map(c => c.id)).toEqual(['G01', 'G02', 'G03', 'G04', 'G05', 'G06']);
    expect(COMMON_UPGRADES.every(c => c.max === 2)).toBe(true);
  });

  it('defines all eight normal/elite enemies and three bosses with finite legal armor/intervals', () => {
    expect(ENEMIES.map(e => e.id).sort()).toEqual(['B01', 'B02', 'B03', 'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08']);
    for (const enemy of ENEMIES) {
      expect([enemy.hp, enemy.shield, enemy.armor, enemy.speed, enemy.damage, enemy.interval, enemy.radius].every(Number.isFinite)).toBe(true);
      expect(enemy.hp).toBeGreaterThan(0);
      expect(enemy.shield).toBeGreaterThanOrEqual(0);
      expect(enemy.armor).toBeGreaterThanOrEqual(0);
      expect(enemy.armor).toBeLessThanOrEqual(.7);
      expect(enemy.interval).toBeGreaterThan(0);
    }
  });

  it('has the specified three stages and exact per-wave population totals', () => {
    const expectedCounts = [[24, 28, 26, 32, 30, 35, 38, 36], [26, 30, 26, 30, 32, 35, 37, 44], [32, 34, 32, 35, 38, 41, 39, 54]];
    expect(STAGES.map(s => s.id)).toEqual(['S01', 'S02', 'S03']);
    expect(STAGES.map(s => s.hpMultiplier)).toEqual([1, 1.1, 1.2]);
    STAGES.forEach((stage, index) => {
      expect(stage.bossId).toBe(`B0${index + 1}`);
      expect(ENEMY_MAP[stage.bossId]).toBeDefined();
      expect(stage.waves).toHaveLength(8);
      const counts = stage.waves.map(recipe => recipe.split(' ').reduce((total, group) => {
        const match = /^([CRPSAMHD])(\d+)$/.exec(group);
        expect(match, recipe).not.toBeNull();
        expect(ENEMY_MAP[ENEMY_CODE[match![1]]]).toBeDefined();
        return total + Number(match![2]);
      }, 0));
      expect(counts).toEqual(expectedCounts[index]);
      expect(stage.intro.length).toBeGreaterThanOrEqual(3);
      expect(stage.outro.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('TIME03/TIME10/TIME11 · ticks and deterministic random streams', () => {
  it('ceil quantizes all duration initialization, including the documented eight-tick boss stun', () => {
    expect(ticks(.55)).toBe(17);
    expect(ticks(.45)).toBe(14);
    expect(ticks(.25)).toBe(8);
    expect(ticks(360)).toBe(10800);
    expect(ticks(480)).toBe(14400);
  });

  it('returns repeatable values in [0,1), including zero seed without a stuck zero stream', () => {
    const a = { draft: seedValue(0, 101) };
    const b = { draft: seedValue(0, 101) };
    const values = Array.from({ length: 100 }, () => nextRandom(a, 'draft'));
    expect(values).toEqual(Array.from({ length: 100 }, () => nextRandom(b, 'draft')));
    expect(values.every(v => v >= 0 && v < 1)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(90);
  });

  it('visual draws never advance draft or spawn streams', () => {
    const a = { draft: seedValue(101, 1), spawn: seedValue(101, 2), visual: seedValue(101, 3) };
    const b = { ...a };
    for (let i = 0; i < 200; i++) nextRandom(a, 'visual');
    expect(nextRandom(a, 'draft')).toBe(nextRandom(b, 'draft'));
    expect(nextRandom(a, 'spawn')).toBe(nextRandom(b, 'spawn'));
  });
});
