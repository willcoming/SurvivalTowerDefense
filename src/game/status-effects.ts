import type Phaser from 'phaser';
import { ELEMENTS, usesCollection } from '../data/forms';
import type { Effect, RunState, VisualEvent } from '../sim/types';
import type { Detail } from './presentation';
import { priorityEnemy } from './presentation';
import { enemySize } from './actors';

type Status = Effect['kind'];
const statuses: Status[] = ['burn', 'slow', 'stun', 'exposure'];
export class StatusEffects {
  private sprites = new Map<number, Map<Status, Phaser.GameObjects.Image>>();
  private labels: { text: Phaser.GameObjects.Text; born: number; value: number; x: number; y: number; key: string; prefix:string; color:string }[] = [];
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
      g.clear();
      // Compact solid stars communicate stun without orbit rings or connecting strokes.
      for(let i=0;i<3;i++){
        const x=16+i*16,y=32+(i===1?-7:4);
        g.fillStyle(0xffef9a,1).fillTriangle(x-6,y,x+6,y,x,y-9).fillTriangle(x-6,y-4,x+6,y-4,x,y+5);
      }
      g.generateTexture(`status-stun-${frame}`, 64, 64);
    }
    g.clear().fillStyle(0x67f7dc,1);
    g.fillTriangle(12,17,52,17,32,36).fillTriangle(12,34,52,34,32,53);
    g.generateTexture('status-slow',64,64);
    g.clear().fillStyle(0xffdc66,1).fillTriangle(10,15,54,15,32,53);
    g.generateTexture('status-exposure',64,64);
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
    for (let i = 0; i < 12; i++) this.labels.push({ text: scene.add.text(0, 0, '', { fontSize: '13px', fontStyle: 'bold', fontFamily: 'sans-serif', color: '#ffcf78', stroke: '#28120b', strokeThickness: 3 }).setOrigin(.5).setDepth(12).setVisible(false), born: -Infinity, value: 0, x: 0, y: 0, key: '',prefix:'燃',color:'#ffcf78' });
  }
  update(run: RunState, now: number, fresh: VisualEvent[], detail: Detail) {
    const ids = new Set(run.enemies.map(e => e.id));
    for (const [id, sprites] of this.sprites) if (!ids.has(id)) { sprites.forEach(s => s.destroy()); this.sprites.delete(id); }
    this.visible = [];
    const frame = Math.floor(now / 130) % 4;
    for (const enemy of run.enemies) {
      const active = new Set(enemy.effects.filter(f => f.expires > run.tick).map(f => f.kind));
      if (enemy.exposureUntil > run.tick) active.add('exposure');
      if (run.enemies.length>=24 && !priorityEnemy(enemy)) {
        // Body tint still communicates burning; reserve large overlays for urgent control cues.
        active.delete('burn'); active.delete('slow');
      }
      // Dense battles already show burn through body tint and merged damage labels.
      // Keep the large flame only on bosses; it otherwise hides a crowd's actual poses.
      if (detail === 'compact' && !enemy.defId.startsWith('B')) active.delete('burn');
      if (enemy.hp <= 0 || run.bossIntro?.enemyId === enemy.id) active.clear();
      let sprites = this.sprites.get(enemy.id);
      if (!sprites && active.size) { sprites = new Map(); this.sprites.set(enemy.id, sprites); }
      if (!sprites) continue;
      const size = enemySize(enemy.defId);
      for (const status of statuses) {
        let sprite = sprites.get(status); const key = `status-${status}${status === 'burn' || status === 'stun' ? `-${frame}` : ''}`;
        if (active.has(status)) {
          if (!sprite) {
            sprite = this.scene.add.image(0, 0, 'status-atlas', key).setDepth(8.5).setDisplaySize(16,16); sprites.set(status, sprite);
          }
          const element = enemy.effects.find(f => f.kind === 'burn')?.damageType ?? 'thermal';
          const row = { plasma: 0, thermal: 1, arc: 2, gravity: 3, kinetic: 0 }[element];
          if (status === 'burn') sprite.setTexture('combat-fx', row * 4 + 1 + frame % 2);
          else if (sprite.texture.key !== 'status-atlas' || sprite.frame.name !== key) sprite.setTexture('status-atlas', key);
          if(status==='burn'){const effect=enemy.effects.find(f=>f.kind==='burn'),element=effect?.damageType;if(usesCollection(run)&&element)sprite.setTint(parseInt(ELEMENTS[element].color.slice(1),16));else sprite.clearTint();}
          const controlStates=statuses.filter(state=>state!=='burn'&&active.has(state));
          const width=status==='burn'?size*(detail==='compact'?.32:.46):enemy.defId.startsWith('B')?18:14;
          sprite.setDisplaySize(width,width*this.scene.cameras.main.zoomX/this.scene.cameras.main.zoomY);
          const slot=controlStates.indexOf(status);
          sprite.setVisible(true).setPosition(
            status==='burn'?enemy.x:enemy.x+size*.45+8,
            status==='burn'?enemy.y+size*.2:enemy.y-size*.35+slot*16
          );
        } else sprite?.setVisible(false);
      }
      if (active.size) this.visible.push({ id: enemy.id, states: [...active] });
    }
    const limit = run.enemies.length>=24 ? 4 : detail === 'compact' ? 6 : 12;
    for (const event of fresh) if (event.kind === 'hit' && event.skill === 'burn' && (event.value ?? 0) > 0) {
      const key = `${event.damageType??'thermal'}:`+(detail === 'compact' ? `${Math.floor(event.x / 65)}:${Math.floor(event.y / 50)}` : String(event.targetId));
      let label = this.labels.slice(0, limit).find(l => l.key === key && now - l.born < 700);
      if (!label) { label = this.labels.slice(0, limit).find(l => now - l.born >= 700); if (!label) continue; label.key = key; label.value = 0; label.born = now; label.x = event.x; label.y = event.y - 24; }
      label.value += event.value!;label.prefix=event.damageType?ELEMENTS[event.damageType].dot:'燃';label.color=event.damageType?ELEMENTS[event.damageType].color:'#ffcf78';
    }
    // Upload each merged label at most once per frame, rather than once per damage event.
    this.labels.forEach((label, i) => { const t = (now - label.born) / 700, visible = i < limit && t >= 0 && t < 1; label.text.setScale(1,this.scene.cameras.main.zoomX/this.scene.cameras.main.zoomY).setVisible(visible); if (visible) label.text.setText(`${label.prefix} ${Number(label.value.toFixed(1))}`).setColor(label.color).setPosition(label.x, label.y - t * 20).setAlpha(t < .6 ? 1 : (1 - t) / .4); });
  }
  diagnostics() { return { statuses: this.visible, burnNumbers: this.labels.filter(l => l.text.visible).map(l => ({ value: l.value, text: l.text.text, born: l.born })) }; }
}
