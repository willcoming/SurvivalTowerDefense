import { describe, expect, it } from 'vitest';
import { battleLevelCost, battlePointCapacity, battleXpAt, pacedExperienceProfile, steadyExperienceProfile, type ExperienceMode } from '../../src/data/battle-experience';
import { STAGES } from '../../src/data/content';
import { HUNDRED_PROFILE } from '../../src/data/hundred';
import { stageProfile, type OperationProfile } from '../../src/data/progression';
import type { CharacterId } from '../../src/sim/types';

const squad: CharacterId[] = ['C01', 'C02', 'C03', 'C04', 'C05'];
function pointGains(profile: OperationProfile, mode: ExperienceMode) {
  let xp = 0, previous = 0;
  return profile.waveXp.map(reward => {
    xp += reward;
    let points = previous;
    while (points < profile.points && xp >= battleXpAt(points + 2, mode)) points++;
    const gained = points - previous; previous = points; return gained;
  });
}

describe('steady version-4 experience pacing', () => {
  for (const stage of STAGES) for (const difficulty of ['easy', 'hard'] as const) {
    it(`${stage.id}/${difficulty}: advances evenly without changing the authored operation or budget`, () => {
      const base = stageProfile(stage.id, difficulty, { balanceVersion: 5 });
      const original = structuredClone(base);
      const profile = steadyExperienceProfile(base, 'campaign', battlePointCapacity({ squadIds: squad }));
      const gains = pointGains(profile, 'campaign');
      const rate = (profile.points - 1) / (profile.waves.length - 1);
      expect(gains[0]).toBe(1);
      expect(gains.slice(1).every(value => value >= Math.floor(rate) && value <= Math.ceil(rate))).toBe(true);
      expect(gains.reduce((a, b) => a + b, 0)).toBe(base.points);
      expect(profile.waveXp.reduce((a, b) => a + b, 0)).toBe(battleXpAt(base.points + 1));
      expect(profile.waveXp.every(value => Number.isSafeInteger(value) && value >= 0)).toBe(true);
      expect({ ...profile, waveXp: base.waveXp }).toEqual(base);
      expect(base).toEqual(original);
    });
  }

  it('funds the exact rising cost when a wave grants one point', () => {
    const base = stageProfile('S01', 'easy', { balanceVersion: 5 });
    const profile = steadyExperienceProfile(base, 'campaign', base.waves.length);
    expect(pointGains(profile, 'campaign')).toEqual(Array(base.waves.length).fill(1));
    expect(profile.waveXp).toEqual(base.waves.map((_, index) => battleLevelCost(index + 1)));
  });

  it('gives a full hundred-wave squad a point every one or two waves and the last point before its boss', () => {
    const profile = steadyExperienceProfile(HUNDRED_PROFILE, 'hundred', battlePointCapacity({ squadIds: squad }));
    const gains = pointGains(profile, 'hundred');
    const fundedWaves = gains.flatMap((gain, index) => gain > 0 ? [index + 1] : []);
    expect(gains.every(value => value === 0 || value === 1)).toBe(true);
    expect(fundedWaves).toHaveLength(60);
    expect(fundedWaves[0]).toBe(1);
    expect(fundedWaves.at(-1)).toBe(99);
    expect(fundedWaves.slice(1).every((wave, index) => wave - fundedWaves[index] <= 2)).toBe(true);
    expect(profile.waveXp[99]).toBe(0);
    expect(profile.waveXp.reduce((a, b) => a + b, 0)).toBe(battleXpAt(61, 'hundred'));
  });

  it('spreads a small roster budget as evenly as possible instead of inventing extra points', () => {
    const capacity = battlePointCapacity({ squadIds: ['C01'] });
    const profile = steadyExperienceProfile(HUNDRED_PROFILE, 'hundred', capacity);
    const gains = pointGains(profile, 'hundred');
    const fundedWaves = gains.flatMap((gain, index) => gain > 0 ? [index + 1] : []);
    expect(capacity).toBe(25);
    expect(fundedWaves).toHaveLength(capacity);
    expect(fundedWaves.at(-1)).toBe(99);
    expect(fundedWaves.slice(1).every((wave, index) => [4, 5].includes(wave - fundedWaves[index]))).toBe(true);
    expect(profile.waveXp.reduce((a, b) => a + b, 0)).toBe(battleXpAt(capacity + 1, 'hundred'));
  });

  it('handles zero, one and single-wave budgets without invalid XP', () => {
    const base = stageProfile('S01', 'easy', { balanceVersion: 5 });
    expect(steadyExperienceProfile(base, 'campaign', 0).waveXp).toEqual(Array(base.waves.length).fill(0));
    expect(steadyExperienceProfile(base, 'campaign', 1).waveXp).toEqual([30, ...Array(base.waves.length - 1).fill(0)]);
    const single = { ...base, waves: [base.waves[0]], waveXp: [base.waveXp[0]] };
    expect(steadyExperienceProfile(single, 'campaign').waveXp).toEqual([battleXpAt(base.points + 1)]);
  });

  it('keeps version-3 rewards intact and caches modes and capacities independently', () => {
    const base = stageProfile('S01', 'easy', { balanceVersion: 5 });
    const previous = pacedExperienceProfile(base, 'campaign');
    expect(pointGains(previous, 'campaign')).toEqual([1, 1, 2, 3, 2, 2, 2, 2, 2, 3]);
    expect(previous.waveXp).toEqual([30, 70, 96, 119, 143, 168, 193, 218, 243, 270]);
    const current = steadyExperienceProfile(base, 'campaign');
    expect(current).toBe(steadyExperienceProfile(base, 'campaign'));
    expect(current).not.toBe(previous);
    expect(steadyExperienceProfile(base, 'hundred')).not.toBe(current);
    expect(steadyExperienceProfile(base, 'campaign', 10)).not.toBe(current);
    expect(pacedExperienceProfile(base, 'campaign')).toBe(previous);
  });
});
