import type Phaser from 'phaser';
import { CHARACTER_MAP } from '../data/content';
import { ALLY_MOTION } from '../data/character-motion';
import { attackType, ELEMENTS } from '../data/forms';
import type { RunState } from '../sim/types';
import { tacticalPose } from './ally-motion';
import { LAYERS, type Detail } from './presentation';
import { TacticalTimeline, TACTICAL_DURATION_MS, TACTICAL_RELEASE_MS } from './tactical-timeline';

const FX_ROWS = { plasma: 0, thermal: 1, arc: 2, gravity: 3, kinetic: 0 } as const;

/** Full-body, six-pose Q animation on a separate, pause-aware real-time timeline. */
export class CaptainCutin {
  private container: Phaser.GameObjects.Container;
  private plate: Phaser.GameObjects.Graphics;
  private name: Phaser.GameObjects.Text;
  private caption: Phaser.GameObjects.Text;
  private hero: Phaser.GameObjects.Sprite;
  private effects: Phaser.GameObjects.Image[];
  private props: Phaser.GameObjects.Image[];
  private frames = new Set<number>();
  private serial = -1;

  constructor(private scene: Phaser.Scene, private timeline: TacticalTimeline, private read: () => RunState) {
    this.plate = scene.add.graphics();
    this.hero = scene.add.sprite(142, 410, `motion-${read().config.captainId}`, 6).setOrigin(ALLY_MOTION.originX, ALLY_MOTION.originY);
    this.effects = Array.from({ length: 5 }, () => scene.add.image(0, 0, 'combat-fx', 0));
    this.props = Array.from({ length: 3 }, () => scene.add.image(0, 0, 'combat-props', 0));
    this.caption = scene.add.text(24, 88, '', { fontSize: '12px', fontFamily: 'sans-serif', color: '#c6dce5', letterSpacing: 3 });
    this.name = scene.add.text(23, 111, '', { fontSize: '34px', fontFamily: 'sans-serif', fontStyle: 'bold', color: '#fff8e8', stroke: '#08151f', strokeThickness: 5 });
    this.container = scene.add.container(0, 0, [this.plate, ...this.props, this.hero, ...this.effects, this.caption, this.name]).setDepth(LAYERS.cutin).setVisible(false);
  }

  update(detail: Detail, reduced = false) {
    const run = this.read(), active = this.timeline.active(run), age = this.timeline.elapsedMs;
    this.container.setVisible(active);
    if (!active) return;
    const id = run.config.captainId, definition = CHARACTER_MAP[id];
    const c = parseInt(ELEMENTS[attackType(run, id)].color.slice(1), 16);
    if (this.serial !== this.timeline.serial) {
      this.serial = this.timeline.serial; this.frames.clear();
      this.name.setText(definition.tacticalName);
      this.caption.setText(`${definition.name}  /  ${definition.english}`);
      this.hero.setTexture(`motion-${id}`);
    }
    const aspect = this.scene.cameras.main.zoomX / this.scene.cameras.main.zoomY;
    const enter = Math.min(1, age / 170), exit = Math.max(0, (age - 1170) / 230);
    const release = Math.max(0, age - TACTICAL_RELEASE_MS), impact = Math.max(0, 1 - release / 220);
    const released = age >= TACTICAL_RELEASE_MS;
    const alpha = Math.min(1, enter * 2) * (1 - exit);
    const shake = !reduced && detail === 'full' && released ? Math.sin(release / 19) * impact * 3 : 0;
    this.container.setAlpha(alpha).setPosition(shake, 0);
    this.plate.clear().fillStyle(0x040c19, .92).fillRect(-5, 0, 400, 520);
    this.plate.fillStyle(c, .10).fillTriangle(0, 180, 390, 95, 390, 420);
    this.plate.fillStyle(c, .18).fillTriangle(0, 392, 390, 272, 390, 352);
    this.plate.fillStyle(c, .85).fillRect(24, 77, 34 + enter * 70, 3);
    this.plate.fillStyle(0xffffff, released ? impact * .11 : 0).fillRect(0, 76, 390, 390);
    const frame = tacticalPose(age);
    this.hero.setFrame(frame).setDisplaySize(270, 270 * aspect)
      .setPosition(142 - (1 - enter) * 35 - (released ? impact * 5 : 0), 413)
      .setFlipX(false);
    this.frames.add(frame);
    this.name.setScale(1, aspect);
    this.caption.setScale(1, aspect);
    const row = FX_ROWS[attackType(run, id)];
    const phase = Math.min(3, Math.floor(release / 175));
    this.effects.forEach(image => image.setVisible(false));
    this.props.forEach(image => image.setVisible(false));
    if (id === 'C06' || id === 'C07') {
      this.props.forEach((image, i) => image.setVisible(true).setTexture('combat-props', id === 'C06' ? 0 : 2)
        .setPosition(215 + i * 49, 230 + (i % 2) * 54 - Math.sin(age / 230 + i) * 5)
        .setDisplaySize(54, 54 * aspect).setAlpha(.65 + enter * .35));
    }
    if (!released) {
      this.effects[0].setVisible(true).setTexture('combat-fx', row * 4).setPosition(204, 300)
        .setDisplaySize(32 + age / 18, (32 + age / 18) * aspect).setAlpha(.45 + age / 1200);
      return;
    }
    const count = id === 'C01' ? 4 : id === 'C07' ? 3 : id === 'C06' ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const image = this.effects[i];
      const localPhase = Math.min(3, Math.max(0, Math.floor((release - i * 65) / 155)));
      if (id === 'C06') image.setTexture('combat-props', 8 + phase);
      else if (id === 'C03') image.setTexture('combat-props', 12 + localPhase);
      else image.setTexture('combat-fx', row * 4 + localPhase);
      const size = id === 'C01' ? 106 : id === 'C07' ? 118 : id === 'C06' ? 248 : i ? 115 : 206;
      image.setVisible(release >= i * 65).setPosition(id === 'C01' ? 130 + i * 61 : id === 'C07' ? 100 + i * 104 : 256 + (i ? -66 : 0), id === 'C01' ? 194 + i * 40 : id === 'C07' ? 208 + i % 2 * 78 : 244 + i * 59)
        .setDisplaySize(size, size * aspect).setAlpha((i ? .85 : 1) * (1 - exit));
    }
    if (id === 'C05') this.props[0].setVisible(true).setTexture('combat-props', 1).setPosition(254, 145 + Math.min(1, release / 130) * 85).setDisplaySize(70, 70 * aspect).setAngle(120).setAlpha(impact);
  }

  diagnostics() {
    return { visible: this.container.visible, id: this.timeline.characterId, age: this.timeline.elapsedMs,
      duration: TACTICAL_DURATION_MS, top: 77, bottom: 520, depth: LAYERS.cutin,
      frame: Number(this.hero.frame.name), frames: [...this.frames], fullScreen: true, frozen: this.timeline.active(this.read()), texture: this.hero.texture.key };
  }
}
