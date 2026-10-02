import type Phaser from 'phaser';
import { CHARACTER_MAP } from '../data/content';
import type { CharacterId } from '../sim/types';
import type { ActiveEffect } from './presentation';

type Graphics = Phaser.GameObjects.Graphics;
type Point = { x: number; y: number };
export type Origin = (id?: CharacterId, targetX?: number) => Point;
export const colorOf = (id?: CharacterId) => parseInt((id ? CHARACTER_MAP[id].color : '#76eddf').slice(1), 16);
const TAU = Math.PI * 2;
export function line(g: Graphics, points: Point[], color: number, width = 1, alpha = 1) {
  if (!points.length) return;
  g.lineStyle(width, color, alpha).beginPath().moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) g.lineTo(p.x, p.y);
  g.strokePath();
}
export function polygon(g: Graphics, x: number, y: number, r: number, sides: number, color: number, alpha = 1, angle = 0, width = 1.5) {
  const points = Array.from({ length: sides + 1 }, (_, i) => ({ x: x + Math.cos(i * TAU / sides + angle) * r, y: y + Math.sin(i * TAU / sides + angle) * r }));
  line(g, points, color, width, alpha);
}
export function burst(g: Graphics, x: number, y: number, r: number, color: number, alpha: number, count: number, angle = 0) {
  for (let i = 0; i < count; i++) {
    const a = i * TAU / count + angle;
    line(g, [{ x: x + Math.cos(a) * r * .45, y: y + Math.sin(a) * r * .45 }, { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r }], color, i % 2 ? 1 : 2, alpha);
  }
}
export function reticle(g: Graphics, x: number, y: number, radius: number, color: number, alpha: number) {
  g.lineStyle(1.5, color, alpha).strokeCircle(x, y, radius);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; line(g, [{ x: x + Math.cos(a) * radius * .65, y: y + Math.sin(a) * radius * .65 }, { x: x + Math.cos(a) * radius * 1.25, y: y + Math.sin(a) * radius * 1.25 }], color, 2, alpha); }
}
export function glow(g: Graphics, x: number, y: number, r: number, color: number, alpha: number) {
  g.fillStyle(color, alpha * .09).fillCircle(x, y, r * 1.65);
  g.fillStyle(color, alpha * .24).fillCircle(x, y, r);
  g.fillStyle(0xfffbe7, alpha * .9).fillCircle(x, y, r * .30);
}
export function laser(g: Graphics, from: Point, to: Point, color: number, width: number, alpha: number) {
  line(g, [from, to], color, width + 10, alpha * .18);
  line(g, [from, to], color, width, alpha);
  line(g, [from, to], 0xf3fff3, Math.max(1.6, width * .32), alpha);
}
export function bolt(g: Graphics, from: Point, to: Point, color: number, alpha: number, phase: number, compact: boolean) {
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
  const count = compact ? 5 : 8;
  const points = Array.from({ length: count + 1 }, (_, i) => {
    const bend = i === 0 || i === count ? 0 : Math.sin(i * 2.9 + phase) * 8;
    return { x: from.x + dx * i / count + dy / len * bend, y: from.y + dy * i / count - dx / len * bend };
  });
  line(g, points, color, 11, alpha * .16); line(g, points, color, 4.5, alpha); line(g, points, 0xf8f0ff, 1.6, alpha);
}

export function drawInterrupt(g: Graphics, fx: ActiveEffect, now: number) {
  const t = Math.max(0, Math.min(1, (now - fx.born) / fx.duration));
  const {x,y}=fx.event;
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2+.35,reach=8+t*16,px=x+Math.cos(a)*reach,py=y+Math.sin(a)*reach;
    g.fillStyle(0xc4ffcf,1-t).fillTriangle(px-3,py+3,px+3,py+3,px,py-5);
  }
}
