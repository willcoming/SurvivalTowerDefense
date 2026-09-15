import type Phaser from 'phaser';
import type { CharacterId, RunState } from '../sim/types';
import type { Origin } from './effects';
import { LAYERS } from './presentation';

export const AMMO_ATLAS = '/assets/vfx/combat-ammo-v2.webp';
export const AMMO_FRAME_SIZE = 128;
export const AMMO_FRAMES: Record<CharacterId, number> = { C01: 0, C02: 1, C03: 2, C04: 3, C05: 4, C06: 5, C07: 4, C08: 6 };

/** Every live projectile owns a visible textured quad, independent of decorative FX limits. */
export class ProjectileVisuals {
  private sprites: Phaser.GameObjects.Image[] = [];
  private used = 0;
  private hostile = 0;
  private ids: number[] = [];
  constructor(private scene: Phaser.Scene) {}

  update(run: RunState, origin: Origin) {
    this.used = 0; this.hostile = 0; this.ids = [];
    const aspect = this.scene.cameras.main.zoomX / this.scene.cameras.main.zoomY;
    for (const p of run.projectiles) {
      const source = p.packet?.source;
      const frame = source ? AMMO_FRAMES[source] : 7;
      const from = origin(source, p.tx);
      let x = p.x, y = p.y, dx = p.vx, dy = p.vy;
      if (p.impactAt) {
        const duration = p.packet?.skill === 'micro-missile' ? 9 : 14;
        const t = Math.max(0, Math.min(1, 1 - (p.impactAt - run.tick) / duration));
        x = from.x + (p.tx - from.x) * t;
        y = from.y + (p.ty - from.y) * t - Math.sin(t * Math.PI) * 55;
        dx = p.tx - from.x; dy = p.ty - from.y - Math.cos(t * Math.PI) * Math.PI * 55;
      } else if (source) {
        const span = 490 - p.ty || 1, remaining = (p.y - p.ty) / span;
        x += (from.x - 195) * remaining; y += (from.y - 490) * remaining;
        dx += (from.x - 195) * p.vy / span; dy += (from.y - 490) * p.vy / span;
      }
      let sprite = this.sprites[this.used];
      if (!sprite) { sprite = this.scene.add.image(x, y, 'combat-ammo', frame).setDepth(LAYERS.effects + .7); this.sprites.push(sprite); }
      if (Number(sprite.frame.name) !== frame) sprite.setFrame(frame);
      const size = source === 'C05' ? 30 : source === 'C06' ? 25 : source ? 22 : 18;
      sprite.setVisible(true).setPosition(x, y).setDisplaySize(size, size * aspect).setRotation(Math.atan2(dy, dx));
      this.ids.push(p.id); this.used++;
      if (!source) this.hostile++;
    }
    for (let i = this.used; i < this.sprites.length; i++) this.sprites[i].setVisible(false);
  }
  diagnostics() {
    return {
      hostileProjectileImages: this.hostile,
      projectileVisuals: {
        active: this.used, allocated: this.sprites.length, texture: 'combat-ammo',
        sprites: this.sprites.slice(0, this.used).map((s, i) => ({ id: this.ids[i], frame: Number(s.frame.name), x: s.x, y: s.y, rotation: s.rotation, width: s.displayWidth, depth: s.depth })),
      },
    };
  }
}
