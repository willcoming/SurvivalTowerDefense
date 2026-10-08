import type Phaser from 'phaser';
import { NaturalEffects, variation } from './natural-effects';
import type { RunState, VisualEvent } from '../sim/types';

interface Strike { x:number; y:number; born:number; color:number; heavy:boolean; seq:number; type:string }
/** Read-only local impact feedback begins on the actual damage event. */
export class BossAssault {
  private visuals: NaturalEffects;
  private label: Phaser.GameObjects.Text;
  private strikes: Strike[] = [];
  private impactAt = -Infinity;
  private damage = 0;
  private releaseCount = 0;
  constructor(private scene: Phaser.Scene) {
    this.visuals = new NaturalEffects(scene,89,48);
    this.label = scene.add.text(195,420,'',{fontFamily:'sans-serif',fontSize:'15px',fontStyle:'bold',color:'#ffe0ba',stroke:'#10202a',strokeThickness:4}).setOrigin(.5).setDepth(100).setVisible(false);
  }
  update(run:RunState, now:number, events:VisualEvent[], reduced:boolean) {
    this.label.setScale(1,this.scene.cameras.main.zoomX/this.scene.cameras.main.zoomY);
    for (const event of events) {
      if (event.kind !== 'wall-hit') continue;
      if (now-this.impactAt > 180) this.damage = 0;
      this.damage += event.value ?? 0; this.impactAt = now;
      if (!event.enemyDefId?.startsWith('B')) continue;
      const boss = run.enemies.find(e=>e.defId===event.enemyDefId);
      const heavy = event.enemyDefId==='B03';
      this.strikes.push({x:boss?.x??195,y:boss?.y??150,born:now,color:event.enemyDefId==='B02'?0x83e5ff:heavy?0xff8560:0xe2d27a,heavy,seq:event.seq,type:event.enemyDefId});
      this.releaseCount++;
      if (heavy && !reduced) this.scene.cameras.main.shake(100,.002);
    }
    this.strikes=this.strikes.filter(s=>now-s.born<500).slice(-6);
    const v=this.visuals;v.begin();
    for (const strike of this.strikes) {
      const t=(now-strike.born)/500,alpha=1-t;
      v.glow(195,446,strike.heavy?100:70,strike.color,alpha*.35);
      v.draw('combat-props',5,195,446-(reduced?0:t*10),45+t*35,alpha*.32,strike.seq*37,strike.color);
      if (!reduced) for(let i=0;i<5;i++) {
        const seed=variation(strike.seq,i),a=Math.PI*(1.05+variation(strike.seq,i+10)*.9),r=t*(15+seed*(strike.heavy?55:35));
        v.glow(195+Math.cos(a)*r,446+Math.sin(a)*r*v.aspect,2+seed*4,strike.color,alpha*.8);
      }
    }
    const age=now-this.impactAt;
    this.label.setVisible(age<700);
    if(age<700) {
      const blocked=this.damage===0;
      this.label.setText(blocked?'護盾擋下':`防線 −${Math.ceil(this.damage)}`).setColor(blocked?'#a4f6ee':'#ffcfad').setAlpha(age<450?1:(700-age)/250);
      v.glow(195,446,100,blocked?0x9cefe0:0xff7859,.25*Math.max(0,1-age/350));
    }
    v.end();
  }
  diagnostics() { return { bossAssault:{releases:this.releaseCount,active:this.strikes.map(s=>({seq:s.seq,type:s.type})),impactVisible:this.label.visible,impactText:this.label.text} }; }
}
