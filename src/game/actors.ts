import Phaser from 'phaser';
import { inWeaponRange } from '../sim/range';
import { CaptainCutin } from './captain-cutin';
import type { CharacterId, EnemyId, RunState, VisualEvent } from '../sim/types';
import { LAYERS, poseFrame, weaponForm, type Detail } from './presentation';
import { advanceEnemyMotion, createEnemyMotion, ENEMY_POSES, type EnemyMotion, type EnemyMotionMode } from './enemy-motion';

export const enemySize = (id: string) => id.startsWith('B') ? 106 : id === 'E07' ? 60 : id === 'E03' ? 48 : 39;
interface Ally { image: Phaser.GameObjects.Sprite; attacks: number; firedAt: number; frame: number; frames: Set<number>; facing: number }
interface Creature { image: Phaser.GameObjects.Image; defId: EnemyId; hitAt: number; hitPower: number; motion: EnemyMotion }
interface Corpse { image: Phaser.GameObjects.Image; born: number; duration: number; size: number; id: number; x: number; y: number; boss: boolean }

export class CombatActors {
  private allies = new Map<CharacterId, Ally>();
  private creatures = new Map<number, Creature>();
  private corpses: Corpse[] = [];
  private deadIds = new Set<number>();
  private cutin: CaptainCutin;
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
    this.cutin = new CaptainCutin(scene);
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
        const creature = this.creatures.get(event.targetId); if (creature) { creature.hitAt = this.clock; creature.hitPower = event.skill === 'burn' ? .1 : Math.max(.2, Math.min(1, (event.value ?? 0) / 60)); }
        if (event.enemyDefId) this.hits.add(event.enemyDefId);
      }
      if (event.kind === 'explosion') for (const id of event.affectedIds ?? []) {
        const creature = this.creatures.get(id); if (creature) { creature.hitAt = this.clock; creature.hitPower = .65; }
      }
      if (event.kind === 'death') this.corpse(event, detail);
      if (event.kind === 'tactical' && event.source) {
        this.cutin.play(event.source, this.clock); this.skills.add(event.source);
        const ally = this.allies.get(event.source); if (ally) ally.firedAt = this.clock;
      }
    }
    for (const w of run.weapons) {
      const eligible = run.enemies.filter(e => inWeaponRange(run, w.id, e));
      const target = eligible.sort((a, b) => b.y - a.y)[0];
      const ally = this.allies.get(w.id)!;
      if (w.attacks !== ally.attacks) { ally.attacks = w.attacks; ally.firedAt = this.clock; this.forms.add(weaponForm(w.id, w.rank, w.branch)); }
      const frame = poseFrame(this.clock, ally.firedAt, w.nextAttack - run.tick, this.speed(), !!target, run.config.squadIds.indexOf(w.id) * 90);
      if (frame === 2 && target) {
        const aim = w.id === 'C03' ? eligible.reduce((a, b) => a.maxHp >= b.maxHp ? a : b) : target;
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
        creature = { image, defId: enemy.defId, motion, hitPower: .5, hitAt: fresh.some(e => e.kind === 'hit' && e.targetId === enemy.id || e.kind === 'explosion' && e.affectedIds?.includes(enemy.id)) ? this.clock : -Infinity }; this.creatures.set(enemy.id, creature);
      }
      creature.image.setVisible(run.bossIntro?.enemyId !== enemy.id);
      const releases = creature.motion.releases;
      const motion = advanceEnemyMotion(creature.motion, enemy, run.tick, delta, this.speed(), run.phase === 'running');
      if (Number(creature.image.frame.name) !== motion.frame) creature.image.setFrame(motion.frame);
      let history = this.enemyHistory.get(enemy.defId);
      if (!history) { history = { modes: new Set(), frames: new Set(), releases: 0 }; this.enemyHistory.set(enemy.defId, history); }
      history.modes.add(motion.mode); history.frames.add(motion.frame); history.releases += motion.releases - releases;
      const age = this.clock - creature.hitAt, hurt = age < 180;
      const kick = hurt ? Math.sin(Math.min(1, age / 180) * Math.PI) * creature.hitPower : 0;
      const size = enemySize(enemy.defId);
      creature.image.setDisplaySize(size * (1 + kick * .09), size * (1 - kick * .06));
      creature.image.setPosition(enemy.x + (hurt ? Math.sin(age / 16) * (1 - age / 180) * (enemy.defId.startsWith('B') ? 1.5 : 3) : 0), enemy.y - kick * (enemy.defId.startsWith('B') ? 2 : 6));
      if (hurt && age < 65) creature.image.setTintFill(0xe9fff3);
      else if (enemy.effects.some(e => e.kind === 'stun' && e.expires > run.tick)) creature.image.setTint(0x7cffff);
      else if (enemy.effects.some(e => e.kind === 'burn' && e.expires > run.tick)) creature.image.setTint(0xffca95);
      else creature.image.clearTint();
    }
    this.corpses = this.corpses.filter(c => {
      const t = (this.clock - c.born) / c.duration;
      if (t >= 1) { c.image.destroy(); return false; }
      c.image.setDisplaySize(c.size * (1 + t * .12), c.size * (1 - t * .65)).setPosition(c.x + (c.id % 2 ? -1 : 1) * t * 5, c.y + t * 12).setAngle((c.id % 2 ? -1 : 1) * t * (c.boss ? 5 : 18)).setAlpha(1 - t);
      if (t < .12) c.image.setTintFill(0xffeac9); else c.image.setTint(0x809d9f);
      return true;
    });
    this.cutin.update(this.clock, detail);
  }
  diagnostics() {
    return {
      clock: this.clock, poses: Object.fromEntries([...this.allies].map(([id, a]) => [id, { frame: a.frame, seen: [...a.frames].sort(), texture: a.image.texture.key }])),
      forms: [...this.forms], skills: [...this.skills], hitTypes: [...this.hits], deathTypes: [...this.deaths],
      activeCorpses: this.corpses.length, corpseIds: this.corpses.map(c => c.id),
      hurtIds: [...this.creatures].filter(([, c]) => this.clock - c.hitAt < 180).map(([id]) => id),
      maxCorpses: this.maxCorpses, aliveImages: this.creatures.size,
      enemyMotions: [...this.creatures].map(([id, c]) => ({ id, type: c.defId, mode: c.motion.mode, frame: Number(c.image.frame.name), pose: ENEMY_POSES[c.motion.frame], fps: c.motion.fps, clock: c.motion.time, releases: c.motion.releases, texture: c.image.texture.key })),
      enemyHistory: Object.fromEntries([...this.enemyHistory].map(([id, h]) => [id, { modes: [...h.modes], frames: [...h.frames].sort((a, b) => a - b), releases: h.releases }])),
      cutin: this.cutin.diagnostics(this.clock),
    };
  }
}
