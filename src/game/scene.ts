import Phaser from 'phaser';
import { CHARACTER_MAP, ENEMY_MAP, STAGE_MAP } from '../data/content';
import type { RunState, VisualEvent } from '../sim/types';
import type { GameAudio } from './audio';
import { keyPixels } from './chroma';

const hex = (color: string) => parseInt(color.replace('#', ''), 16);
interface Flash { event: VisualEvent; life: number }
interface SceneLoading { ready: () => void; failed: (paths: string[]) => void; progress: (ratio: number) => void }
export class BattleScene extends Phaser.Scene {
  private read: () => RunState;
  private audio: GameAudio;
  private low: () => boolean;
  private graphics!: Phaser.GameObjects.Graphics;
  private creatures = new Map<number, Phaser.GameObjects.Image>();
  private allies: Phaser.GameObjects.Image[] = [];
  private warning!: Phaser.GameObjects.Text;
  private flashes: Flash[] = [];
  private lastSeq = 0;
  private spriteKeys = new Map<string, string>();
  private previousShields = new Map<number, number>(); private previousCharges = new Set<number>(); private previousCooldown = 0;
  private originX(id?: string) { const ids = this.read().config.squadIds; const i = ids.findIndex(c => c === id); return i < 0 ? 195 : 195 + (i - (ids.length - 1) / 2) * 70; }
  private loading: SceneLoading; private missing: string[] = [];
  constructor(read: () => RunState, audio: GameAudio, low: () => boolean, loading: SceneLoading) { super('battle'); this.read = read; this.audio = audio; this.low = low; this.loading = loading; }
  preload() {
    this.load.on('progress', (progress: number) => this.loading.progress(progress));
    this.load.on('loaderror', (file: Phaser.Loader.File) => { this.missing.push(String(file.src)); });
    const run = this.read();
    this.load.image('stage', `/assets/stages/${run.config.stageId}.webp`);
    run.config.squadIds.forEach(id => this.load.image(id, `/assets/characters/${id}-chibi.webp`));
    [...new Set([...STAGE_MAP[run.config.stageId].enemyIds, STAGE_MAP[run.config.stageId].bossId])].forEach(id => this.load.image(id, `/assets/enemies/${id}.webp`));
  }
  create() {
    [...this.read().config.squadIds, ...Object.keys(ENEMY_MAP)].forEach(id => {
      if (!this.textures.exists(id)) return;
      const source = this.textures.get(id).getSourceImage() as HTMLImageElement;
      const canvas = this.textures.createCanvas(`keyed-${id}`, source.width, source.height);
      if (!canvas) return;
      canvas.context.drawImage(source, 0, 0);
      keyPixels(canvas.context, source.width, source.height); canvas.refresh(); this.spriteKeys.set(id, `keyed-${id}`);
    });
    this.cameras.main.setBackgroundColor('#132c38');
    if (this.textures.exists('stage')) { const bg = this.add.image(195, 260, 'stage'); bg.setDisplaySize(390, 520).setAlpha(.60); }
    const shade = this.add.graphics(); shade.fillStyle(0x062732, .16).fillRect(0, 0, 390, 520);
    shade.lineStyle(1, 0x9be5db, .11);
    for (let x = 45; x <= 345; x += 75) { shade.beginPath().moveTo(x, 0).lineTo(x, 450).strokePath(); }
    shade.fillStyle(0x102630, .84).fillRect(0, 450, 390, 70);
    shade.lineStyle(3, 0x72ead8, .8).beginPath().moveTo(0, 450).lineTo(390, 450).strokePath();
    this.graphics = this.add.graphics().setDepth(5);
    const ids = this.read().config.squadIds;
    ids.forEach((id, i) => {
      const x = 195 + (i - (ids.length - 1) / 2) * 70;
      if (this.textures.exists(id)) { const image = this.add.image(x, 485, this.spriteKeys.get(id) ?? id).setDisplaySize(68, 68).setDepth(7); this.allies.push(image); }
      else { this.add.circle(x, 486, 21, hex(CHARACTER_MAP[id].color)).setDepth(7); this.add.text(x, 486, CHARACTER_MAP[id].name, { fontSize: '12px', color: '#102c35' }).setOrigin(.5).setDepth(8); }
      this.add.text(x, 518, `${this.read().config.captainId === id ? '★ ' : ''}${CHARACTER_MAP[id].name}`, { fontSize: '10px', fontFamily: 'sans-serif', color: '#fff7e7' }).setOrigin(.5, 1).setDepth(8);
    });
    this.warning = this.add.text(195, 35, '', { fontSize: '14px', fontFamily: 'sans-serif', color: '#fff7e7', backgroundColor: '#aa3933', padding: { x: 12, y: 6 }, wordWrap: { width: 340, useAdvancedWrap: true }, align: 'center' }).setOrigin(.5).setDepth(30).setVisible(false);
    this.lastSeq = this.read().eventSeq;
    if (this.missing.length) this.loading.failed(this.missing);
    else this.loading.ready();
  }
  update(_time: number, delta: number) {
    const run = this.read(); if (!this.graphics) return;
    const g = this.graphics; g.clear(); const currentIds = new Set(run.enemies.map(e => e.id));
    for (const [id, image] of this.creatures) if (!currentIds.has(id)) { image.destroy(); this.creatures.delete(id); }
    run.fields.forEach(f => {
      const c = f.kind === 'fire' ? 0xffaa55 : 0x65ecdc;
      g.fillStyle(c, .12).fillCircle(f.x, f.y, f.radius); g.lineStyle(1.5, c, .65).strokeCircle(f.x, f.y, f.radius);
      if (!this.low()) g.lineStyle(1, c, .4).strokeCircle(f.x, f.y, f.radius * (.5 + Math.sin(run.tick / 12 + f.id) * .12));
    });
    for (const enemy of run.enemies) {
      let image = this.creatures.get(enemy.id); const boss = enemy.defId.startsWith('B');
      const size = boss ? 106 : enemy.defId === 'E07' ? 60 : enemy.defId === 'E03' ? 48 : 39;
      if (!image && this.textures.exists(enemy.defId)) { image = this.add.image(enemy.x, enemy.y, this.spriteKeys.get(enemy.defId) ?? enemy.defId).setDisplaySize(size, size).setDepth(3); this.creatures.set(enemy.id, image); }
      if (image) { image.setPosition(enemy.x, enemy.y); if (enemy.effects.some(e => e.kind === 'stun')) image.setTint(0x7cffff); else image.clearTint(); }
      else { g.fillStyle(hex(ENEMY_MAP[enemy.defId].color), 1).fillCircle(enemy.x, enemy.y, enemy.radius); }
      const w = boss ? 84 : 26; const hpY = enemy.y - size / 2 - 4;
      if (enemy.hp < enemy.maxHp || boss) { g.fillStyle(0x091e25, .9).fillRect(enemy.x - w / 2, hpY, w, boss ? 5 : 3); g.fillStyle(boss ? 0xff8666 : 0xf2dab8).fillRect(enemy.x - w / 2, hpY, w * Math.max(0, enemy.hp / enemy.maxHp), boss ? 5 : 3); }
      if (enemy.shield > 0) { g.lineStyle(1.5, 0x7eebff, .75).strokeCircle(enemy.x, enemy.y, size * .47); }
      if (enemy.effects.some(e => e.kind === 'burn')) g.fillStyle(0xff983e, .6).fillCircle(enemy.x + 10, enemy.y + 10, 4);
      if (enemy.effects.some(e => e.kind === 'exposure') || enemy.exposureUntil > run.tick) g.lineStyle(2, 0xffdf64, 1).strokeCircle(enemy.x, enemy.y, size * .44);
      if (enemy.chargeKind && !enemy.chargeCancelled) {
        g.lineStyle(2, 0xff6955, .9).strokeCircle(enemy.x, enemy.y, size * .65);
        g.lineStyle(1, 0xff6955, .55).beginPath().moveTo(enemy.x, enemy.y + size / 2).lineTo(enemy.x, 450).strokePath();
        g.fillStyle(0xff6955, .18).fillTriangle(enemy.x, enemy.y + size / 2, enemy.x - 30, 450, enemy.x + 30, 450);
      }
    }
    const charging = run.enemies.find(e => e.chargeKind && !e.chargeCancelled);
    for (const e of run.enemies) {
      if (e.chargeKind && !e.chargeCancelled && !this.previousCharges.has(e.id)) this.audio.feedback('alert');
      if (e.shield <= 0 && (this.previousShields.get(e.id) ?? 0) > 0) this.audio.feedback('shield-break');
    }
    this.previousShields = new Map(run.enemies.map(e => [e.id, e.shield])); this.previousCharges = new Set(run.enemies.filter(e => e.chargeKind && !e.chargeCancelled).map(e => e.id));
    const cooldown = Math.max(0, run.tacticalReadyAt - run.tick);
    if (this.previousCooldown > 0 && cooldown === 0) this.audio.feedback('ready'); this.previousCooldown = cooldown;
    this.warning.setVisible(!!charging);
    if (charging) { const stun = Math.max(0, Math.ceil((charging.stunImmuneUntil - run.tick) / 30)), move = Math.max(0, Math.ceil((charging.moveImmuneUntil - run.tick) / 30)); const immunity = [stun ? `免暈 ${stun}s` : '', move ? `免位移 ${move}s` : ''].filter(Boolean).join(' / '); this.warning.setText(`⚠ ${ENEMY_MAP[charging.defId].name} 蓄力中\n${immunity || '可使用有效暈眩或位移打斷'}`); }
    for (const p of run.projectiles) {
      const c = p.enemyDamage ? 0xff624b : p.packet?.source ? hex(CHARACTER_MAP[p.packet.source].color) : 0x77ffec;
      let px = p.x, py = p.y;
      const origin = this.originX(p.packet?.source);
      if (p.impactAt) { const progress = Phaser.Math.Clamp(1 - (p.impactAt - run.tick) / 14, 0, 1); px = Phaser.Math.Linear(origin, p.tx, progress); py = Phaser.Math.Linear(490, p.ty, progress) - Math.sin(progress * Math.PI) * 55; }
      else if (p.packet) px += (origin - 195) * Phaser.Math.Clamp((p.y - p.ty) / (490 - p.ty || 1), 0, 1);
      g.fillStyle(c, .95).fillCircle(px, py, p.enemyDamage ? 5 : p.impactAt ? 4 : 2.8);
      if (!this.low()) g.lineStyle(p.enemyDamage ? 3 : 2, c, .55).beginPath().moveTo(px, py).lineTo(px - p.vx * .018, py - p.vy * .018 + (p.impactAt ? 10 : 0)).strokePath();
    }
    const shield = run.shields.reduce((sum, s) => sum + s.value, 0);
    if (shield > 0) { g.fillStyle(0x69eedc, .10).fillRect(0, 432, 390, 18); g.lineStyle(3, 0x9cffee, .8).beginPath().moveTo(0, 435).lineTo(390, 435).strokePath(); }
    const fresh = run.events.filter(e => e.seq > this.lastSeq); this.lastSeq = run.eventSeq;
    fresh.forEach(e => { if (e.kind !== 'hit' || !this.low()) this.flashes.push({ event: e, life: e.kind === 'evolution' ? 650 : e.kind === 'tactical' ? 420 : 180 }); this.audio.event(e); });
    this.flashes = this.flashes.filter(f => (f.life -= delta) > 0).slice(-100);
    for (const { event: e, life } of this.flashes) {
      const c = e.color ? hex(e.color) : e.source ? hex(CHARACTER_MAP[e.source].color) : 0xffb68b;
      const alpha = Math.min(.85, life / 180);
      if (e.kind === 'beam' || e.kind === 'arc') {
        const ex = e.y === 490 ? this.originX(e.source) : e.x;
        g.lineStyle(e.kind === 'beam' ? e.source === 'C03' ? 4 : 2 : 2, c, alpha).beginPath().moveTo(ex, e.y);
        if (e.kind === 'arc') { const x2 = e.x2 ?? e.x, y2 = e.y2 ?? e.y; g.lineTo((e.x + x2) / 2 + 8, (e.y + y2) / 2 - 5).lineTo((e.x + x2) / 2 - 6, (e.y + y2) / 2 + 7); }
        g.lineTo(e.x2 ?? e.x, e.y2 ?? e.y).strokePath();
      } else if (['explosion', 'tactical', 'evolution', 'death', 'interrupt'].includes(e.kind)) {
        const r = e.radius ?? (e.kind === 'death' ? 17 : 40); g.lineStyle(e.kind === 'evolution' ? 4 : 2, c, alpha).strokeCircle(e.x, e.y, r * (1.1 - Math.min(1, life / 300) * .4));
        if (e.kind !== 'death') g.fillStyle(c, alpha * .09).fillCircle(e.x, e.y, r);
      } else if (e.kind === 'wall-hit') { g.fillStyle(0xff634f, alpha * .25).fillRect(0, 435, 390, 25); }
      else if (e.kind === 'hit') g.fillStyle(c, alpha).fillCircle(e.x, e.y, 3);
    }
    for (const weapon of run.weapons) {
      if (weapon.rank < 3) continue;
      const x = this.originX(weapon.id); const color = hex(CHARACTER_MAP[weapon.id].color);
      g.lineStyle(1.5, color, .8).strokeEllipse(x, 497, 53, 13);
      if (weapon.id === 'C06') {
        const count = weapon.branch === 'A' ? 2 : 1;
        for (let i = 0; i < count; i++) { const dx = x + (i === 0 ? -23 : 23), dy = 460 + (this.low() ? 0 : Math.sin(run.tick / 16 + i) * 3); g.fillStyle(0xf0f5df, 1).fillTriangle(dx - 7, dy, dx + 7, dy, dx, dy - 6); g.fillStyle(color).fillCircle(dx, dy - 3, 2); }
      }
    }
    if (!this.low() && run.phase === 'running') this.allies.forEach((image, i) => image.y = 485 + Math.sin(run.tick / 14 + i) * 1.3);
  }
}

export function createBattleCanvas(parent: HTMLElement, read: () => RunState, audio: GameAudio, low: () => boolean, loading: SceneLoading) {
  return new Phaser.Game({ type: Phaser.AUTO, width: 390, height: 520, parent, backgroundColor: '#102c35', antialias: true, audio: { noAudio: true }, scene: new BattleScene(read, audio, low, loading), scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { roundPixels: false }, fps: { target: 60 } });
}
