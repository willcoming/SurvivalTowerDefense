import { attackType, ELEMENTS, usesCollection } from '../data/forms';
import type Phaser from 'phaser';
import { CHARACTER_MAP } from '../data/content';
import type { CharacterId, Field, RunState } from '../sim/types';
import type { ActiveEffect, Detail } from './presentation';

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

export function drawField(g: Graphics, field: Field, tick: number, detail: Detail, run?:RunState) {
  const { x, y, radius: r } = field, phase = tick / 22 + field.id;
  const c=run&&usesCollection(run)?parseInt(ELEMENTS[attackType(run,field.source)].color.slice(1),16):undefined;
  if (field.kind === 'gravity') {
    g.fillStyle(c??0x4de0c7, .08).fillCircle(x, y, r);
    g.lineStyle(3, c??0x65f4da, .9).strokeCircle(x, y, r);
    g.lineStyle(1, 0xb1ffff, .5).strokeEllipse(x, y, r * 1.4, r * .72);
    polygon(g, x, y, r * .42, 6, 0xb2fff1, .7, phase, 1);
    g.fillStyle(0x092f37, .9).fillCircle(x, y, r * .17);
    if (detail === 'full') for (let i = 0; i < 6; i++) { const a = phase + i * TAU / 6; const rr = r * (.45 + .4 * ((tick / 40 + i / 6) % 1)); g.fillStyle(0xb2fff1, .7).fillCircle(x + Math.cos(a) * rr, y + Math.sin(a) * rr * .5, 2); }
  } else {
    g.fillStyle(c??0xff572c, .16).fillCircle(x, y, r);
    g.lineStyle(3, c??0xffb761, .9).strokeCircle(x, y, r);
    for (let i = 0; i < (detail === 'full' ? 9 : 4); i++) {
      const a = i * 2.399, rr = r * Math.sqrt((i + 1) / 10), fx = x + Math.cos(a) * rr, fy = y + Math.sin(a) * rr;
      const h = 9 + (Math.sin(phase * 2 + i) + 1) * 6;
      g.fillStyle(c??0xff8a3a, .55).fillTriangle(fx - 4, fy, fx + 5, fy, fx + 2, fy - h);
      g.fillStyle(0xffe8a5, .8).fillTriangle(fx - 2, fy, fx + 2, fy, fx, fy - h * .55);
    }
  }
}

export function drawInterrupt(g: Graphics, fx: ActiveEffect, now: number) {
  const t = Math.max(0, Math.min(1, (now - fx.born) / fx.duration));
  reticle(g, fx.event.x, fx.event.y, 12 + t * 20, 0xc4ffcf, 1 - t);
}
