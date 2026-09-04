import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS, LEGACY_CONTENT_VERSION, BOSS_INTRO_MS, STAGE_MAP } from '../../src/data/content';
import { advanceBossIntro, command, createRun, restoreRun, stepRun } from '../../src/sim/engine';
import { createEnemy } from '../../src/sim/combat';
import { inWeaponRange, WEAPON_RANGE } from '../../src/sim/range';
import { stepWeapons } from '../../src/sim/weapons';
import type { CharacterId, RunState, StageId } from '../../src/sim/types';
import { replayDigest, type RunReport } from '../simulation/runner';

function fixture(id: CharacterId = 'C02', stageId: StageId = 'S01') {
  const s = createRun({ stageId, squadIds: [id], captainId: id, seed: 101 });
  s.enemies = []; s.spawnCursor = s.spawnPlan.length;
  return s;
}
function durable(s: RunState, y: number, x = 195) {
  const e = createEnemy(s, 'E01', x, y, 0); e.hp = e.maxHp = 100000; e.speed = 0;
  return e;
}
function entrance(stage: StageId = 'S01') {
  const s = fixture('C02', stage); s.tick = 10799; s.tacticalReadyAt = 12000;
  stepRun(s); return s;
}

describe('Primary weapon ranges', () => {
  for (const id of CHARACTER_IDS) it(`${id}: collider boundary is inclusive; waiting consumes no attack or cooldown`, () => {
    const s = fixture(id), e = durable(s, 0);
    e.y = 490 - WEAPON_RANGE[id] - e.radius - .01;
    expect(inWeaponRange(s, id, e)).toBe(false);
    stepWeapons(s); expect(s.weapons[0].attacks).toBe(0); expect(s.weapons[0].nextAttack).toBe(0);
    e.y += .01; expect(inWeaponRange(s, id, e)).toBe(true);
    stepWeapons(s); expect(s.weapons[0].attacks).toBe(1); expect(s.weapons[0].nextAttack).toBeGreaterThan(0);
  });
  it('uses circle distance, not just vertical position', () => {
    const s = fixture(), e = durable(s, 160, 370);
    expect(inWeaponRange(s, 'C02', e)).toBe(false); e.x = 195;
    expect(inWeaponRange(s, 'C02', e)).toBe(true);
  });
  it('every weapon reaches all three stationary Bosses and artillery positions', () => {
    for (const id of CHARACTER_IDS) for (const stage of ['S01', 'S02', 'S03'] as const) {
      const s = fixture(id, stage), boss = createEnemy(s, STAGE_MAP[stage].bossId, 195, 150);
      expect(inWeaponRange(s, id, boss)).toBe(true);
      stepWeapons(s); expect(s.weapons[0].attacks).toBe(1);
      for (const x of [20, 370]) expect(inWeaponRange(s, id, createEnemy(s, 'E05', x, 250))).toBe(true);
    }
  });
  it('chain and splash extend from a legal primary target beyond its acquisition range', () => {
    for (const id of ['C02', 'C04'] as const) {
      const s = fixture(id), primary = durable(s, 170), secondary = durable(s, 135);
      expect(inWeaponRange(s, id, primary)).toBe(true); expect(inWeaponRange(s, id, secondary)).toBe(false);
      stepWeapons(s); expect(secondary.hp).toBeLessThan(secondary.maxHp);
      if (id === 'C04') expect(s.events.find(e => e.kind === 'explosion')!.affectedIds).toEqual([primary.id, secondary.id]);
    }
  });
  it('a penetrating bullet expires at its travel limit and cannot hit a remote secondary target', () => {
    const s = fixture('C01'); s.weapons[0].rank = 3; s.weapons[0].branch = 'B';
    const near = durable(s, 200), remote = durable(s, 25);
    stepWeapons(s); s.weapons[0].nextAttack = 90000;
    expect(s.projectiles[0].travelRemaining).toBe(410);
    stepRun(s, 30); expect(near.hp).toBeLessThan(near.maxHp); expect(remote.hp).toBe(remote.maxHp); expect(s.projectiles).toHaveLength(0);
  });
  it('legacy runs still fire at a remote target', () => {
    const s = fixture(); s.contentVersion = LEGACY_CONTENT_VERSION; durable(s, 20);
    stepWeapons(s); expect(s.weapons[0].attacks).toBe(1);
  });
});

describe('Boss entrance wall-clock and recovery', () => {
  for (const stage of ['S01', 'S02', 'S03'] as const) it(`${stage}: freezes the entire combat state for 1500 ms and resumes once`, () => {
    const s = entrance(stage); expect(s.bossIntro?.remainingMs).toBe(BOSS_INTRO_MS); expect(s.tick).toBe(10800);
    const frozen = structuredClone(s); stepRun(s, 100); expect(s).toEqual(frozen);
    for (let i = 0; i < 14; i++) { expect(advanceBossIntro(s, 100)).toBe(false); expect(s.tick).toBe(10800); }
    expect(s.tacticalReadyAt).toBe(12000); expect(s.enemies[0].hp).toBe(s.enemies[0].maxHp);
    expect(advanceBossIntro(s, 100)).toBe(true); expect(s.bossIntro).toBeUndefined(); expect(s.phase).toBe('running');
    expect(advanceBossIntro(s, 100)).toBe(false); stepRun(s); expect(s.tick).toBe(10801);
    expect(s.actions.filter(a => a.command.type === 'finish-boss-intro')).toHaveLength(1);
  });
  it('pause, hidden, upgrade and suspension gaps never consume entrance time; reload keeps the remainder', () => {
    const s = entrance(); advanceBossIntro(s, 350);
    for (const reason of ['user', 'hidden', 'orientation', 'error', 'tutorial'] as const) {
      command(s, { type: 'pause', reason }); const remaining = s.bossIntro!.remainingMs;
      advanceBossIntro(s, 400); expect(s.bossIntro!.remainingMs).toBe(remaining);
      expect(command(s, { type: 'finish-boss-intro' })).toBe(false);
      command(s, { type: 'resume', reason });
    }
    s.pauseReasons.push('upgrade'); advanceBossIntro(s, 400); s.pauseReasons.pop();
    for (const gap of [501, 10000, NaN, -1]) advanceBossIntro(s, gap);
    const restored = restoreRun(s); expect(restored.bossIntro!.remainingMs).toBe(1150);
    advanceBossIntro(restored, 500); advanceBossIntro(restored, 500); expect(advanceBossIntro(restored, 150)).toBe(true);
    expect(command(s, { type: 'resume', reason: 'boss-intro' })).toBe(false);
    expect(() => restoreRun({ ...s, bossIntro: { ...s.bossIntro, remainingMs: 1501 } })).toThrow();
    expect(() => restoreRun({ ...s, contentVersion: LEGACY_CONTENT_VERSION })).toThrow();
  });
});

describe('Pre-change save compatibility', () => {
  const baseline = JSON.parse(readFileSync(new URL('../../artifacts/validation/combat-readability/legacy-baseline.json', import.meta.url), 'utf8')) as { rows: { initial: RunState; report: RunReport }[] };
  for (const { initial, report } of baseline.rows) it(`${report.buildId}: replays the untouched cbb2128 command log to exactly the same state digest`, () => {
    const s = restoreRun(initial); let cursor = 0;
    while (!s.outcome && s.tick <= 14400) {
      while (report.commandLog[cursor]?.tick === s.tick) expect(command(s, report.commandLog[cursor++].command)).toBe(true);
      if (s.pauseReasons.length) throw new Error(`Legacy replay stuck at ${s.tick}`);
      stepRun(s);
    }
    expect(cursor).toBe(report.commandLog.length); expect(replayDigest(s)).toBe(report.finalDigest);
    expect(s.bossIntro).toBeUndefined();
  });
});
