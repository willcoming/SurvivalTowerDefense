import type { Enemy, EnemyId } from '../sim/types';

export const ENEMY_POSES = ['idle-a', 'idle-b', 'move-1', 'move-2', 'move-3', 'move-4', 'move-5', 'move-6', 'anticipate', 'strike', 'charge-a', 'charge-b'] as const;
export const enemyFrameSize = (id: string) => id.startsWith('B') ? 224 : 160;
export const enemyTexture = (id: string) => `enemy-motion-${id}`;
export type EnemyMotionMode = 'idle' | 'move' | 'charge' | 'attack' | 'stunned';
const gaitFPS: Record<EnemyId, number> = { E01: 8, E02: 11, E03: 6, E04: 7, E05: 7, E06: 7, E07: 5.5, E08: 11, B01: 5, B02: 6, B03: 5.5 };
const cueKey = (e: Enemy) => e.lastAction ? `${e.lastAction.tick}:${e.lastAction.kind}` : '';
export interface EnemyMotion {
  mode: EnemyMotionMode; frame: number; time: number; movePhase: number; fps: number;
  cue: string; attackBorn: number; attackKind: NonNullable<Enemy['lastAction']>['kind'] | null;
  attackTick: number; releases: number;
}
export function createEnemyMotion(enemy: Enemy): EnemyMotion {
  // Consume a saved cue at construction: loading never fires an old attack again.
  return { mode: 'idle', frame: 0, time: enemy.id * 37 % 900, movePhase: enemy.id % 6,
    fps: 0, cue: cueKey(enemy), attackBorn: -Infinity, attackKind: null, attackTick: 0, releases: 0 };
}
export function advanceEnemyMotion(m: EnemyMotion, e: Enemy, tick: number, deltaMs: number, speed: number, active: boolean) {
  if (!active) return m;
  const elapsed = deltaMs > 500 ? 0 : Math.max(0, deltaMs);
  const freshCue = cueKey(e) !== m.cue;
  m.cue = cueKey(e);
  if (e.effects.some(f => f.kind === 'stun' && f.expires > tick)) {
    m.mode = 'stunned'; m.fps = 0; m.attackBorn = -Infinity; return m;
  }
  m.time += elapsed;
  if (freshCue && e.lastAction && e.lastAction.tick <= tick) {
    m.attackBorn = m.time; m.attackKind = e.lastAction.kind; m.attackTick = e.lastAction.tick; m.releases++;
  }
  const attackAge = m.time - m.attackBorn;
  const burst = m.attackKind === 'burst';
  if (attackAge < (burst ? Math.max(180, 700 / speed) : 180)) {
    m.mode = 'attack'; m.fps = 0;
    // B02's three cannon pulses occur at the original 0/.3/.6 simulation seconds.
    m.frame = burst ? (tick - m.attackTick) % 9 < 3 ? 9 : 8 : attackAge < 90 ? 9 : 8;
    return m;
  }
  const remaining = e.chargeUntil - tick;
  if (e.chargeKind && !e.chargeCancelled && remaining > 0) {
    const duration = e.chargeKind === 'boss' ? (e.defId === 'B03' ? 90 : 60) : e.chargeKind === 'shot' ? 45 : 36;
    const progress = Math.max(0, Math.min(1, 1 - remaining / duration));
    m.mode = 'charge'; m.fps = 0; m.frame = remaining <= 3 ? 8 : 10 + Math.floor(progress * 6) % 2;
    return m;
  }
  const preparation = e.attackAt - tick;
  if (!e.defId.startsWith('B') && e.y >= 450 && preparation > 0 && preparation <= 9) {
    m.mode = 'charge'; m.fps = 0; m.frame = preparation <= 3 ? 8 : preparation <= 6 ? 11 : 10;
    return m;
  }
  const moving = e.defId.startsWith('B') ? Math.abs(e.y - 150) > .01 : e.speed > 0 && e.y < (e.defId === 'E05' ? 250 : 450) && !e.chargeKind;
  if (moving) {
    const slow = Math.max(0, ...e.effects.filter(f => f.kind === 'slow' && f.expires > tick).map(f => f.value));
    const rush = e.rushUntil > tick ? 1.3 : 1;
    m.fps = Math.min(14, gaitFPS[e.defId] * Math.min(1.75, speed) * (1 - slow) * rush);
    m.movePhase = (m.movePhase + elapsed * m.fps / 1000) % 6;
    m.mode = 'move'; m.frame = 2 + Math.floor(m.movePhase);
  } else {
    m.fps = 2.2; m.mode = 'idle'; m.frame = Math.floor(m.time * m.fps / 1000) % 2;
  }
  return m;
}
