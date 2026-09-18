import { assetUrl } from '../assets';
import Phaser from 'phaser';
import { CHARACTER_MAP, ENEMY_MAP, STAGE_MAP } from '../data/content';
import type { CharacterId, RunState } from '../sim/types';
import type { GameAudio } from './audio';
import { CombatActors, enemySize } from './actors';
import { MaterialEffects, MATERIAL_ATLAS, PROP_ATLAS, EFFECT_FRAME_SIZE } from './material-effects';
import { ProjectileVisuals, AMMO_ATLAS, AMMO_FRAME_SIZE } from './projectile-visuals';
import { TacticalTimeline } from './tactical-timeline';
import { enemyFrameSize, enemyTexture } from './enemy-motion';
import { drawInterrupt, drawField } from './effects';
import { capEffects, effectDetail, effectLifetime, LAYERS, priorityEnemy, type ActiveEffect, type Detail } from './presentation';
import { BossAssault } from './boss-assault';
import { StatusEffects } from './status-effects';
import { BossEntrance } from './boss-entrance';
import { drawRange } from './range-overlay';
import { inWeaponRange, weaponRange } from '../sim/range';
import type { BattleSpeed } from '../storage/repository';
import { stageArt } from '../data/campaign';
import { equippedForm, formMotion } from '../data/forms';
import { ALLY_MOTION } from '../data/character-motion';
import { WeaknessMarkers } from './weakness-markers';

interface SceneLoading { ready: () => void; failed: (paths: string[]) => void; progress: (ratio: number) => void }
export class BattleScene extends Phaser.Scene {
  private read: () => RunState;
  private audio: GameAudio;
  private low: () => boolean;
  private graphics!: Phaser.GameObjects.Graphics;
  private worldGraphics!: Phaser.GameObjects.Graphics;
  private worldTexture!: Phaser.GameObjects.RenderTexture;
  private worldRun: RunState | null = null;
  private worldKey = '';
  private actors!: CombatActors;
  private materials!: MaterialEffects;
  private statuses!: StatusEffects;
  private weaknesses!: WeaknessMarkers;
  private bossAssault!: BossAssault;
  private entrance!: BossEntrance;
  private rangeGraphics!: Phaser.GameObjects.Graphics;
  private rangeKey = "";
  private warnings!: Phaser.GameObjects.Graphics;
  private worldLabels: Phaser.GameObjects.Text[] = [];
  private detail: Detail = 'full'; private slowFrames = 0; private peakEffects = 0;
  private warning!: Phaser.GameObjects.Text;
  private flashes: ActiveEffect[] = [];
  private lastSeq = 0;
  private endingAt = Infinity;
  private endingDone: (() => void) | null = null;
  private spriteKeys = new Map<string, string>();
  private projectiles!: ProjectileVisuals;
  private previousShields = new Map<number, number>(); private previousCharges = new Set<number>(); private previousCooldown = 0;
  private loading: SceneLoading; private missing: string[] = [];
  constructor(read: () => RunState, audio: GameAudio, low: () => boolean, loading: SceneLoading, private speed: () => BattleSpeed = () => 1, private selectedRange: () => CharacterId | null = () => null, private timeline = new TacticalTimeline()) { super('battle'); this.read = read; this.audio = audio; this.low = low; this.loading = loading; }
  preload() {
    this.load.on('progress', (progress: number) => this.loading.progress(progress));
    this.load.on('loaderror', (file: Phaser.Loader.File) => { this.missing.push(String(file.src)); });
    const run = this.read();
    this.load.image('stage', stageArt(run.config.stageId));
    run.config.squadIds.forEach(id => this.load.spritesheet(`motion-${id}`, formMotion(equippedForm(run,id).id), { frameWidth: ALLY_MOTION.frameWidth, frameHeight: ALLY_MOTION.frameHeight }));
    this.load.spritesheet('combat-fx', assetUrl(MATERIAL_ATLAS.replace('/assets/', '')), { frameWidth: EFFECT_FRAME_SIZE, frameHeight: EFFECT_FRAME_SIZE });
    this.load.spritesheet('combat-ammo', assetUrl(AMMO_ATLAS.replace('/assets/', '')), { frameWidth: AMMO_FRAME_SIZE, frameHeight: AMMO_FRAME_SIZE });
    this.load.spritesheet('combat-props', assetUrl(PROP_ATLAS.replace('/assets/', '')), { frameWidth: EFFECT_FRAME_SIZE, frameHeight: EFFECT_FRAME_SIZE });
    [...new Set([...STAGE_MAP[run.config.stageId].enemyIds, STAGE_MAP[run.config.stageId].bossId])].forEach(id => this.load.spritesheet(enemyTexture(id), assetUrl(`enemy-animations/${id}-motion-v2.webp`), { frameWidth: enemyFrameSize(id), frameHeight: enemyFrameSize(id) }));
  }
  create() {
    const resize = () => {
      const camera=this.cameras.main;
      camera.setZoom(this.scale.width/390,this.scale.height/520).centerOn(195,260);
      const aspect=camera.zoomX/camera.zoomY;
      this.worldLabels.forEach(label=>label.setScale(1,aspect));
      this.warning?.setScale(1,aspect);
    };
    resize(); this.scale.on('resize',resize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.scale.off('resize',resize));
    Object.keys(ENEMY_MAP).forEach(id => {
      if (this.textures.exists(enemyTexture(id))) this.spriteKeys.set(id, enemyTexture(id));
    });
    this.cameras.main.setBackgroundColor('#132c38');
    if (this.textures.exists('stage')) { const bg = this.add.image(195, 260, 'stage'); bg.setDisplaySize(390, 520).setAlpha(.60); }
    const shade = this.add.graphics(); shade.fillStyle(0x062732, .16).fillRect(0, 0, 390, 520);
    shade.fillStyle(0x102630, .84).fillRect(0, 450, 390, 70);
    shade.lineStyle(1, 0x72ead8, .35).beginPath().moveTo(0, 450).lineTo(390, 450).strokePath();
    this.worldGraphics = this.add.graphics().setVisible(false);
    this.worldTexture = this.add.renderTexture(0, 0, 390, 520).setOrigin(0).setDepth(5);
    this.graphics = this.add.graphics().setDepth(LAYERS.effects);
    this.warnings = this.add.graphics().setDepth(LAYERS.warnings);
    this.actors = new CombatActors(this, this.read, this.speed, this.spriteKeys, this.timeline);
    this.materials = new MaterialEffects(this);
    this.projectiles = new ProjectileVisuals(this);
    this.statuses = new StatusEffects(this);
    this.weaknesses = new WeaknessMarkers(this);
    this.bossAssault = new BossAssault(this);
    this.entrance = new BossEntrance(this, enemyTexture(STAGE_MAP[this.read().config.stageId].bossId));
    this.rangeGraphics = this.add.graphics().setDepth(6);
    const ids = this.read().config.squadIds;
    ids.forEach((id, i) => {
      const x = 195 + (i - (ids.length - 1) / 2) * 70;
      this.worldLabels.push(this.add.text(x, 518, `${this.read().config.captainId === id ? '★ ' : ''}${CHARACTER_MAP[id].name}`, { fontSize: '10px', fontFamily: 'sans-serif', color: '#fff7e7' }).setOrigin(.5, 1).setDepth(8));
    });
    this.warning = this.add.text(195, 35, '', { fontSize: '14px', fontFamily: 'sans-serif', color: '#fff7e7', backgroundColor: '#aa3933', padding: { x: 12, y: 6 }, wordWrap: { width: 340, useAdvancedWrap: true }, align: 'center' }).setOrigin(.5).setDepth(LAYERS.warningText).setVisible(false);
    resize();
    this.lastSeq = this.read().eventSeq;
    if (this.missing.length) this.loading.failed(this.missing);
    else this.loading.ready();
  }
  private drawWorld(run: RunState) {
    const g = this.worldGraphics; g.clear();
    run.fields.forEach(f => drawField(g, f, run.tick, this.detail, run));
    for (const enemy of run.enemies) {
      if (run.bossIntro?.enemyId === enemy.id) continue;
      const boss = enemy.defId.startsWith('B'), size = enemySize(enemy.defId);
      const w = boss ? 84 : 26; const hpY = enemy.y - size / 2 - 4;
      if ((enemy.hp < enemy.maxHp || boss) && (run.enemies.length<24 || priorityEnemy(enemy))) { g.fillStyle(0x091e25, .9).fillRect(enemy.x - w / 2, hpY, w, boss ? 5 : 3); g.fillStyle(boss ? 0xff8666 : 0xf2dab8).fillRect(enemy.x - w / 2, hpY, w * Math.max(0, enemy.hp / enemy.maxHp), boss ? 5 : 3); }
      if (enemy.shield > 0) { g.fillStyle(0x7eebff, .8).fillRoundedRect(enemy.x - 5, hpY - 5, 10, 3, 1.5); }
    }
    const charging = run.enemies.find(e => e.defId.startsWith('B') && e.chargeKind && !e.chargeCancelled) ?? run.enemies.find(e => e.chargeKind && !e.chargeCancelled);
    for (const e of run.enemies) {
      if (e.chargeKind && !e.chargeCancelled && !this.previousCharges.has(e.id)) this.audio.feedback('alert');
      if (e.shield <= 0 && (this.previousShields.get(e.id) ?? 0) > 0) this.audio.feedback('shield-break');
    }
    this.previousShields = new Map(run.enemies.map(e => [e.id, e.shield])); this.previousCharges = new Set(run.enemies.filter(e => e.chargeKind && !e.chargeCancelled).map(e => e.id));
    const cooldown = Math.max(0, run.tacticalReadyAt - run.tick);
    if (this.previousCooldown > 0 && cooldown === 0) this.audio.feedback('ready'); this.previousCooldown = cooldown;
    this.warning.setVisible(!!charging);
    if (charging) { const stun = Math.max(0, Math.ceil((charging.stunImmuneUntil - run.tick) / 30)), move = Math.max(0, Math.ceil((charging.moveImmuneUntil - run.tick) / 30)); const immunity = [stun ? `免暈 ${stun}s` : '', move ? `免位移 ${move}s` : ''].filter(Boolean).join(' / '); this.warning.setText(`⚠ ${ENEMY_MAP[charging.defId].name} · ${Math.max(0,(charging.chargeUntil-run.tick)/30).toFixed(1)}s\n${immunity || '蓄力中 · 可用控場打斷'}`); }
    const shield = run.shields.reduce((sum, s) => sum + s.value, 0);
    if (shield > 0) { g.fillStyle(0x69eedc, .08).fillRect(0, 432, 390, 18); }
    this.drawWarnings(run);
    // Rasterize unchanged geometry once. The same 390×520 detail is retained;
    // WebGL no longer re-tessellates hundreds of identical circles every frame.
    this.worldTexture.clear().draw(this.worldGraphics);
  }
  private drawWarnings(run: RunState) {
    const g = this.warnings; g.clear();
    for (const e of run.enemies) if (e.chargeKind && !e.chargeCancelled) {
      const r = enemySize(e.defId) * .65;
      g.fillStyle(0xff674e, .10).fillTriangle(e.x, e.y + r, e.x - 27, 450, e.x + 27, 450);
      g.lineStyle(2.5, 0xffa06e, 1).strokeCircle(e.x, e.y, r);
      if(e.defId.startsWith('B')) {
        const duration=(e.defId==='B03'?3:2)*30,progress=Math.max(0,Math.min(1,1-(e.chargeUntil-run.tick)/duration));
        g.lineStyle(5,0xffd58c,.9).beginPath().arc(e.x,e.y,r+5,-Math.PI/2,-Math.PI/2+progress*Math.PI*2,false).strokePath();
        g.lineStyle(3,0xff9b73,.85).strokeEllipse(e.x,448,70+progress*45,14);
      }
      g.fillStyle(0xffa06e,.8).fillTriangle(e.x-4,444,e.x+4,444,e.x,450);
    }
  }
  update() {
    const run = this.read(); if (!this.graphics || !this.actors) return;
    const elapsed = this.game.loop.rawDelta;
    this.slowFrames = elapsed > 20 ? Math.min(30, this.slowFrames + 1) : Math.max(0, this.slowFrames - .25);
    this.detail = effectDetail(this.low(), run.enemies.length, run.projectiles.length, this.slowFrames);
    const fresh = run.events.filter(e => e.seq > this.lastSeq); this.lastSeq = run.eventSeq;
    this.actors.update(run, elapsed, fresh, this.detail, this.low());
    const key = `${run.tick}:${run.actionSeq}:${run.eventSeq}:${run.phase}:${run.enemies.length}:${run.projectiles.length}:${run.fields.length}:${run.shields.length}:${this.detail}`;
    if (run !== this.worldRun || key !== this.worldKey) { this.worldRun = run; this.worldKey = key; this.drawWorld(run); }
    const now = this.actors.clock;
    this.statuses.update(run, now, fresh, this.detail);
    this.weaknesses.update(run);
    this.bossAssault.update(run,now,fresh,this.low());
    this.entrance.update(run, this.detail);
    const rangeKey = `${key}:${this.selectedRange()}`;
    if (rangeKey !== this.rangeKey) { this.rangeKey = rangeKey; drawRange(this.rangeGraphics, run, this.selectedRange()); }
    this.flashes = this.flashes.filter(f => now - f.born < f.duration);
    fresh.forEach(event => { this.audio.event(event); if (event.kind !== 'spawn' && event.skill !== 'burn') this.flashes.push({ event, born: now, duration: effectLifetime(event) }); });
    this.flashes = capEffects(this.flashes, this.detail); this.peakEffects = Math.max(this.peakEffects, this.flashes.length);
    this.graphics.clear();
    for (const effect of this.flashes) {
      const kind = effect.event.kind;
      if (kind === 'interrupt') drawInterrupt(this.graphics, effect, now);
    }
    this.materials.update(run, this.flashes, now, this.detail, this.actors.origin);
    this.projectiles.update(run, this.actors.origin);
    if (now >= this.endingAt) this.endingDone?.();
  }
  playVictoryEnding(): Promise<void> {
    // Let the final defeated actor collapse before the result screen destroys the scene.
    // The simulation is already ended and the completed profile is already being saved.
    this.endingAt = this.actors.clock + 900;
    return new Promise(resolve => {
      const done = () => { this.endingAt = Infinity; this.endingDone = null; this.events.off(Phaser.Scenes.Events.SHUTDOWN, done); resolve(); };
      this.endingDone = done;
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, done);
    });
  }
  diagnostics() {
    const bounds = this.warning.getBounds(), selected = this.selectedRange(), run = this.read();
    return { ...this.actors.diagnostics(), ...this.materials.diagnostics(), ...this.projectiles.diagnostics(), ...this.statuses.diagnostics(), ...this.weaknesses.diagnostics(), ...this.bossAssault.diagnostics(),
      bossIntro: run.bossIntro ? { ...run.bossIntro, type: run.enemies.find(e => e.id === run.bossIntro?.enemyId)?.defId, visible: true, depth: 30 } : null,
      range: selected ? { id: selected, radius: weaponRange(run, selected), insideIds: run.enemies.filter(e => inWeaponRange(run, selected, e)).map(e => e.id) } : null, detail: this.detail, activeEffects: this.flashes.length, peakEffects: this.peakEffects,
      warnings: { visible: this.warning.visible, text: this.warning.text, top: bounds.top, bottom: bounds.bottom, depth: this.warning.depth, geometryDepth: this.warnings.depth },
      textureFrames: Object.fromEntries(this.read().config.squadIds.map(id => [id, this.textures.get(`motion-${id}`).frameTotal - 1])),
      effectsDepth: this.graphics.depth, alliesDepth: LAYERS.allies,
      visibleEffects: this.flashes.map(f => ({ seq: f.event.seq, kind: f.event.kind, source: f.event.source, age: this.actors.clock - f.born, duration: f.duration })),
      enemyTextureFrames: Object.fromEntries([...this.spriteKeys].map(([id, key]) => [id, this.textures.get(key).frameTotal - 1])),
    };
  }

}

export function createBattleCanvas(parent: HTMLElement, read: () => RunState, audio: GameAudio, low: () => boolean, loading: SceneLoading, speed: () => BattleSpeed = () => 1, selectedRange: () => CharacterId | null = () => null, timeline = new TacticalTimeline()) {
  // Keep linear filtering for the illustrated sprites. The 2D canvas does not need
  // a multisampled WebGL backbuffer, whose resolves dominate dense mobile rendering.
  return new Phaser.Game({ type: Phaser.AUTO, width: parent.clientWidth, height: parent.clientHeight, parent, backgroundColor: '#102c35', antialias: true, audio: { noAudio: true }, scene: new BattleScene(read, audio, low, loading, speed, selectedRange, timeline), scale: { mode: Phaser.Scale.RESIZE }, render: { roundPixels: false, antialiasGL: false }, fps: { target: 60 } });
}
