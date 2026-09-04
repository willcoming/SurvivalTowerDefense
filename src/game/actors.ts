import Phaser from 'phaser';
import { CHARACTER_MAP } from '../data/content';
import type { CharacterId, EnemyId, RunState, VisualEvent } from '../sim/types';
import { CUTIN_MS, LAYERS, poseFrame, weaponForm, type Detail } from './presentation';
import { advanceEnemyMotion, createEnemyMotion, ENEMY_POSES, type EnemyMotion, type EnemyMotionMode } from './enemy-motion';

export const enemySize = (id: string) => id.startsWith('B') ? 106 : id === 'E07' ? 60 : id === 'E03' ? 48 : 39;
interface Ally { image: Phaser.GameObjects.Sprite; attacks: number; firedAt: number; frame: number; frames: Set<number>; facing: number }
interface Creature { image: Phaser.GameObjects.Image; defId: EnemyId; hitAt: number; motion: EnemyMotion }
interface Corpse { image: Phaser.GameObjects.Image; born: number; duration: number; size: number; id: number; x: number; y: number; boss: boolean }

export class CombatActors {
  private allies = new Map<CharacterId, Ally>();
  private creatures = new Map<number, Creature>();
  private corpses: Corpse[] = [];
  private deadIds = new Set<number>();
  private cutin: Phaser.GameObjects.Container;
  private cutinName: Phaser.GameObjects.Text;
  private cutinCaption: Phaser.GameObjects.Text;
  private cutinPortrait: Phaser.GameObjects.Image;
  private cutinBorn = -Infinity;
  private cutinId: CharacterId | null = null;
  private cutinShown = false;
  private skills = new Set<CharacterId>();
  private forms = new Set<string>();
  private hits = new Set<EnemyId>();
  private deaths = new Set<EnemyId>();
  private maxCorpses = 0;
  private initialTick: number;
  private enemyHistory = new Map<EnemyId, { modes: Set<EnemyMotionMode>; frames: Set<number>; releases: number }>();
  clock = 0;

  constructor(private scene: Phaser.Scene, private read: () => RunState, private speed: () => number, private keys: Map<string, string>) {
    this.initialTick = read().tick;
    for (const id of read().config.squadIds) {
      const image = scene.add.sprite(this.center(id), 510, `motion-${id}`, 0).setOrigin(.5, 240 / 256).setDisplaySize(84, 84).setDepth(LAYERS.allies);
      this.allies.set(id, { image, attacks: read().weapons.find(w => w.id === id)!.attacks, firedAt: -Infinity, frame: 0, frames: new Set(), facing: 1 });
    }
    const plate = scene.add.graphics().fillStyle(0x092933, .94).fillRect(0, 0, 370, 92);
    plate.lineStyle(2, 0x8bf5dc, .85).beginPath().moveTo(0, 0).lineTo(370, 0).strokePath();
    plate.lineStyle(1, 0x8bf5dc, .3).beginPath().moveTo(128, 74).lineTo(353, 74).strokePath();
    scene.textures.get('captain-portrait').add('cutin', 0, 148, 25, 472, 368);
    this.cutinPortrait = scene.add.image(0, 0, 'captain-portrait', 'cutin').setOrigin(0).setDisplaySize(118, 92);
    this.cutinName = scene.add.text(132, 28, '', { fontSize: '21px', fontFamily: 'sans-serif', fontStyle: 'bold', color: '#fff8e8' });
    this.cutinCaption = scene.add.text(133, 9, '', { fontSize: '10px', fontFamily: 'sans-serif', color: '#aef5df' });
    const footer = scene.add.text(133, 59, 'TACTICAL SYSTEM / RELEASE', { fontSize: '8px', fontFamily: 'monospace', color: '#a8c4c2' });
    this.cutin = scene.add.container(10, 343, [plate, this.cutinPortrait, this.cutinCaption, this.cutinName, footer]).setDepth(LAYERS.cutin).setVisible(false);
  }
  center(id?: CharacterId) { const ids = this.read().config.squadIds, i = ids.indexOf(id!); return i < 0 ? 195 : 195 + (i - (ids.length - 1) / 2) * 70; }
  origin = (id?: CharacterId, targetX?: number) => {
    const x = this.center(id), sign = (targetX ?? x + 1) < x ? -1 : 1;
    return { x: x + sign * (id === 'C03' ? 29 : id === 'C05' ? 18 : 23), y: id === 'C03' || id === 'C05' ? 453 : 462 };
  };
  private corpse(event: VisualEvent, detail: Detail) {
    if (event.targetId === undefined || !event.enemyDefId || this.deadIds.has(event.targetId)) return;
    this.deadIds.add(event.targetId); this.deaths.add(event.enemyDefId);
    const key = this.keys.get(event.enemyDefId) ?? event.enemyDefId;
    if (!this.scene.textures.exists(key)) return;
    const boss = event.enemyDefId.startsWith('B'), size = enemySize(event.enemyDefId);
    const frame = this.creatures.get(event.targetId)?.image.frame.name ?? 0;
    const image = this.scene.add.image(event.x, event.y, key, frame).setDisplaySize(size, size).setDepth(LAYERS.actors + 1);
    this.corpses.push({ image, born: this.clock, duration: boss ? 650 : 360, size, id: event.targetId, x: event.x, y: event.y, boss });
    const max = detail === 'compact' ? 12 : 24;
    while (this.corpses.filter(c => !c.boss).length > max) { const i = this.corpses.findIndex(c => !c.boss); this.corpses.splice(i, 1)[0].image.destroy(); }
    this.maxCorpses = Math.max(this.maxCorpses, this.corpses.length);
  }
  update(run: RunState, delta: number, fresh: VisualEvent[], detail: Detail) {
    // Use elapsed wall time, never Phaser's smoothed simulation delta. Long gaps
    // belong to the app's suspension guard and must not fast-forward animations.
    if ((run.phase === 'running' || run.phase === 'ended') && delta <= 500) this.clock += Math.max(0, delta);
    for (const event of fresh) {
      if (event.source && (event.kind === 'shot' || event.kind === 'beam' && event.y === 490 || event.source === 'C04' && event.kind === 'explosion')) {
        const ally = this.allies.get(event.source); if (ally) ally.facing = (event.x2 ?? event.x) < this.center(event.source) ? -1 : 1;
      }
      if (event.kind === 'hit' && event.targetId !== undefined) {
        const creature = this.creatures.get(event.targetId); if (creature) creature.hitAt = this.clock;
        if (event.enemyDefId) this.hits.add(event.enemyDefId);
      }
      if (event.kind === 'death') this.corpse(event, detail);
      if (event.kind === 'tactical' && event.source) {
        this.cutinBorn = this.clock; this.cutinId = event.source; this.skills.add(event.source);
        this.cutinName.setText(CHARACTER_MAP[event.source].tacticalName);
        this.cutinCaption.setText(`${CHARACTER_MAP[event.source].name} / ${CHARACTER_MAP[event.source].role}`);
        const ally = this.allies.get(event.source); if (ally) ally.firedAt = this.clock;
      }
    }
    const target = run.enemies.filter(e => e.hp > 0).sort((a, b) => b.y - a.y)[0];
    for (const w of run.weapons) {
      const ally = this.allies.get(w.id)!;
      if (w.attacks !== ally.attacks) { ally.attacks = w.attacks; ally.firedAt = this.clock; this.forms.add(weaponForm(w.id, w.rank, w.branch)); }
      const frame = poseFrame(this.clock, ally.firedAt, w.nextAttack - run.tick, this.speed(), !!target, run.config.squadIds.indexOf(w.id) * 90);
      if (frame === 2 && target) {
        const aim = w.id === 'C03' ? run.enemies.reduce((a, b) => a.maxHp >= b.maxHp ? a : b) : target;
        ally.facing = aim.x < this.center(w.id) ? -1 : 1;
      }
      if (frame !== ally.frame) { ally.frame = frame; ally.image.setFrame(frame); }
      ally.frames.add(frame); ally.image.setFlipX(ally.facing < 0);
    }
    const ids = new Set(run.enemies.map(e => e.id));
    for (const [id, creature] of this.creatures) if (!ids.has(id)) {
      // A dense event batch can omit a decorative death event; the removed actor still collapses.
      this.corpse({ seq: 0, tick: run.tick, kind: 'death', x: creature.image.x, y: creature.image.y, targetId: id, enemyDefId: creature.defId }, detail);
      creature.image.destroy(); this.creatures.delete(id);
    }
    for (const enemy of run.enemies) {
      let creature = this.creatures.get(enemy.id);
      if (!creature) {
        const key = this.keys.get(enemy.defId) ?? enemy.defId;
        if (!this.scene.textures.exists(key)) continue;
        const image = this.scene.add.image(enemy.x, enemy.y, key, 0).setDisplaySize(enemySize(enemy.defId), enemySize(enemy.defId)).setDepth(LAYERS.actors);
        const motion = createEnemyMotion(enemy);
        if (enemy.lastAction && enemy.lastAction.tick > this.initialTick) motion.cue = '';
        creature = { image, defId: enemy.defId, motion, hitAt: fresh.some(e => e.kind === 'hit' && e.targetId === enemy.id) ? this.clock : -Infinity }; this.creatures.set(enemy.id, creature);
      }
      const releases = creature.motion.releases;
      const motion = advanceEnemyMotion(creature.motion, enemy, run.tick, delta, this.speed(), run.phase === 'running');
      if (Number(creature.image.frame.name) !== motion.frame) creature.image.setFrame(motion.frame);
      let history = this.enemyHistory.get(enemy.defId);
      if (!history) { history = { modes: new Set(), frames: new Set(), releases: 0 }; this.enemyHistory.set(enemy.defId, history); }
      history.modes.add(motion.mode); history.frames.add(motion.frame); history.releases += motion.releases - releases;
      const age = this.clock - creature.hitAt, hurt = age < 120;
      creature.image.setPosition(enemy.x + (hurt ? Math.sin(age / 12) * (1 - age / 120) * (enemy.defId.startsWith('B') ? 1.5 : 3) : 0), enemy.y);
      if (hurt && age < 45) creature.image.setTintFill(0xe9fff3);
      else if (enemy.effects.some(e => e.kind === 'stun')) creature.image.setTint(0x7cffff);
      else if (enemy.effects.some(e => e.kind === 'burn')) creature.image.setTint(0xffca95);
      else creature.image.clearTint();
    }
    this.corpses = this.corpses.filter(c => {
      const t = (this.clock - c.born) / c.duration;
      if (t >= 1) { c.image.destroy(); return false; }
      c.image.setDisplaySize(c.size * (1 + t * .12), c.size * (1 - t * .65)).setPosition(c.x + (c.id % 2 ? -1 : 1) * t * 5, c.y + t * 12).setAngle((c.id % 2 ? -1 : 1) * t * (c.boss ? 5 : 18)).setAlpha(1 - t);
      if (t < .12) c.image.setTintFill(0xffeac9); else c.image.setTint(0x809d9f);
      return true;
    });
    const age = this.clock - this.cutinBorn;
    this.cutinShown = age >= 0 && age < CUTIN_MS;
    this.cutin.setVisible(this.cutinShown);
    if (this.cutinShown) { const alpha = Math.min(1, (age + 16) / 60, (CUTIN_MS - age) / 100); this.cutin.setAlpha(alpha).setX(10 + Math.max(0, 1 - age / 70) * 35); }
  }
  diagnostics() {
    return {
      clock: this.clock, poses: Object.fromEntries([...this.allies].map(([id, a]) => [id, { frame: a.frame, seen: [...a.frames].sort(), texture: a.image.texture.key }])),
      forms: [...this.forms], skills: [...this.skills], hitTypes: [...this.hits], deathTypes: [...this.deaths],
      activeCorpses: this.corpses.length, corpseIds: this.corpses.map(c => c.id),
      hurtIds: [...this.creatures].filter(([, c]) => this.clock - c.hitAt < 120).map(([id]) => id),
      maxCorpses: this.maxCorpses, aliveImages: this.creatures.size,
      enemyMotions: [...this.creatures].map(([id, c]) => ({ id, type: c.defId, mode: c.motion.mode, frame: Number(c.image.frame.name), pose: ENEMY_POSES[c.motion.frame], fps: c.motion.fps, clock: c.motion.time, releases: c.motion.releases, texture: c.image.texture.key })),
      enemyHistory: Object.fromEntries([...this.enemyHistory].map(([id, h]) => [id, { modes: [...h.modes], frames: [...h.frames].sort((a, b) => a - b), releases: h.releases }])),
      cutin: { visible: this.cutinShown, id: this.cutinId, age: this.clock - this.cutinBorn, duration: CUTIN_MS, top: 343, bottom: 435, depth: LAYERS.cutin },
    };
  }
}
