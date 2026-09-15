import type { CharacterId } from '../sim/types';

export interface AttackMotion {
  fire: number;
  recoil: number;
  recover: number;
  aim: number;
  idle: number;
  kick: number;
}

/** Distinct weights and cadence, independent of the underlying weapon cooldown. */
export const ATTACK_MOTION: Record<CharacterId, AttackMotion> = {
  C01: { fire: 65, recoil: 65, recover: 95, aim: 140, idle: 640, kick: 1.5 },
  C02: { fire: 105, recoil: 80, recover: 115, aim: 240, idle: 760, kick: 1 },
  C03: { fire: 85, recoil: 140, recover: 210, aim: 380, idle: 1000, kick: 3.5 },
  C04: { fire: 150, recoil: 105, recover: 165, aim: 270, idle: 880, kick: .8 },
  C05: { fire: 100, recoil: 145, recover: 190, aim: 310, idle: 830, kick: 4 },
  C06: { fire: 90, recoil: 65, recover: 105, aim: 170, idle: 900, kick: .4 },
  C07: { fire: 100, recoil: 120, recover: 230, aim: 330, idle: 800, kick: 2 },
  C08: { fire: 45, recoil: 45, recover: 55, aim: 90, idle: 680, kick: 2.3 },
};

export function allyPose(id: CharacterId, now: number, firedAt: number, untilAttackTicks: number, speed: number, hasTarget: boolean, phaseOffset = 0, cooling = false) {
  const p = ATTACK_MOTION[id], age = now - firedAt;
  // Fit slow attacks to fast play while leaving each pose visible for at least two frames.
  const pace = Math.min(1.7, Math.max(1, speed));
  const fire = Math.max(40, p.fire / pace), recoil = Math.max(40, p.recoil / pace), recover = Math.max(40, p.recover / pace);
  if (age >= 0 && age < fire) return 3;
  if (age >= fire && age < fire + recoil) return 4;
  if (age >= fire + recoil && age < fire + recoil + recover) return 5;
  if (cooling) return Math.floor((now + phaseOffset) / 380) % 2 ? 5 : 0;
  if (hasTarget && untilAttackTicks / (30 * speed) * 1000 <= p.aim / pace) return 2;
  return Math.floor((now + phaseOffset) / p.idle) % 2;
}

export function tacticalPose(elapsedMs: number) {
  return elapsedMs < 200 ? 6 : elapsedMs < 460 ? 7 : elapsedMs < 650 ? 8 : elapsedMs < 870 ? 9 : elapsedMs < 1130 ? 10 : 11;
}
