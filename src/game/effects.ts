import type Phaser from 'phaser';
import { CHARACTER_MAP } from '../data/content';
import type { CharacterId, RunState, VisualEvent } from '../sim/types';
import { damageLabelAnchor, type ActiveEffect, type Detail } from './presentation';

type Graphics = Phaser.GameObjects.Graphics;
type Point = { x: number; y: number };
export type Origin = (id?: CharacterId, targetX?: number) => Point;
export const colorOf = (id?: CharacterId) => parseInt((id ? CHARACTER_MAP[id].color : '#76eddf').slice(1), 16);
export function drawInterrupt(g: Graphics, fx: ActiveEffect, now: number) {
  const t = Math.max(0, Math.min(1, (now - fx.born) / fx.duration));
  const {x,y}=fx.event;
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2+.35,reach=8+t*16,px=x+Math.cos(a)*reach,py=y+Math.sin(a)*reach;
    g.fillStyle(0xc4ffcf,1-t).fillTriangle(px-3,py+3,px+3,py+3,px,py-5);
  }
}

export const isDot = (event: VisualEvent) => event.skill === 'burn' || event.skill === 'combo-burn' || event.skill === 'gravity-field';
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
