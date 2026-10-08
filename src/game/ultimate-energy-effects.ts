import type Phaser from 'phaser';
import { NaturalEffects } from './natural-effects';
import { hasUltimate } from '../sim/ultimates';
import { ultimateForForm, usesReworkedSkills } from '../data/reworked-skills';
import { attackType, ELEMENTS } from '../data/forms';
import { CHARACTER_MAP } from '../data/content';
import type { Origin } from './effects';
import type { CharacterId, DamageType, RunState, VisualEvent } from '../sim/types';

const COLORS: Record<DamageType, number> = { thermal:0xffad57, plasma:0xa7b8ff, arc:0x83dcff, gravity:0x68dfbf, kinetic:0xddeaff };
const TITLES: Partial<Record<CharacterId, string>> = {
  C01:'瑪音 · 【軌道聚焦炎爆】', C02:'雷娜 · 【廣域超導爆震】', C03:'凜月 · 【極限貫穿光矛】',
  C04:'米菈 · 【引力塌縮黑洞】', C05:'芙蕾 · 【集束微型飛彈】',
};
interface Banner { source:CharacterId; title:string; element:string; color:number; born:number }
interface EnergyBar { id:CharacterId; x:number; y:number; width:number; height:number; progress:number; ready:boolean; color:number }

/** Energy stays below portraits; this module owns the single cooldown track. */
export class UltimateEnergyEffects {
  private bars: Phaser.GameObjects.Graphics;
  private floor: NaturalEffects;
  private glints: NaturalEffects;
  private dim: Phaser.GameObjects.Rectangle;
  private banner: Phaser.GameObjects.Container;
  private plate: Phaser.GameObjects.Graphics;
  private element: Phaser.GameObjects.Text;
  private title: Phaser.GameObjects.Text;
  private queue: Banner[] = [];
  private current: Banner | null = null;
  private lastCast = -Infinity;
  private lastNow = 0;
  private progress = new Map<CharacterId,number>();
  private energyBars: EnergyBar[] = [];
  private castCount = 0;
  private recent: { source:CharacterId; born:number }[] = [];
  constructor(private scene:Phaser.Scene) {
    this.bars=scene.add.graphics().setDepth(8);
    this.floor=new NaturalEffects(scene,6,24);
    this.glints=new NaturalEffects(scene,8.1,24);
    // Above scenery, below combatants and luminous attacks; never covers portraits.
    this.dim=scene.add.rectangle(195,212.5,390,425,0x020b16,0).setDepth(1.8);
    this.plate=scene.add.graphics();
    this.element=scene.add.text(-164,0,'',{fontFamily:'sans-serif',fontSize:'10px',fontStyle:'bold',color:'#a7dfea'}).setOrigin(0,.5);
    this.title=scene.add.text(-109,0,'',{fontFamily:'sans-serif',fontSize:'12px',fontStyle:'bold',color:'#fff0ce'}).setOrigin(0,.5);
    this.banner=scene.add.container(195,435,[this.plate,this.element,this.title]).setDepth(19).setVisible(false);
  }
  update(run:RunState,fresh:VisualEvent[],now:number,reduced:boolean,origin:Origin) {
    const elapsed=Math.max(0,Math.min(80,now-this.lastNow));this.lastNow=now;
    for(const event of fresh)if(event.kind==='tactical'&&event.skill==='ultimate'&&event.source&&run.config.squadIds.includes(event.source)){
      const source=event.source,type=attackType(run,source);
      this.queue.push({source,title:TITLES[source]??`${CHARACTER_MAP[source].name} · 【${ultimateForForm(source,run.config.forms?.[source]).name}】`,element:ELEMENTS[type].name,color:COLORS[type],born:now});
      this.recent.push({source,born:now});this.lastCast=now;this.castCount++;
    }
    this.queue=this.queue.slice(-8);this.recent=this.recent.filter(c=>now-c.born<650);
    const age=now-this.lastCast;
    this.dim.setAlpha(reduced?0:age<180?.2:Math.max(0,.2*(1-(age-180)/120)));
    this.bars.clear();this.floor.begin();this.glints.begin();this.energyBars=[];
    if(usesReworkedSkills(run))run.config.squadIds.forEach((id,i)=>{
      const weapon=run.weapons.find(w=>w.id===id);if(!weapon||!hasUltimate(run,id))return;
      const x=195+(i-(run.config.squadIds.length-1)/2)*70;
      const duration=ultimateForForm(id,run.config.forms?.[id]).cooldown*30;
      const value=Math.max(0,Math.min(1,1-((weapon.ultimateReadyAt??0)-run.tick)/duration));
      const previous=this.progress.get(id)??value;
      const progress=value<previous||value===1?value:previous+(value-previous)*Math.min(1,elapsed/90);
      this.progress.set(id,progress);
      const ready=value===1,color=ready?0xffd681:COLORS[attackType(run,id)];
      const pulse=reduced?.5:.5+.5*Math.sin(now*Math.PI*2/(ready?400:2200));
      const alpha=ready?.12+.06*pulse:.08+.08*progress+.02*pulse;
      this.floor.wash(x,506,36+20*progress,12+5*progress,color,alpha);
      if(ready)this.floor.ring(x,506,48,color,.08+.05*pulse,.3);
      const g=this.bars;
      g.fillStyle(0x263c49,.95).fillRoundedRect(x-23,513,46,5.5,1.5);
      g.fillStyle(0x06131e,.95).fillRoundedRect(x-22,514,44,3.5,1.5);
      const width=44*progress;
      if(width>.1)g.fillStyle(color,.95).fillRoundedRect(x-22,514,width,3.5,Math.min(1.5,width/2));
      // A clipped, low-contrast shimmer remains within the filled track.
      if(!reduced&&width>3){
        const sweep=((now/1900+i*.17)%1)*54-5;
        for(let n=0;n<7;n++){
          const px=sweep+n,left=Math.max(0,px),right=Math.min(width,px+1);
          if(right>left)g.fillStyle(0xffffff,.16*Math.sin(n/6*Math.PI)).fillRect(x-22+left,514,right-left,3.5);
        }
      }
      if(ready)this.glints.wash(x,516,48,6,0xffd784,.14+.05*pulse);
      if(progress>=.75){
        const p=origin(id);
        this.glints.glow(p.x,p.y,9,ready?0xffedbd:color,(ready?.2:.08)+.04*pulse);
      }
      this.energyBars.push({id,x,y:514,width:44,height:3.5,progress,ready,color});
    });
    this.floor.end();this.glints.end();
    if(this.current&&now-this.current.born>=590)this.current=null;
    if(!this.current&&this.queue.length){this.current=this.queue.shift()!;this.current.born=now;}
    this.banner.setVisible(!!this.current);
    if(this.current){
      const b=this.current,t=now-b.born,enter=Math.min(1,t/100),exit=Math.max(0,(t-450)/140);
      const aspect=this.scene.cameras.main.zoomX/this.scene.cameras.main.zoomY;
      this.banner.setScale(1,aspect).setPosition(195+(reduced?0:-((1-enter)**3)*90+exit*exit*75),435).setAlpha(Math.min(1,enter*2)*(1-exit));
      const g=this.plate;g.clear();
      g.fillStyle(0x071d2d,.94).fillPoints([{x:-177,y:-11},{x:166,y:-11},{x:177,y:0},{x:177,y:11},{x:-166,y:11},{x:-177,y:0}],true);
      g.fillStyle(b.color,.5).fillRect(-165,-10,322,1);
      g.fillStyle(0xffd88f,.16).fillRect(-156,10,320,1);
      this.element.setText(`[${b.element}]`);
      this.title.setText(b.title);
    }
  }
  diagnostics(){return {ultimateEnergy:{chargedCount:this.energyBars.filter(b=>!b.ready).length,readyCount:this.energyBars.filter(b=>b.ready).length,activeBursts:this.recent.length,
    bars:this.energyBars,castCount:this.castCount,dimAlpha:this.dim.alpha,banner:this.current?{source:this.current.source,title:this.current.title,y:435,height:22,visible:this.banner.visible,alpha:this.banner.alpha}:null,
    queued:this.queue.length,allocated:this.floor.allocated+this.glints.allocated}};}
}
