import type { OperationProfile } from './progression';
import { distribute } from './tactical-encounters';

/** Expand short operations before authoring their tactical formations. No maximum. */
export function minimumWaveOperation(base: OperationProfile, minimum = 10): OperationProfile {
  if (!Number.isSafeInteger(minimum) || minimum < 10) throw new Error('至少需要 10 波');
  const count = Math.max(minimum, base.waves.length);
  if (count === base.waves.length) return base;
  const ratio = count / base.waves.length;
  const enemies = Math.round(base.enemies * ratio);
  const points = 2 * Math.round(base.points * ratio / 2);
  const sources = Array.from({ length: count }, (_, i) => Math.floor(i / ratio));
  const rosters = sources.map(i => base.waves[i].split(' ').map(token => ({ code: token[0], count: Number(token.slice(1)) })));
  const counts = distribute(enemies, rosters.map(roster => roster.reduce((n, unit) => n + unit.count, 0)));
  const waves = rosters.map((roster, i) => {
    const units = distribute(counts[i], roster.map(unit => unit.count));
    return roster.flatMap((unit, j) => units[j] ? [`${unit.code}${units[j]}`] : []).join(' ');
  });
  const waveXp = distribute(points * 30 - (base.escortXp ?? 0), sources.map(i => base.waveXp[i]));
  const bossAt = count * base.interval + 15;
  return { ...base, waves, waveXp, points, enemies, bossAt, deadline: bossAt + base.deadline - base.bossAt,
    waveNames: sources.map(i => base.waveNames?.[i] ?? '敵群推進'),
    waveHints: sources.map(i => base.waveHints?.[i] ?? ''),
    groupIntervals: sources.map(i => base.groupIntervals?.[i] ?? base.groupInterval),
    formations: undefined, waveKinds: undefined };
}
