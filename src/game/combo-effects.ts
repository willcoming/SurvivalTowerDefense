import type Phaser from 'phaser';
import { NaturalEffects, variation } from './natural-effects';
import type { RunState, VisualEvent } from '../sim/types';

const REACTIONS = {
  combo_vortex: { label:'烈焰黑洞', color:0xc89aff, text:'#ffb16f' },
  combo_superconduct: { label:'超導貫穿', color:0xe1f7ff, text:'#d7f7ff' },
  combo_emp: { label:'電磁引爆', color:0x62e4ff, text:'#81efff' },
  combo_overload: { label:'等離子過載', color:0xffd278, text:'#ffe393' },
};
type ReactionKind=keyof typeof REACTIONS;
export class ComboEffects {
  private visuals: NaturalEffects;
  private pool: Phaser.GameObjects.Text[]=[];
  private effects:{event:VisualEvent;kind:ReactionKind;born:number;label:Phaser.GameObjects.Text}[]=[];
  private count=0;
  constructor(private scene:Phaser.Scene){this.visuals=new NaturalEffects(scene,13,128);}
  update(_run:RunState,fresh:VisualEvent[],now:number,reduced:boolean){
    for(const effect of this.effects)if(now-effect.born>=500){effect.label.setVisible(false);this.pool.push(effect.label);}
    this.effects=this.effects.filter(effect=>now-effect.born<500);
    for(const event of fresh){
      if(!(event.kind in REACTIONS))continue;
      const existing=this.effects.find(f=>f.kind===event.kind&&f.event.targetId===event.targetId);
      if(existing){existing.event=event;existing.born=now;this.count++;continue;}
      if(this.effects.length>=8){const old=this.effects.shift()!;old.label.setVisible(false);this.pool.push(old.label);}
      const kind=event.kind as ReactionKind,info=REACTIONS[kind];
      const label=this.pool.pop()??this.scene.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'16px',fontStyle:'bold',stroke:'#071a28',strokeThickness:4}).setOrigin(.5).setDepth(14);
      label.setText(info.label).setColor(info.text).setVisible(true);
      if(kind==='combo_vortex'){
        const gradient=label.context.createLinearGradient(0,0,0,24);gradient.addColorStop(0,'#cda8ff');gradient.addColorStop(1,'#ffac6a');label.setFill(gradient);
      }
      this.effects.push({event,kind,born:now,label});this.count++;
    }
    const v=this.visuals;v.begin();const aspect=v.aspect,slots=new Map<number|undefined,number>();
    for(const effect of this.effects){
      const t=(now-effect.born)/500,fade=1-t,{x,y,seq}=effect.event;
      const slot=slots.get(effect.event.targetId)??0;slots.set(effect.event.targetId,slot+1);
      effect.label.setPosition(Math.max(48,Math.min(342,x)),Math.max(20,y-38-slot*19-(reduced?0:t*14))).setScale(1,aspect).setAlpha(fade);
      if(effect.kind==='combo_vortex'){
        // Torn smoke and embers, with no portal disk or evenly spaced orbit.
        v.glow(x,y,38,0x9e66bd,fade*.18);
        for(let i=0;i<3;i++){
          const a=variation(seq,i)*Math.PI*2+(reduced?0:t*.8),r=(8+i*5)*(1-t*.65);
          v.draw('combat-props',5,x+Math.cos(a)*r,y+Math.sin(a)*r*aspect,36+i*6,fade*.32,a*57,0x846597);
        }
        for(let i=0;i<9;i++){
          const seed=variation(seq,i+10),life=Math.min(1,t*(.85+seed*.4));
          const a=variation(seq,i+30)*Math.PI*2+(reduced?0:life*life*(2+seed*3));
          const r=(14+46*seed)*(reduced?.55:1-life*life);
          const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r*aspect;
          v.glow(px,py,3+seed*4,i%3?0xffb269:0xb590d9,fade*(.45+seed*.4));
        }
      }else if(effect.kind==='combo_emp'){
        v.glow(x,y,reduced?54:32+t*68,0x82e0f5,fade*.32);
        v.draw('combat-props',5,x,y,48+t*25,fade*.17,variation(seq,1)*360,0x67a7bd);
        v.draw('combat-props',12,x,y,24,Math.max(0,1-t*4)*.55,variation(seq,2)*360,0xb8edff);
      }else if(effect.kind==='combo_superconduct'){
        v.glow(x,y,25,0xc0edff,Math.max(0,1-t*5)*(reduced?.3:.7));
        v.draw('combat-props',12,x,y,25,Math.max(0,1-t*3)*.55,variation(seq,1)*360,0xb8e9ff);
        for(let i=0;i<6;i++){
          const seed=variation(seq,i+12),a=variation(seq,i+22)*Math.PI*2,r=(10+40*seed)*(reduced?.5:Math.sqrt(t));
          v.glow(x+Math.cos(a)*r,y+Math.sin(a)*r*aspect,2+seed*3,0xc5f0ff,fade*.85);
        }
      }else{
        v.glow(x,y,32,0xffdba0,fade*.2);
        v.draw('combat-props',6,x,y,36+t*12,fade*.75,variation(seq,1)*360,0xffd098);
        for(let i=0;i<5;i++){
          const seed=variation(seq,i+4),a=variation(seq,i+20)*Math.PI*2,r=(8+22*seed)*(reduced?.6:t);
          v.glow(x+Math.cos(a)*r,y+Math.sin(a)*r*aspect,2+seed*2,0xffd58c,fade*.75);
        }
      }
    }
    v.end();
  }
  diagnostics(){return {combos:{count:this.count,labels:this.effects.map(f=>({kind:f.kind,text:f.label.text,targetId:f.event.targetId})),allocated:this.effects.length+this.pool.length,drawCommands:this.visuals.active,sprites:this.visuals.allocated}};}
}
