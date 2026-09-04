import type Phaser from 'phaser';
import type { CharacterId, RunState } from '../sim/types';
import { FIRING_ORIGIN, inWeaponRange, weaponRange } from '../sim/range';
import { colorOf, line } from './effects';

export function drawRange(g: Phaser.GameObjects.Graphics, run: RunState, id: CharacterId | null) {
  g.clear(); if (!id) return;
  const r = weaponRange(run, id); if (!Number.isFinite(r)) return;
  const color = colorOf(id), points = [];
  // Clip the upper arc to the visible battlefield; the filled area reaches the shared firing line.
  for (let x = 0; x <= 390; x += 5) points.push({ x, y: Math.max(0, FIRING_ORIGIN.y - Math.sqrt(Math.max(0, r * r - (x - FIRING_ORIGIN.x) ** 2))) });
  g.fillStyle(color, .055).beginPath().moveTo(0, 490);
  points.forEach(p => g.lineTo(p.x, p.y)); g.lineTo(390, 490).closePath().fillPath();
  line(g, points, color, 2.5, .85);
  for (const enemy of run.enemies) if (inWeaponRange(run, id, enemy)) g.lineStyle(1.5, color, .75).strokeCircle(enemy.x, enemy.y, enemy.radius);
}
