import type Phaser from 'phaser';
import { CHARACTER_MAP } from '../data/content';
import type { CharacterId, Field, Projectile, RunState, VisualEvent } from '../sim/types';
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
function muzzle(g: Graphics, from: Point, to: Point, color: number, alpha: number, heavy: boolean) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x), ux = Math.cos(angle), uy = Math.sin(angle);
  const length = heavy ? 38 : 25, width = heavy ? 11 : 7;
  glow(g, from.x, from.y, heavy ? 13 : 9, color, alpha);
  g.fillStyle(color, alpha * .9).fillTriangle(from.x - uy * width, from.y + ux * width, from.x + uy * width, from.y - ux * width, from.x + ux * length, from.y + uy * length);
  g.fillStyle(0xffffe7, alpha).fillTriangle(from.x - uy * width * .4, from.y + ux * width * .4, from.x + uy * width * .4, from.y - ux * width * .4, from.x + ux * length * .8, from.y + uy * length * .8);
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

export function drawField(g: Graphics, field: Field, tick: number, detail: Detail) {
  const { x, y, radius: r } = field, phase = tick / 22 + field.id;
  if (field.kind === 'gravity') {
    g.fillStyle(0x4de0c7, .08).fillCircle(x, y, r);
    g.lineStyle(3, 0x65f4da, .9).strokeCircle(x, y, r);
    g.lineStyle(1, 0xb1ffff, .5).strokeEllipse(x, y, r * 1.4, r * .72);
    polygon(g, x, y, r * .42, 6, 0xb2fff1, .7, phase, 1);
    g.fillStyle(0x092f37, .9).fillCircle(x, y, r * .17);
    if (detail === 'full') for (let i = 0; i < 6; i++) { const a = phase + i * TAU / 6; const rr = r * (.45 + .4 * ((tick / 40 + i / 6) % 1)); g.fillStyle(0xb2fff1, .7).fillCircle(x + Math.cos(a) * rr, y + Math.sin(a) * rr * .5, 2); }
  } else {
    g.fillStyle(0xff572c, .16).fillCircle(x, y, r);
    g.lineStyle(3, 0xffb761, .9).strokeCircle(x, y, r);
    for (let i = 0; i < (detail === 'full' ? 9 : 4); i++) {
      const a = i * 2.399, rr = r * Math.sqrt((i + 1) / 10), fx = x + Math.cos(a) * rr, fy = y + Math.sin(a) * rr;
      const h = 9 + (Math.sin(phase * 2 + i) + 1) * 6;
      g.fillStyle(0xff8a3a, .55).fillTriangle(fx - 4, fy, fx + 5, fy, fx + 2, fy - h);
      g.fillStyle(0xffe8a5, .8).fillTriangle(fx - 2, fy, fx + 2, fy, fx, fy - h * .55);
    }
  }
}

export function drawProjectile(g: Graphics, p: Projectile, run: RunState, origin: Origin, detail: Detail) {
  const id = p.packet?.source, from = origin(id, p.tx), w = run.weapons.find(w => w.id === id), evolved = w?.rank === 3;
  let x = p.x, y = p.y, trailX = x - p.vx * .014, trailY = y - p.vy * .014;
  if (p.impactAt) {
    const progress = Math.max(0, Math.min(1, 1 - (p.impactAt - run.tick) / 14));
    x = from.x + (p.tx - from.x) * progress; y = from.y + (p.ty - from.y) * progress - Math.sin(progress * Math.PI) * 55;
    trailX = x - (p.tx - from.x) * .10; trailY = y + 25;
  } else if (p.packet) {
    const remaining = (p.y - p.ty) / (490 - p.ty || 1);
    x += (from.x - 195) * remaining; y += (from.y - 490) * remaining;
    trailX = x - p.vx * .048; trailY = y - p.vy * .048;
  }
  const color = p.enemyDamage ? 0xff654e : id === 'C01' ? 0x76f6ff : colorOf(id);
  if(p.packet?.skill==='micro-missile'){
    line(g,[{x:trailX,y:trailY},{x,y}],0xffcf76,3,.9);polygon(g,x,y,6,3,0xfff3c8,1,Math.atan2(p.ty-from.y,p.tx-from.x));
    glow(g,x,y,8,0xffb65c,.4);
  } else if (id === 'C05') {
    const r = evolved && w?.branch === 'B' ? 11 : 7;
    glow(g, x, y, r * 1.5, 0xff9b36, .9);
    line(g, [{ x: trailX, y: trailY }, { x, y }], 0xff8246, r * 1.9, .85);
    g.fillStyle(0xffaa45, 1).fillCircle(x, y, r); g.fillStyle(0xfff4cb, 1).fillCircle(x - 1, y - 1, r * .45);
    if (evolved && w?.branch === 'B') polygon(g, x, y, r + 4, 6, 0xffdc93, .7, run.tick / 6);
    if (evolved && w?.branch === 'A') line(g, [{ x: trailX - 3, y: trailY + 9 }, { x, y }], 0xff6234, 2, .65);
  } else if (evolved && id === 'C01' && w?.branch === 'B') {
    laser(g, { x: x - p.vx * .032, y: y - p.vy * .032 }, { x, y }, 0xffbf82, 4.5, 1);
    polygon(g, x, y, 4, 4, 0xffefc6, .9, Math.atan2(p.vy, p.vx));
  } else {
    if (!p.enemyDamage) {
      line(g, [{ x: trailX, y: trailY }, { x, y }], color, 11, .22);
      line(g, [{ x: trailX, y: trailY }, { x, y }], color, 5, 1);
      line(g, [{ x: trailX, y: trailY }, { x, y }], 0xf5ffff, 2, 1);
    } else line(g, [{ x: trailX, y: trailY }, { x, y }], color, 4, .75);
    g.fillStyle(color, 1).fillCircle(x, y, p.enemyDamage ? 4.5 : 4);
    if (detail === 'full') g.fillStyle(0xffffff, .9).fillCircle(x, y, 1.2);
  }
}

export function drawEffect(g: Graphics, fx: ActiveEffect, now: number, detail: Detail, origin: Origin) {
  const e = fx.event, t = Math.max(0, Math.min(1, (now - fx.born) / fx.duration));
  // Hold the readable silhouette, then dissipate; no simulation or cooldown delay.
  const a = t < .28 ? 1 : Math.pow((1 - t) / .72, 1.25);
  const c = colorOf(e.source), compact = detail === 'compact', evolved = e.weaponRank === 3, branch = e.weaponBranch;
  const baseOrigin = origin(e.source,e.x2);
  const from = e.y === 490 ? {...baseOrigin,x:baseOrigin.x+(e.source==='C06'?e.x-195:0)} : { x: e.x, y: e.y }, to = { x: e.x2 ?? e.x, y: e.y2 ?? e.y };
  if (e.kind === 'shot') {
    const p = origin(e.source, e.x2);
    muzzle(g, p, to, e.source === 'C05' ? 0xffaa4a : 0x70f6ff, a, e.source === 'C05'); burst(g, p.x, p.y, (e.source === 'C05' ? 20 : 13) * (1 + t * .3), e.source === 'C01' ? 0x9bffff : c, a, compact ? 4 : 7);
    if(e.weaponTree==='C01-C')reticle(g,to.x,to.y,14+t*7,c,a);
    if (evolved && e.source === 'C01' && branch === 'A' && e.weaponTree!=='C01-C') for (let i = -1; i <= 1; i++) line(g, [p, { x: p.x + i * 12, y: p.y - 20 }], 0xb0ffff, 1.5, a);
  } else if (e.kind === 'beam' || e.kind === 'arc') {
    if (e.y === 490) muzzle(g, from, to, c, a, e.source === 'C03');
    glow(g, to.x, to.y, e.source === 'C03' ? 16 : 11, c, a);
    if (e.source === 'C02') {
      bolt(g, from, to, c, a, e.seq + t * 12, compact);
      if (evolved && branch === 'B') { polygon(g, to.x, to.y, 15 + t * 5, 4, c, a, Math.PI / 4); }
      if (evolved && branch === 'A') g.lineStyle(1.3, 0xe3d8ff, a).strokeCircle(to.x, to.y, 8 + t * 6);
    } else if (e.source === 'C03') {
      const width = e.skill === 'tactical' ? 10 : evolved && branch === 'B' ? 9 : evolved ? 7 : 5;
      laser(g, from, to, c, width, a);
      if (evolved && branch === 'A') {
        for (let i = 1; i <= 4; i++) polygon(g, from.x + (to.x - from.x) * i / 5, from.y + (to.y - from.y) * i / 5, 5, 4, 0xc9f7ff, a, Math.PI / 4);
      } else if (evolved && branch === 'B') reticle(g, to.x, to.y, 20 + t * 10, 0xcde9ff, a);
    } else if (e.source === 'C06') {
      laser(g, from, to, 0xffe3a2, evolved ? 5 : 3.6, a);
      const count = evolved && branch === 'A' ? 4 : 2;
      for (let i = 1; i <= count; i++) polygon(g, from.x + (to.x - from.x) * i / (count + 1), from.y + (to.y - from.y) * i / (count + 1), 4, 4, 0xaffff0, a, 0);
      if (evolved && branch === 'B') polygon(g, to.x, to.y, 10 + t * 5, 6, c, a);
    } else laser(g, from, to, c, 2, a);
  } else if (e.kind === 'explosion') {
    const radius = e.radius ?? 35, r = radius * (.2 + Math.sqrt(t) * .85);
    // The stationary outer edge is the actual damage radius; expanding sparks are decorative.
    const boundary = t < .65 ? 1 : (1 - t) / .35;
    g.fillStyle(c, .07 * boundary).fillCircle(e.x, e.y, radius);
    g.lineStyle(2.5, e.source === 'C05' ? 0xffd088 : c, .95 * boundary).strokeCircle(e.x, e.y, radius);
    glow(g, e.x, e.y, radius * (1 - t) * .55, e.source === 'C04' ? c : e.source === 'C02' ? c : 0xffa34a, a);
    if (e.source === 'C04') {
      const p = origin(e.source, e.x);
      muzzle(g, p, { x: e.x, y: e.y }, c, a * .8, false);
      g.fillStyle(0x57eec8, a * .12).fillEllipse(e.x, e.y, r * 2, r * 1.1);
      g.lineStyle(4, c, a).strokeEllipse(e.x, e.y, r * 2, r * 1.1);
      polygon(g, e.x, e.y, r * .6, 6, 0xb8ffeb, a, -t * 2);
      if (evolved && branch === 'B') for (let i = -1; i <= 1; i++) line(g, [{ x: e.x + i * 18 - 7, y: e.y + 12 - t * 30 }, { x: e.x + i * 18, y: e.y - t * 30 }, { x: e.x + i * 18 + 7, y: e.y + 12 - t * 30 }], 0xb7ffea, 2, a);
    } else if (e.source === 'C02') {
      polygon(g, e.x, e.y, r, 6, c, a, .2 + t); polygon(g, e.x, e.y, r * .7, 6, 0xe1d6ff, a, -t);
      if (!compact) for (let i = 0; i < 3; i++) bolt(g, { x: e.x - r, y: e.y + (i - 1) * r * .5 }, { x: e.x + r, y: e.y + (i - 1) * r * .5 }, c, a * .7, e.seq + i, true);
    } else {
      const supernova = e.source === 'C05' && evolved && branch === 'B';
      g.fillStyle(0xff8b31, a * .26).fillCircle(e.x, e.y, r * .8);
      g.fillStyle(0xffdc88, a * .8).fillCircle(e.x, e.y, radius * Math.max(0, .40 - t));
      if (e.source === 'C05') for (let i = 0; i < (compact ? 6 : 9); i++) {
        const angle = i * TAU / (compact ? 6 : 9) + e.seq, ux = Math.cos(angle), uy = Math.sin(angle);
        const reach = r * (1.05 + (i % 3) * .13), base = r * .42, width = 5 * (1 - t) + 2;
        g.fillStyle(i % 2 ? 0xffb642 : 0xffe4a1, a * .9).fillTriangle(e.x + ux * base - uy * width, e.y + uy * base + ux * width, e.x + ux * base + uy * width, e.y + uy * base - ux * width, e.x + ux * reach, e.y + uy * reach);
      }
      g.lineStyle(supernova ? 6 : 4, 0xffe6a0, a).strokeCircle(e.x, e.y, r);
      burst(g, e.x, e.y, r * 1.1, 0xff9c4a, a, compact ? 6 : supernova ? 16 : 10, e.seq);
      if (supernova) g.lineStyle(1.5, 0xfff4d0, a).strokeEllipse(e.x, e.y, r * 2.4, r * .5);
    }
  } else if (e.kind === 'hit') {
    const r = 11 + t * 17;
    const impact = e.skill === 'burn' ? .35 : 1;
    if (!compact) glow(g, e.x, e.y, (e.source === 'C03' ? 16 : 10) * (1 - t * .6), c, a * impact);
    if (e.source === 'C03') line(g, [{ x: e.x - r, y: e.y + r }, { x: e.x + r, y: e.y - r }], 0xecfbff, 4, a);
    else if (e.source === 'C04') polygon(g, e.x, e.y, r, 4, c, a, t * 2);
    else if (e.source === 'C06') polygon(g, e.x, e.y, r, 6, c, a);
    else burst(g, e.x, e.y, r, c, a * impact, compact ? 4 : 6, e.seq);
    if (!compact) burst(g, e.x, e.y, r * 1.4, 0xffffe6, a * .8 * impact, 3, e.seq + .5);
    if (e.skill === 'tactical' && e.source === 'C01') { laser(g, { x: e.x - 30, y: e.y - 90 }, { x: e.x, y: e.y }, 0xffc4a0, 3, a); }
  } else if (e.kind === 'death') {
    const boss = e.enemyDefId?.startsWith('B'), r = (boss ? 70 : 22) * (.2 + t);
    const color = e.enemyDefId === 'B02' ? 0x8aefff : e.enemyDefId === 'B03' ? 0xff8e60 : 0xfacda0;
    burst(g, e.x, e.y, r, color, a, compact ? 5 : boss ? 14 : 8, e.seq);
    if (boss) { g.lineStyle(2, color, a).strokeCircle(e.x, e.y, r); polygon(g, e.x, e.y, r * .75, e.enemyDefId === 'B01' ? 3 : 6, color, a, t); }
  } else if (e.kind === 'evolution') {
    const p = origin(e.source), x = p.x, y = 479;
    polygon(g, x, y, 24 + t * 28, 6, c, a, t * 2); burst(g, x, y, 35 + t * 25, c, a, compact ? 6 : 12);
  } else if (e.kind === 'shield') {
    for (let i = 0; i < 7; i++) polygon(g, 28 + i * 55, 437 - t * 8, 23, 6, 0x9ffff0, a, Math.PI / 6);
  } else if (e.kind === 'interrupt') {
    reticle(g, e.x, e.y, 12 + t * 20, 0xc4ffcf, a);
  } else if (e.kind === 'wall-hit') {
    g.fillStyle(0xff634f, a * .16).fillRect(0, 435, 390, 15);
  }
}
