import type Phaser from 'phaser';
import type { Effect, RunState, VisualEvent } from '../sim/types';
import type { Detail } from './presentation';
import { enemySize } from './actors';

type Status = Effect['kind'];
const statuses: Status[] = ['burn', 'slow', 'stun', 'exposure'];
export class StatusEffects {
  private sprites = new Map<number, Map<Status, Phaser.GameObjects.Image>>();
  private labels: { text: Phaser.GameObjects.Text; born: number; value: number; x: number; y: number; key: string }[] = [];
  private visible: { id: number; states: Status[] }[] = [];
  constructor(private scene: Phaser.Scene) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    for (let frame = 0; frame < 4; frame++) {
      g.clear();
      for (let i = 0; i < 5; i++) {
        const x = 10 + i * 11, h = 22 + Math.sin(frame * 1.6 + i * 2) * 8, bend = Math.sin(frame + i) * 5;
        g.fillStyle(0xff592b, .75).fillTriangle(x - 9, 54, x + 9, 54, x + bend, 44 - h);
        g.fillStyle(0xffb83e, .95).fillTriangle(x - 5, 53, x + 6, 53, x + bend, 50 - h);
        g.fillStyle(0xfff1a8, .95).fillTriangle(x - 3, 54, x + 3, 54, x + bend * .5, 48 - h * .55);
      }
      g.generateTexture(`status-burn-${frame}`, 64, 64);
      g.clear().lineStyle(2, 0xceeaff, .85).strokeEllipse(32, 32, 48, 16);
      for (let i = 0; i < 3; i++) { const a = frame * Math.PI / 2 + i * Math.PI * 2 / 3, x = 32 + Math.cos(a) * 23, y = 32 + Math.sin(a) * 8; g.fillStyle(0xffffff, 1).fillTriangle(x - 4, y + 3, x + 4, y + 3, x, y - 6); }
      g.generateTexture(`status-stun-${frame}`, 64, 64);
    }
    g.clear().lineStyle(4, 0x67f7dc, .95).strokeEllipse(32, 32, 57, 22);
    for (const x of [20, 32, 44]) g.lineStyle(2, 0xceffee, 1).beginPath().moveTo(x - 4, 23).lineTo(x + 4, 23).lineTo(x - 4, 40).lineTo(x + 4, 40).strokePath();
    g.generateTexture('status-slow', 64, 64);
    g.clear();
    for (const x of [7, 57]) for (const y of [7, 57]) g.lineStyle(3, 0xffdf70, 1).beginPath().moveTo(x, y + (y < 32 ? 12 : -12)).lineTo(x, y).lineTo(x + (x < 32 ? 12 : -12), y).strokePath();
    g.fillStyle(0xffdc66, 1).fillTriangle(26, 1, 38, 1, 32, 9).generateTexture('status-exposure', 64, 64);
    g.destroy();
    // Pack every state/frame into one texture so interleaved burn/slow/stun icons
    // share a single WebGL batch even when a hundred enemies have multiple states.
    const keys = [...Array.from({ length: 4 }, (_, i) => `status-burn-${i}`), ...Array.from({ length: 4 }, (_, i) => `status-stun-${i}`), 'status-slow', 'status-exposure'];
    const atlas = scene.textures.createCanvas('status-atlas', keys.length * 64, 64)!;
    keys.forEach((key, i) => {
      atlas.context.drawImage(scene.textures.get(key).getSourceImage() as HTMLCanvasElement, i * 64, 0);
      atlas.add(key, 0, i * 64, 0, 64, 64);
      scene.textures.remove(key);
    });
    atlas.refresh();
    for (let i = 0; i < 12; i++) this.labels.push({ text: scene.add.text(0, 0, '', { fontSize: '13px', fontStyle: 'bold', fontFamily: 'sans-serif', color: '#ffcf78', stroke: '#28120b', strokeThickness: 3 }).setOrigin(.5).setDepth(12).setVisible(false), born: -Infinity, value: 0, x: 0, y: 0, key: '' });
  }
  update(run: RunState, now: number, fresh: VisualEvent[], detail: Detail) {
    const ids = new Set(run.enemies.map(e => e.id));
    for (const [id, sprites] of this.sprites) if (!ids.has(id)) { sprites.forEach(s => s.destroy()); this.sprites.delete(id); }
    this.visible = [];
    const frame = Math.floor(now / 130) % 4;
    for (const enemy of run.enemies) {
      const active = new Set(enemy.effects.filter(f => f.expires > run.tick).map(f => f.kind));
      if (enemy.exposureUntil > run.tick) active.add('exposure');
      if (enemy.hp <= 0 || run.bossIntro?.enemyId === enemy.id) active.clear();
      let sprites = this.sprites.get(enemy.id);
      if (!sprites && active.size) { sprites = new Map(); this.sprites.set(enemy.id, sprites); }
      if (!sprites) continue;
      const size = enemySize(enemy.defId);
      for (const status of statuses) {
        let sprite = sprites.get(status); const key = `status-${status}${status === 'burn' || status === 'stun' ? `-${frame}` : ''}`;
        if (active.has(status)) {
          if (!sprite) {
            const scale = status === 'stun' ? .8 : status === 'exposure' ? 1.05 : .95;
            sprite = this.scene.add.image(0, 0, 'status-atlas', key).setDepth(8.5).setDisplaySize(size * scale, size * scale); sprites.set(status, sprite);
          }
          if (sprite.frame.name !== key) sprite.setFrame(key);
          sprite.setVisible(true).setPosition(enemy.x, enemy.y + (status === 'stun' ? -size * .7 : status === 'slow' ? size * .42 : status === 'burn' ? size * .12 : 0));
        } else sprite?.setVisible(false);
      }
      if (active.size) this.visible.push({ id: enemy.id, states: [...active] });
    }
    const limit = detail === 'compact' ? 6 : 12;
    for (const event of fresh) if (event.kind === 'hit' && event.skill === 'burn' && (event.value ?? 0) > 0) {
      const key = detail === 'compact' ? `${Math.floor(event.x / 65)}:${Math.floor(event.y / 50)}` : String(event.targetId);
      let label = this.labels.slice(0, limit).find(l => l.key === key && now - l.born < 700);
      if (!label) { label = this.labels.slice(0, limit).find(l => now - l.born >= 700); if (!label) continue; label.key = key; label.value = 0; label.born = now; label.x = event.x; label.y = event.y - 24; }
      label.value += event.value!;
    }
    // Upload each merged label at most once per frame, rather than once per damage event.
    this.labels.forEach((label, i) => { const t = (now - label.born) / 700, visible = i < limit && t >= 0 && t < 1; label.text.setVisible(visible); if (visible) label.text.setText(`燃 ${Number(label.value.toFixed(1))}`).setPosition(label.x, label.y - t * 20).setAlpha(t < .6 ? 1 : (1 - t) / .4); });
  }
  diagnostics() { return { statuses: this.visible, burnNumbers: this.labels.filter(l => l.text.visible).map(l => ({ value: l.value, text: l.text.text, born: l.born })) }; }
}
