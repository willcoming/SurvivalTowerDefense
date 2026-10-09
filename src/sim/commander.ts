import { ticks, WORLD } from '../data/content';
import { emit } from './combat';
import type { Command, RunState } from './types';

// The world ends at Y=520 and the defense is at Y=450; intercept before the wall.
export const BARRIER_Y = WORLD.wallY - 50;
export const ORBITAL_RADIUS = 120;
export function castCommander(s: RunState, cmd: Extract<Command, { type: 'commander-skill' }>): boolean {
  if (s.config.challengeId === 'no-skill') return false;
  if (cmd.skill === 'barrier') {
    if (s.commanderTactical?.barrierUsedInWave) return false;
    s.commanderTactical ??= {};
    s.commanderTactical.barrierUsedInWave = true;
    s.barrierUntil = s.tick + ticks(3);
    emit(s, { kind: 'barrier-spawn', x: WORLD.width / 2, y: BARRIER_Y });
    return true;
  }
  if (cmd.skill !== 'orbital' || s.tick < (s.commanderTactical?.orbitalReadyAt ?? 0)
    || cmd.x !== undefined && !Number.isFinite(cmd.x) || cmd.y !== undefined && !Number.isFinite(cmd.y)) return false;
  const x = Math.max(20, Math.min(WORLD.width - 20, cmd.x ?? WORLD.width / 2));
  const y = Math.max(40, Math.min(WORLD.wallY - 40, cmd.y ?? 260));
  s.commanderTactical ??= {};
  s.commanderTactical.orbitalReadyAt = s.tick + ticks(30);
  s.scheduled.push({ at: s.tick + ticks(.6), x, y, radius: ORBITAL_RADIUS,
    packet: { source: s.config.captainId, skill: 'orbital', raw: 3000, damageType: 'plasma', armorIgnore: .5, shieldMultiplier: 2 },
    enemyDamage: 0, enemySource: null });
  emit(s, { kind: 'orbital-aim', x, y, radius: ORBITAL_RADIUS });
  return true;
}
