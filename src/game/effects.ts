import type Phaser from 'phaser';
import { CHARACTER_MAP } from '../data/content';
import type { CharacterId, RunState, VisualEvent } from '../sim/types';
import { damageLabelAnchor, type ActiveEffect, type Detail } from './presentation';

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

export const isDot = (event: VisualEvent) => event.skill === 'burn' || event.skill === 'gravity-field';
export const isCriticalHit = (event: VisualEvent) => event.kind === 'hit' && !isDot(event) && !!(event.critical || event.weakness || event.shieldBroken) && (event.value ?? 0) > 0;
type DamageCue = { total: number; lastFlush: number; x: number; y: number; targetId?: number; kind: 'dot' | 'normal' | 'critical' };

/** A presentation clock window, independent of simulation speed, RNG and save data. */
export class DamageAccumulator {
  private pending = new Map<string, DamageCue>();
  update(events: VisualEvent[], now: number, flush = false): DamageCue[] {
    const immediate = new Map<string, DamageCue>();
    for (const event of events) {
      if (event.kind !== 'hit' || !Number.isFinite(event.value) || (event.value ?? 0) <= 0) continue;
      const kind = isDot(event) ? 'dot' : isCriticalHit(event) ? 'critical' : 'normal';
      const key = `${event.targetId ?? `${event.x}:${event.y}`}:${kind}`;
      const cache = kind === 'critical' ? immediate : this.pending;
      let cue = cache.get(key);
      if (!cue) {
        // Bounded even if a large catch-up batch arrives while the presentation is held.
        if (cache.size >= 128) continue;
        cue = { total: 0, lastFlush: now, x: event.x, y: event.y, targetId: event.targetId, kind };
        cache.set(key, cue);
      }
      cue.total += event.value!; cue.x = event.x; cue.y = event.y;
    }
    const flushed = [...immediate.values()];
    for (const [key, cue] of this.pending) if (flush || now - cue.lastFlush >= 300) {
      flushed.push(cue); this.pending.delete(key);
    }
    return flushed;
  }
  get size() { return this.pending.size; }
}

export class DamageNumbers {
  private accumulated = new DamageAccumulator();
  private labels: { text: Phaser.GameObjects.Text; cue: DamageCue; born: number; x: number; y: number }[] = [];
  constructor(private scene: Phaser.Scene) {}
  update(run: RunState, fresh: VisualEvent[], now: number, detail: Detail, reduced: boolean) {
    const limit = detail === 'compact' ? 10 : 24;
    for (const label of this.labels) if (now - label.born >= 400) label.text.setVisible(false);
    // A pause holds the visual clock; show the unfinished window instead of hiding its damage indefinitely.
    const cues = this.accumulated.update(fresh, now, run.phase !== 'running').sort((a, b) => Number(b.kind === 'critical') - Number(a.kind === 'critical'));
    for (const cue of cues) {
      let label = this.labels.slice(0, limit).find(l => !l.text.visible);
      if (!label && this.labels.length < limit) {
        label = { text: this.scene.add.text(0, 0, '').setOrigin(.5).setDepth(12), cue, born: now, x: cue.x, y: cue.y };
        this.labels.push(label);
      }
      if (!label && cue.kind === 'critical') label = this.labels.slice(0, limit).filter(l => l.cue.kind !== 'critical').sort((a, b) => a.born - b.born)[0];
      if (!label) continue;
      const target = run.enemies.find(e => e.id === cue.targetId && e.hp > 0);
      const anchor = damageLabelAnchor(target?.x ?? cue.x, target?.y ?? cue.y, this.labels.filter(l => l !== label && l.text.visible));
      Object.assign(label, { cue, born: now, ...anchor });
      const critical = cue.kind === 'critical';
      label.text.setStyle({ fontFamily: 'sans-serif', fontSize: critical ? '22px' : '12px', fontStyle: critical ? '900' : 'normal', color: critical ? '#ffde59' : '#f5e4ce', stroke: critical ? '#3a1a00' : '#142630', strokeThickness: critical ? 4 : 2 });
      label.text.setText(String(Number(cue.total.toFixed(1)))).setVisible(true);
    }
    const placed: Point[] = [];
    this.labels.forEach((label, index) => {
      if (index >= limit) label.text.setVisible(false);
      if (!label.text.visible) return;
      const target = run.enemies.find(e => e.id === label.cue.targetId && e.hp > 0);
      const death = fresh.find(e => e.kind === 'death' && e.targetId === label.cue.targetId);
      if (target || death) { label.cue.x = (target ?? death)!.x; label.cue.y = (target ?? death)!.y; }
      const anchor = damageLabelAnchor(label.cue.x, label.cue.y, placed);
      label.x = anchor.x; label.y = anchor.y; placed.push(anchor);
      const t = Math.min(1, (now - label.born) / 400), critical = label.cue.kind === 'critical';
      const scale = critical && !reduced ? 1 + .3 * Math.sin(Math.PI * Math.min(1, t / .45)) : 1;
      const lift = reduced ? 0 : critical ? 24 * (1 - (1 - t) ** 3) : 12 * t;
      label.text.setScale(scale, scale * this.scene.cameras.main.zoomX / this.scene.cameras.main.zoomY)
        .setPosition(label.x, label.y - lift).setAlpha((critical ? 1 : .65) * (t < .5 ? 1 : (1 - t) * 2));
    });
  }
  diagnostics() {
    const numbers = this.labels.filter(l => l.text.visible).map(l => ({ value: l.cue.total, text: l.text.text, kind: l.cue.kind, targetId: l.cue.targetId, born: l.born, hitX: l.cue.x, hitY: l.cue.y, x: l.text.x, y: l.text.y, fontSize: l.text.style.fontSize, scale: l.text.scaleX }));
    return { damageNumbers: numbers, burnNumbers: numbers.filter(n => n.kind === 'dot'), pendingDamage: this.accumulated.size, allocatedDamageLabels: this.labels.length };
  }
}
