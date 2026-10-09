import type Phaser from 'phaser';
import { WORLD } from '../data/content';
import type { RunState } from '../sim/types';
import type { Origin } from './effects';

type Target = { id: number; x: number; y: number; radius: number };
export class FocusOverlay {
  private guide: Phaser.GameObjects.Graphics;
  private sight: Phaser.GameObjects.Graphics;
  private target: Target | null = null;
  private fading: (Target & { born: number }) | null = null;
  private threatAlpha = .25;
  private threatened = false;
  constructor(scene: Phaser.Scene) {
    this.guide = scene.add.graphics().setDepth(2.5);
    this.sight = scene.add.graphics().setDepth(11);
  }
  update(run: RunState, now: number, _origin: Origin, reduced: boolean) {
    this.guide.clear(); this.sight.clear();
    const y = WORLD.wallY - 220;
    this.threatened = run.enemies.some(e => e.hp > 0 && e.y >= y);
    this.threatAlpha = this.threatened ? (reduced ? .85 : .7 + .15 * Math.sin(now / 240)) : .25;
    // Keep the diagnostic intensity envelope, but render only a faint ground glow.
    if (this.threatened) for (let band = 0; band < 5; band++) {
      this.guide.fillStyle(0xff595e, this.threatAlpha * .009).fillRect(0, y - 10 + band, WORLD.width, 20 - band * 2);
    }
    const enemy = run.enemies.find(e => e.id === run.focusTargetId && e.hp > 0 && e.id !== run.bossIntro?.enemyId);
    if (this.target && this.target.id !== enemy?.id) this.fading = { ...this.target, born: now };
    this.target = enemy ? { id: enemy.id, x: enemy.x, y: enemy.y, radius: enemy.radius + 12 } : null;
    if (this.target) this.mark(this.target, .65);
    if (this.fading) {
      const t = (now - this.fading.born) / 240;
      if (t >= 1) this.fading = null;
      else this.mark(this.fading, (1 - t) * .5);
    }
  }
  private mark(target: Target, alpha: number) {
    const r = Math.min(20, Math.max(13, target.radius * .6)), size = 4, thickness = 1;
    this.sight.fillStyle(0xffc5ab, alpha);
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
      const x = target.x + dx * r, y = target.y + dy * r;
      this.sight.fillRect(x - (dx > 0 ? size : 0), y, size, thickness);
      this.sight.fillRect(x - (dx > 0 ? thickness : 0), y - (dy > 0 ? size - thickness : 0), thickness, size);
    }
  }
  diagnostics() {
    return { focus: this.target, focusFading: !!this.fading, threatLine: { y: WORLD.wallY - 220, active: this.threatened, alpha: this.threatAlpha } };
  }
}
