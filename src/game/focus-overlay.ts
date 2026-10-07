import type Phaser from 'phaser';
import { WORLD } from '../data/content';
import type { RunState } from '../sim/types';
import { line, polygon, type Origin } from './effects';

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
  update(run: RunState, now: number, origin: Origin, reduced: boolean) {
    this.guide.clear(); this.sight.clear();
    const y = WORLD.wallY - 220;
    this.threatened = run.enemies.some(e => e.hp > 0 && e.y >= y);
    this.threatAlpha = this.threatened ? (reduced ? .85 : .7 + .15 * Math.sin(now / 240)) : .25;
    this.guide.fillStyle(0xff595e, this.threatAlpha * .08).fillRect(0, y - 5, WORLD.width, 10);
    for (let x = 0; x < WORLD.width; x += 20) line(this.guide, [{ x, y }, { x: Math.min(WORLD.width, x + 12), y }], 0xff595e, 1.5, this.threatAlpha);
    const enemy = run.enemies.find(e => e.id === run.focusTargetId && e.hp > 0 && e.id !== run.bossIntro?.enemyId);
    if (this.target && this.target.id !== enemy?.id) this.fading = { ...this.target, born: now };
    this.target = enemy ? { id: enemy.id, x: enemy.x, y: enemy.y, radius: enemy.radius + 12 } : null;
    if (this.target) {
      for (const id of run.config.squadIds) line(this.guide, [origin(id, enemy!.x), this.target], 0xff595e, 1.5, .5);
      polygon(this.sight, this.target.x, this.target.y, this.target.radius, 4, 0xff595e, .95, reduced ? 0 : now / 850, 2);
    }
    if (this.fading) {
      const t = (now - this.fading.born) / 240;
      if (t >= 1) this.fading = null;
      else polygon(this.sight, this.fading.x, this.fading.y, this.fading.radius + (reduced ? 0 : t * 18), 4, 0xff595e, (1 - t) * .8, reduced ? 0 : now / 850, 2);
    }
  }
  diagnostics() {
    return { focus: this.target, focusFading: !!this.fading, threatLine: { y: WORLD.wallY - 220, active: this.threatened, alpha: this.threatAlpha } };
  }
}
