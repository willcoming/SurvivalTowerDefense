import type Phaser from 'phaser';
import { AMMO_FRAMES } from './projectile-visuals';
import { attackType } from '../data/forms';
import { visualPriority } from '../sim/visual';
import type { DamageType, RunState } from '../sim/types';
import { treeMods, ultimateFor } from '../sim/skill-tree';
import { usesFreeSkills } from '../data/deep-trees';
import { usesSkillTrees } from '../data/skill-trees';
import type { Origin } from './effects';
import { LAYERS, type ActiveEffect, type Detail } from './presentation';

export const MATERIAL_ATLAS = '/assets/vfx/combat-fx-v2.webp';
export const PROP_ATLAS = '/assets/vfx/combat-props-v2.webp';
export const EFFECT_FRAME_SIZE = 256;
const rows: Record<DamageType, number> = { plasma: 0, thermal: 1, arc: 2, gravity: 3, kinetic: 0 };

/** Pooled textured quads: no per-frame texture generation or transient game objects. */
export class MaterialEffects {
  private sprites: Phaser.GameObjects.Image[] = [];
  private used = 0;
  private peak = 0;
  private counts: Record<string, number> = {};
  private aspect = 1;
  private limit = 144;
  constructor(private scene: Phaser.Scene) {}

  private draw(key: string, frame: number, x: number, y: number, size: number, alpha = 1, angle = 0, width = size, depth = LAYERS.effects + .5) {
    if (this.used >= this.limit) return;
    let sprite = this.sprites[this.used++];
    if (!sprite) { sprite = this.scene.add.image(x, y, key, frame); this.sprites.push(sprite); }
    if (sprite.texture.key !== key || Number(sprite.frame.name) !== frame) sprite.setTexture(key, frame);
    sprite.setVisible(true).setPosition(x, y).setDisplaySize(width, size * this.aspect).setAlpha(alpha).setAngle(angle).setDepth(depth);
    this.counts[key] = (this.counts[key] ?? 0) + 1;
  }
  private impact(type: DamageType, phase: number, x: number, y: number, size: number, alpha = 1) {
    this.draw(type === 'kinetic' ? 'combat-props' : 'combat-fx', type === 'kinetic' ? 12 + phase : rows[type] * 4 + phase, x, y, size, alpha);
  }

  update(run: RunState, effects: ActiveEffect[], now: number, detail: Detail, origin: Origin) {
    this.used = 0; this.counts = {};
    this.aspect = this.scene.cameras.main.zoomX / this.scene.cameras.main.zoomY;
    this.limit = detail === 'compact' ? 88 : 144;
    // Real deployed equipment stays intact in compact mode.
    for (const mine of run.mines ?? []) this.draw('combat-props', 2, mine.x, mine.y, 24, 1, 0, 24, LAYERS.world + .5);
    for (const weapon of run.weapons) {
      const p = origin(weapon.id);
      if (weapon.id === 'C06') {
        const mods = treeMods(run, weapon.id), tree = ultimateFor(run, weapon.id)?.split(/[:/]/)[0];
        const count = usesFreeSkills(run) ? Math.min(5, 1 + (mods.drones ?? 0)) : usesSkillTrees(run) ? (mods.drones || tree === 'C06-A' ? 2 : 1) : weapon.rank === 3 && weapon.branch === 'A' ? 2 : 1;
        for (let i = 0; i < count; i++) this.draw('combat-props', 0, p.x + i * 23, p.y + Math.sin(now / 380 + i) * 3, 27, 1, 0, 27, LAYERS.allies + 1);
      }
      if (weapon.id === 'C08' && weapon.cooling && detail === 'full') this.draw('combat-props', 5, p.x, p.y - 15 - now % 550 / 35, 29, .4, 0);
    }
    const ordered = [...effects].sort((a, b) => visualPriority(b.event) - visualPriority(a.event));
    let smallImpacts = 0;
    for (const fx of ordered) {
      const e = fx.event, t = Math.max(0, Math.min(1, (now - fx.born) / fx.duration));
      const phase = Math.min(3, Math.floor(t * 4)), alpha = t < .7 ? 1 : (1 - t) / .3;
      const type = e.damageType ?? (e.source ? attackType(run, e.source) : 'thermal');
      const evolved = e.weaponRank === 3, size = evolved ? 1.3 : 1;
      if (e.kind === 'explosion' || e.kind === 'tactical') {
        if (e.kind === 'tactical' && e.source === 'C06') {
          this.draw('combat-props', 8 + phase, 195, 365, 160, alpha * .85, 0, 330);
        } else {
          this.impact(type, phase, e.x, e.y, Math.min(220, (e.radius ?? 55) * 2), alpha);
        }
      } else if (e.kind === 'shot') {
        const p = origin(e.source, e.x2), to = { x: e.x2 ?? e.x, y: e.y2 ?? e.y };
        if (e.skill === 'mine-deploy') {
          const progress = Math.min(1, t / .8);
          this.draw('combat-props', 2, p.x + (to.x - p.x) * progress, p.y + (to.y - p.y) * progress - Math.sin(progress * Math.PI) * 36, 23, alpha, progress * 150);
        } else {
          const angle = Math.atan2(to.y - p.y, to.x - p.x) * 180 / Math.PI;
          this.draw('combat-ammo', type === 'arc' ? 13 : type === 'gravity' ? 15 : type === 'kinetic' ? 14 : 12, p.x, p.y, (e.source === 'C05' ? 30 : 22) * size, alpha, angle);
        }
      } else if (e.kind === 'beam' || e.kind === 'arc') {
        const base = origin(e.source, e.x2);
        const p = e.y === 490 ? { x: base.x + (e.source === 'C06' ? e.x - 195 : 0), y: base.y } : e;
        const to = { x: e.x2 ?? e.x, y: e.y2 ?? e.y };
        const progress = Math.min(1, t / .55), angle = Math.atan2(to.y - p.y, to.x - p.x) * 180 / Math.PI;
        // Hitscan damage is unchanged; its short flight cue is a finite illustrated object.
        if (progress < 1) this.draw('combat-ammo', e.kind === 'arc' || e.source === 'C02' ? 8 + phase : AMMO_FRAMES[e.source ?? 'C03'], p.x + (to.x - p.x) * progress, p.y + (to.y - p.y) * progress, (e.source === 'C02' ? 38 : e.source === 'C03' ? 32 : 23) * size, 1, angle);
        this.impact(type, phase, to.x, to.y, (e.source === 'C03' ? 48 : 34) * size, alpha);
      } else if (e.kind === 'hit' && e.skill !== 'burn') {
        if (detail === 'compact' && smallImpacts++ >= 8) continue;
        this.impact(type, phase, e.x, e.y, (e.source === 'C03' ? 43 : 28) * size, alpha * .9);
      } else if (e.kind === 'death') {
        this.draw('combat-props', t < .4 ? 6 : 5, e.x, e.y - t * 9, e.enemyDefId?.startsWith('B') ? 106 : 33, alpha * .8, 0);
      } else if (e.kind === 'shield') {
        this.draw('combat-props', 8 + phase, 195, 421, 48, alpha, 0, 330);
      } else if (e.kind === 'evolution') {
        const p = origin(e.source);
        this.impact(type, phase, p.x, 465, 64, alpha);
      } else if (e.kind === 'wall-hit') {
        this.impact('thermal', phase, Math.max(35, Math.min(355, e.x)), 445, e.enemyDefId?.startsWith('B') ? 110 : 37, alpha);
      }
    }
    for (const field of run.fields) {
      this.impact(field.damageType, 1 + Math.floor(now / 190 + field.id) % 2, field.x, field.y, field.radius * (detail === 'compact' ? 1.1 : 1.65), detail === 'compact' ? .22 : .42);
    }
    for (let i = this.used; i < this.sprites.length; i++) this.sprites[i].setVisible(false);
    this.peak = Math.max(this.peak, this.used);
  }
  diagnostics() { return { materialEffects: { active: this.used, allocated: this.sprites.length, peak: this.peak, textures: this.counts, limit: this.limit, ammunition: this.sprites.slice(0, this.used).filter(s => s.texture.key === 'combat-ammo').map(s => ({ frame: Number(s.frame.name), x: s.x, y: s.y, width: s.displayWidth })) } }; }
}
