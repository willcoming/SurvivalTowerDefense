import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { CONTENT_VERSION } from '../src/data/content';
import { createRun, stepRun } from '../src/sim/engine';
import { createEnemy } from '../src/sim/combat';

// Independent worst-density fixtures keep all 1,800 samples equally heavy.
// The clone is outside the timed section. This measures core CPU work, not renderer/GPU or real mobile hardware.
const fixture = createRun({ stageId: 'S03', squadIds: ['C01', 'C02', 'C04', 'C05', 'C06'], captainId: 'C02', seed: 101 });
fixture.tick = 1000;
fixture.enemies = [];
fixture.spawnCursor = fixture.spawnPlan.length;
fixture.bossSpawned = true;
for (let i = 0; i < 120; i++) {
  const e = createEnemy(fixture, i === 119 ? 'B03' : i % 2 ? 'E03' : 'E01', 30 + (i % 10) * 35, 40 + Math.floor(i / 10) * 32);
  e.hp = e.maxHp = 1_000_000;
  e.attackAt = 1000;
  if (i === 119) { e.chargeKind = 'boss'; e.chargeUntil = 1050; e.summonAt = 1000; }
}
fixture.weapons.slice(0, 3).forEach(w => { w.branch = 'A'; w.rank = 3; });
fixture.evolvedCount = 3;
for (let i = 0; i < 400; i++) fixture.projectiles.push({ id: fixture.nextEntityId++, x: 20 + i % 20 * 18, y: 30 + Math.floor(i / 20) * 21, tx: 195, ty: 20, vx: 0, vy: -700, expires: 1100, hitIds: [], remaining: 3, falloff: [1, .8, .8], radius: 4, blastRadius: 0, packet: { source: 'C01', skill: 'stress', raw: 24, damageType: 'plasma', armorIgnore: 0, shieldMultiplier: 1 }, enemyDamage: 0, enemySource: null, impactAt: 0 });
for (let i = 0; i < 12; i++) fixture.fields.push({ id: fixture.nextEntityId++, source: i % 2 ? 'C04' : 'C05', kind: i % 2 ? 'gravity' : 'fire', x: 65 + i % 3 * 120, y: 80 + Math.floor(i / 3) * 95, radius: 85, expires: 1100, nextTick: 1000, dps: 14, damageType: 'gravity', slow: .3, slowDuration: 20, pull: 18, burnDuration: 30, armorIgnore: 0 });
const samples: number[] = [];
for (let i = 0; i < 1850; i++) {
  const run = structuredClone(fixture);
  const start = performance.now();
  stepRun(run);
  const elapsed = performance.now() - start;
  if (run.tick !== 1001) throw new Error('Stress sample did not advance exactly one real simulation tick');
  if (i >= 50) samples.push(elapsed);
}
const sorted = [...samples].sort((a, b) => a - b);
const result = {
  contentVersion: CONTENT_VERSION, measuredAt: new Date().toISOString(), node: process.version, platform: process.platform, arch: process.arch,
  command: 'npx tsx scripts/benchmark-simulation.ts', samples: samples.length,
  fixture: { enemies: 120, projectiles: 400, fields: 12, evolvedWeapons: 3, bossSummonDue: true },
  p95ProcessingMs: sorted[Math.floor(sorted.length * .95)], maxProcessingMs: sorted.at(-1), meanProcessingMs: samples.reduce((a, b) => a + b, 0) / samples.length,
  budgetMs: 1000 / 30, passed: sorted[Math.floor(sorted.length * .95)] < 1000 / 30,
  limitation: 'Desktop Node CPU only; 1,800 reset-fixture live core steps. Clone cost excluded. Not continuous live browser frame time and not actual-phone evidence.',
};
const directory = `artifacts/validation/${CONTENT_VERSION}`;
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/simulation-pressure.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
