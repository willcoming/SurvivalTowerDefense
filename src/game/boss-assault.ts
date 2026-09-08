import type Phaser from 'phaser';
import type { RunState, VisualEvent } from '../sim/types';

interface Strike { x:number; y:number; born:number; color:number; heavy:boolean; seq:number; type:string }
/** Read-only feedback: the beam and impact begin on the actual damage event. */
export class BossAssault {
  private graphics: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private strikes: Strike[] = [];
  private impactAt = -Infinity;
  private damage = 0;
  private releaseCount = 0;
  constructor(private scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(89);
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
    const g=this.graphics;g.clear();
    for (const strike of this.strikes) {
      const t=(now-strike.born)/500,alpha=1-t;
      // Instant beam conveys the already-resolved hit; trailing rings never imply delayed damage.
      g.lineStyle((strike.heavy?10:5)*(1-t*.65),strike.color,alpha*.75);
      g.beginPath().moveTo(strike.x,strike.y+18).lineTo(195,450).strokePath();
      g.lineStyle(2,0xfff4dc,alpha*.85).beginPath().moveTo(strike.x,strike.y+18).lineTo(195,450).strokePath();
      g.lineStyle(3,strike.color,alpha).strokeEllipse(195,446,30+t*(strike.heavy?230:140),10+t*22);
      if (!reduced) for(let i=0;i<7;i++) {
        const a=Math.PI+(i/6)*Math.PI,r=12+t*(strike.heavy?70:45);
        g.fillStyle(strike.color,alpha).fillCircle(195+Math.cos(a)*r,446+Math.sin(a)*r,2*(1-t)+1);
      }
    }
    const age=now-this.impactAt;
    this.label.setVisible(age<700);
    if(age<700) {
      const blocked=this.damage===0;
      this.label.setText(blocked?'護盾擋下':`防線 −${Math.ceil(this.damage)}`).setColor(blocked?'#a4f6ee':'#ffcfad').setAlpha(age<450?1:(700-age)/250);
      g.fillStyle(blocked?0x9cefe0:0xff7859,.35*Math.max(0,1-age/350)).fillRect(0,444,390,9);
    }
  }
  diagnostics() { return { bossAssault:{releases:this.releaseCount,active:this.strikes.map(s=>({seq:s.seq,type:s.type})),impactVisible:this.label.visible,impactText:this.label.text} }; }
}
