import type Phaser from 'phaser';
import { BOSS_INTRO_MS, ENEMY_MAP } from '../data/content';
import type { RunState } from '../sim/types';
import { enemyTexture } from './enemy-motion';
import { NaturalEffects, variation } from './natural-effects';
import type { Detail } from './presentation';

export class BossEntrance {
  private graphics: Phaser.GameObjects.Graphics;
  private haze: NaturalEffects;
  private image: Phaser.GameObjects.Image;
  private title: Phaser.GameObjects.Text;
  private caption: Phaser.GameObjects.Text;
  private footer: Phaser.GameObjects.Text;
  private container: Phaser.GameObjects.Container;
  constructor(private scene: Phaser.Scene, initialTexture: string) {
    this.graphics = scene.add.graphics();
    this.image = scene.add.image(195, 150, initialTexture, 0);
    this.caption = scene.add.text(195, 85, 'WARNING / 大型外星反應', { fontFamily: 'sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#ffb48a', stroke: '#132530', strokeThickness: 4 }).setOrigin(.5);
    this.title = scene.add.text(195, 305, '', { fontFamily: 'sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#fff3d8', stroke: '#0e2028', strokeThickness: 5 }).setOrigin(.5);
    this.footer = scene.add.text(195, 352, '防線鎖定 · 即將交戰', { fontFamily: 'sans-serif', fontSize: '13px', color: '#cfede3' }).setOrigin(.5);
    this.container = scene.add.container(0, 0, [this.graphics, this.image, this.caption, this.title, this.footer]).setDepth(30).setVisible(false);
    this.haze = new NaturalEffects(scene,30,10,this.container);
  }
  update(run: RunState, detail: Detail) {
    const intro = run.bossIntro, enemy = run.enemies.find(e => e.id === intro?.enemyId);
    this.haze.begin();
    this.container.setVisible(!!intro && !!enemy); if (!intro || !enemy) { this.haze.end(); return; }
    const t = 1 - intro.remainingMs / BOSS_INTRO_MS, compact = detail === 'compact';
    const aspect=this.scene.cameras.main.zoomX/this.scene.cameras.main.zoomY;
    for(const text of [this.caption,this.title,this.footer])text.setScale(1,aspect);
    const reveal = Math.min(1, Math.max(0, (t - .18) / .35)), fade = Math.min(1, (1 - t) / .15);
    const color = enemy.defId === 'B01' ? 0xc6ee9a : enemy.defId === 'B02' ? 0x76e9ff : 0xff9068;
    const g = this.graphics; g.clear().fillStyle(0x031b25, .58 * fade).fillRect(0, 0, 390, 520);
    g.fillStyle(0x091d24, .9 * fade).fillRect(16, 278, 358, 98);
    this.haze.glow(enemy.x,enemy.y,130,color,fade*.2);
    for(let i=0;i<(compact?2:3);i++){
      const drift=compact?0:t*12;
      this.haze.draw('combat-props',5,enemy.x+(i-1)*36,enemy.y+22-drift*(.5+variation(enemy.id,i)),
        70+i*9,fade*.3,variation(enemy.id,i+10)*180,color);
    }
    this.haze.end();
    this.image.setTexture(enemyTexture(enemy.defId), t > .7 ? 10 : 0).setDisplaySize(106 + (1 - reveal) * 68, (106 + (1 - reveal) * 68)*aspect).setPosition(enemy.x, enemy.y - (1 - reveal) * (compact ? 0 : 28)).setAlpha(reveal);
    this.title.setText(ENEMY_MAP[enemy.defId].name).setAlpha(Math.min(1, t * 5) * fade);
    this.caption.setAlpha(fade); this.footer.setAlpha(fade);
  }
}
