import type { CharacterId, VisualEvent } from '../sim/types';
import { visualPriority } from '../sim/visual';

export const POSE_NAMES = ['idle', 'ready', 'aim', 'fire', 'recoil', 'recover'] as const;
export const CUTIN_MS = 1200;
export const SKILL_FX_MS = 1500;
export const LAYERS = { actors: 3, world: 5, effects: 9, allies: 7, cutin: 20, warnings: 90, warningText: 100 } as const;

/** Wall-clock poses retain readable fire/recoil frames even when simulation runs at 3×. */
export function poseFrame(now: number, firedAt: number, untilAttackTicks: number, speed: number, hasTarget: boolean, phaseOffset = 0) {
  const age = now - firedAt;
  if (age >= 0 && age < 40) return 3;
  if (age >= 40 && age < 80) return 4;
  if (age >= 80 && age < 120) return 5;
  if (hasTarget && untilAttackTicks / (30 * speed) <= .12) return 2;
  return Math.floor((now + phaseOffset) / 480) % 2;
}

export type Detail = 'full' | 'compact';
export function effectDetail(reduced: boolean, enemies: number, projectiles: number, slowFrames: number): Detail {
  return reduced || enemies >= 65 || projectiles >= 100 || slowFrames >= 8 ? 'compact' : 'full';
}
export function importantEffect(event: VisualEvent) {
  return visualPriority(event) === 3;
}
export function effectLifetime(event: VisualEvent) {
  if (event.kind === 'tactical') return SKILL_FX_MS;
  if (event.kind === 'evolution') return 600;
  if (event.kind === 'death') return event.enemyDefId?.startsWith('B') ? 650 : 360;
  if (event.kind === 'explosion') return event.source === 'C05' ? 460 : 380;
  if (event.kind === 'shield') return 300;
  if (event.kind === 'hit') return 260;
  if (event.kind === 'beam' || event.kind === 'arc') return 300;
  return 220;
}
export interface ActiveEffect { event: VisualEvent; born: number; duration: number }
export function capEffects(effects: ActiveEffect[], detail: Detail): ActiveEffect[] {
  const critical = effects.filter(f => importantEffect(f.event)).slice(-12);
  // Reserve up to six recent primary cues per weapon (including all chain links).
  // Heavy hit batches must not erase another squad member's visible attack.
  const counts = new Map<CharacterId | undefined, number>();
  const primary = effects.filter(f => visualPriority(f.event) === 2).reverse().filter(f => {
    const n = (counts.get(f.event.source) ?? 0) + 1; counts.set(f.event.source, n); return n <= 6;
  }).reverse();
  const normal = effects.filter(f => visualPriority(f.event) < 2).slice(-(detail === 'compact' ? 22 : 64));
  return [...normal, ...primary, ...critical];
}
export function weaponForm(id: CharacterId, rank: number, branch: string | null) { return rank === 3 ? `${id}-${branch}` : `${id}-base`; }
