import type { CharacterId } from '../sim/types';

/** Shared production contract: every form supplies the same six real poses. */
export const ALLY_MOTION = {
  frameWidth: 256, frameHeight: 256, frameCount: 6,
  originX: .5, originY: 240 / 256, displaySize: 84,
  poses: ['idle', 'ready', 'aim', 'fire', 'recoil', 'recover'],
} as const;

/** Weapon mounts and action vocabulary apply to original and themed costumes. */
export const ALLY_ATTACKS: Record<CharacterId, { action: string; mountX: number; mountY: number }> = {
  C01: { action: 'carbine', mountX: 23, mountY: 462 },
  C02: { action: 'arc-emitter', mountX: 23, mountY: 462 },
  C03: { action: 'sniper', mountX: 29, mountY: 453 },
  C04: { action: 'gravity-projector', mountX: 23, mountY: 462 },
  C05: { action: 'mortar', mountX: 18, mountY: 453 },
  C06: { action: 'drone-command', mountX: 23, mountY: 462 },
  C07: { action: 'mine-launcher', mountX: 24, mountY: 461 },
  C08: { action: 'rotary-cannon', mountX: 26, mountY: 466 },
};
