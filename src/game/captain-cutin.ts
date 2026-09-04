import type Phaser from 'phaser';
import { CHARACTER_MAP } from '../data/content';
import type { CharacterId } from '../sim/types';
import { CUTIN_MS, LAYERS, type Detail } from './presentation';

/** A readable name hold with a single slide in/out, driven by the battle's pause-aware clock. */
export class CaptainCutin {
  private container: Phaser.GameObjects.Container;
  private plate: Phaser.GameObjects.Graphics;
  private sweep: Phaser.GameObjects.Graphics;
  private name: Phaser.GameObjects.Text;
  private caption: Phaser.GameObjects.Text;
  private portrait: Phaser.GameObjects.Image;
  private born = -Infinity;
  private id: CharacterId | null = null;
  private color = 0x8bf5dc;
  constructor(scene: Phaser.Scene) {
    this.plate = scene.add.graphics();
    scene.textures.get('captain-portrait').add('cutin', 0, 148, 25, 472, 368);
    this.portrait = scene.add.image(0, 0, 'captain-portrait', 'cutin').setOrigin(0).setDisplaySize(144, 112);
    this.caption = scene.add.text(156, 18, '', { fontSize: '11px', fontFamily: 'sans-serif', color: '#b7fff0' });
    this.name = scene.add.text(155, 42, '', { fontSize: '29px', fontFamily: 'sans-serif', fontStyle: 'bold', color: '#fff8e8', stroke: '#09232d', strokeThickness: 3 });
    const footer = scene.add.text(157, 86, '隊長技能  /  TACTICAL BURST', { fontSize: '9px', fontFamily: 'sans-serif', color: '#d1e7df' });
    this.sweep = scene.add.graphics();
    this.container = scene.add.container(10, 323, [this.plate, this.portrait, this.caption, this.name, footer, this.sweep]).setDepth(LAYERS.cutin).setVisible(false);
  }
  play(id: CharacterId, now: number) {
    this.id = id; this.born = now;
    const captain = CHARACTER_MAP[id]; this.color = parseInt(captain.color.slice(1), 16);
    this.name.setText(captain.tacticalName); this.caption.setText(`${captain.name}  /  ${captain.english}`);
    this.plate.clear().fillStyle(0x071e29, .96).fillRect(0, 0, 370, 112);
    this.plate.fillStyle(this.color, .22).fillTriangle(144, 0, 370, 0, 144, 108);
    this.plate.lineStyle(3, this.color, 1).strokeRect(1, 1, 368, 110);
    this.plate.fillStyle(this.color, 1).fillRect(146, 14, 3, 83);
  }
  update(now: number, detail: Detail) {
    const age = now - this.born, visible = age >= 0 && age < CUTIN_MS;
    this.container.setVisible(visible); if (!visible) return;
    const enter = Math.min(1, age / 130), exit = Math.max(0, (age - 980) / 220);
    this.container.setAlpha(Math.min(1, (age + 16) / 75) * (1 - exit)).setX(10 + (detail === 'compact' ? 0 : 28 * (1 - enter) ** 3 - 16 * exit));
    this.portrait.setAlpha(.9 + enter * .1);
    this.sweep.clear().fillStyle(this.color, .65).fillRect(154, 106, 200 * (1 - age / CUTIN_MS), 3);
    if (detail === 'full') this.sweep.fillStyle(0xfff6df, .7 * (1 - age / CUTIN_MS)).fillRect(154 + 198 * age / CUTIN_MS, 0, 18, 3);
  }
  diagnostics(now: number) {
    return { visible: this.container.visible, id: this.id, age: now - this.born, duration: CUTIN_MS, top: 323, bottom: 435, depth: this.container.depth };
  }
}
