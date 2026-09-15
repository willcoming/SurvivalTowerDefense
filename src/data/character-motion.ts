import type { CharacterId } from '../sim/types';

/** Body height is normalized in the packer; the canvas leaves room for equipment. */
export const ALLY_MOTION = {
  frameWidth: 320, frameHeight: 320, frameCount: 12, columns: 4,
  originX: .5, originY: 300 / 320, displaySize: 105,
  poses: ['idle', 'ready', 'aim', 'fire', 'recoil', 'recover', 'skill-windup', 'skill-charge', 'skill-aim', 'skill-release', 'skill-followthrough', 'skill-recover'],
} as const;

// Total spread 4.1%; identical for both costumes. Units are normalized source pixels.
export const ALLY_BODY_HEIGHT: Record<CharacterId, number> = {
  C01: 200, C02: 202, C03: 204, C04: 196, C05: 203, C06: 200, C07: 202, C08: 201,
};

/** Weapon tips calibrated on the fire frame at the canonical 390 × 520 view. */
export const ALLY_ATTACKS: Record<CharacterId, { action: string; mountX: number; mountY: number }> = {
  C01: { action: 'carbine', mountX: 23, mountY: 467 },
  C02: { action: 'arc-emitter', mountX: 32, mountY: 474 },
  C03: { action: 'sniper', mountX: 35, mountY: 463 },
  C04: { action: 'gravity-projector', mountX: 32, mountY: 463 },
  C05: { action: 'mortar', mountX: 24, mountY: 444 },
  C06: { action: 'drone-command', mountX: -22, mountY: 441 },
  C07: { action: 'mine-launcher', mountX: 32, mountY: 463 },
  C08: { action: 'rotary-cannon', mountX: 32, mountY: 469 },
};

export const SUMMER_MOUNTS: Record<CharacterId, { mountX: number; mountY: number }> = {
  C01: { mountX: 23, mountY: 463 }, C02: { mountX: 28, mountY: 474 },
  C03: { mountX: 23, mountY: 471 }, C04: { mountX: 29, mountY: 469 },
  C05: { mountX: 32, mountY: 452 }, C06: { mountX: -22, mountY: 441 },
  C07: { mountX: 27, mountY: 475 }, C08: { mountX: 34, mountY: 470 },
};
