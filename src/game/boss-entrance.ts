import type Phaser from 'phaser';
import { BOSS_INTRO_MS, ENEMY_MAP } from '../data/content';
import type { RunState } from '../sim/types';
import { enemyTexture } from './enemy-motion';
import { burst, line, polygon } from './effects';
import type { Detail } from './presentation';

export class BossEntrance {
  private graphics: Phaser.GameObjects.Graphics;
  private image: Phaser.GameObjects.Image;
  private title: Phaser.GameObjects.Text;
  private caption: Phaser.GameObjects.Text;
  private footer: Phaser.GameObjects.Text;
  private container: Phaser.GameObjects.Container;
  constructor(scene: Phaser.Scene, initialTexture: string) {
    this.graphics = scene.add.graphics();
    this.image = scene.add.image(195, 150, initialTexture, 0);
    this.caption = scene.add.text(195, 85, 'WARNING / 大型外星反應', { fontFamily: 'sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#ffb48a', stroke: '#132530', strokeThickness: 4 }).setOrigin(.5);
    this.title = scene.add.text(195, 305, '', { fontFamily: 'sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#fff3d8', stroke: '#0e2028', strokeThickness: 5 }).setOrigin(.5);
    this.footer = scene.add.text(195, 352, '防線鎖定 · 即將交戰', { fontFamily: 'sans-serif', fontSize: '13px', color: '#cfede3' }).setOrigin(.5);
    this.container = scene.add.container(0, 0, [this.graphics, this.image, this.caption, this.title, this.footer]).setDepth(30).setVisible(false);
  }
  update(run: RunState, detail: Detail) {
    const intro = run.bossIntro, enemy = run.enemies.find(e => e.id === intro?.enemyId);
    this.container.setVisible(!!intro && !!enemy); if (!intro || !enemy) return;
    const t = 1 - intro.remainingMs / BOSS_INTRO_MS, compact = detail === 'compact';
    const reveal = Math.min(1, Math.max(0, (t - .18) / .35)), fade = Math.min(1, (1 - t) / .15);
    const color = enemy.defId === 'B01' ? 0xc6ee9a : enemy.defId === 'B02' ? 0x76e9ff : 0xff9068;
    const g = this.graphics; g.clear().fillStyle(0x031b25, .58 * fade).fillRect(0, 0, 390, 520);
    g.fillStyle(0x091d24, .9 * fade).fillRect(16, 278, 358, 98);
    const radius = 22 + Math.min(1, t / .5) * 99;
    g.lineStyle(7, color, fade * .28).strokeEllipse(195, 169, radius * 2, radius * 1.1);
    g.lineStyle(3, color, fade).strokeEllipse(195, 169, radius * 2, radius * 1.1);
    line(g, [{ x: 22, y: 279 }, { x: 368, y: 279 }], color, 3, fade);
    if (enemy.defId === 'B01') {
      for (let i = 0; i < (compact ? 5 : 8); i++) { const a = i * Math.PI * 2 / (compact ? 5 : 8) + t * .5; polygon(g, 195 + Math.cos(a) * radius, 169 + Math.sin(a) * radius * .5, 7 + reveal * 5, 3, color, fade, a, 3); }
    } else if (enemy.defId === 'B02') {
      polygon(g, 195, 169, radius, 6, color, fade, Math.PI / 6 + t * .4, 4);
      polygon(g, 195, 169, radius * .72, 6, 0xdbffff, fade * .7, -t * .4, 2);
    } else {
      burst(g, 195, 169, radius * 1.2, color, fade, compact ? 6 : 12, t);
      polygon(g, 195, 169, radius * .8, 4, 0xffdeb7, fade, t * .8, 3);
    }
    this.image.setTexture(enemyTexture(enemy.defId), t > .7 ? 10 : 0).setDisplaySize(106 + (1 - reveal) * 68, 106 + (1 - reveal) * 68).setPosition(enemy.x, enemy.y - (1 - reveal) * (compact ? 0 : 28)).setAlpha(reveal);
    this.title.setText(ENEMY_MAP[enemy.defId].name).setAlpha(Math.min(1, t * 5) * fade);
    this.caption.setAlpha(fade); this.footer.setAlpha(fade);
  }
}
