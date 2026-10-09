import type Phaser from 'phaser';
import { NaturalEffects, variation } from './natural-effects';
import type { Origin } from './effects';
import type { CharacterId, RunState, VisualEvent } from '../sim/types';

export const ownsUltimateVfx=(event:VisualEvent)=>event.skill==='ultimate'&&!!event.source&&['C01','C02','C03','C04','C05'].includes(event.source);
interface Cast { source:CharacterId; event:VisualEvent; born:number; from:{x:number;y:number}; echo:boolean }
/** Dedicated ultimate materials. No polygon explosion atlas is used here. */
export class UltimateBattlefieldEffects {
  private ground:NaturalEffects;
  private light:NaturalEffects;
  private flash:Phaser.GameObjects.Rectangle;
  private casts:Cast[]=[];
  private count=0;
  private shaken=new Set<string>();
  private fields:{id:number;x:number;y:number;radius:number;width:number;height:number}[]=[];
  constructor(private scene:Phaser.Scene){
    this.ground=new NaturalEffects(scene,2.3,160);
    this.light=new NaturalEffects(scene,10,240);
    this.flash=scene.add.rectangle(195,212.5,390,425,0xe0f7ff,0).setDepth(10.5);
  }
  private dust(v:NaturalEffects,c:Cast,t:number,color:number,count:number,reduced:boolean){
    for(let i=0;i<count;i++){
      const seed=variation(c.event.seq,i),angle=variation(c.event.seq,i+40)*Math.PI*2;
      const distance=(12+seed*68)*(reduced?.4:Math.sqrt(Math.min(1,t)));
      v.wash(c.event.x+Math.cos(angle)*distance,c.event.y+Math.sin(angle)*distance*v.aspect,2+seed*2,3+seed*4,color,(1-t)*(.35+seed*.4),angle*180/Math.PI);
    }
  }
  private fire(x:number,y:number,t:number,seed:number,reduced:boolean,scale=1){
    const g=this.ground,v=this.light,fade=Math.max(0,1-t);
    g.wash(x,y,145*scale,65*scale,0xeb682b,fade*.35);
    if(!reduced)g.ring(x,y,(42+210*t)*scale,0xffbf70,fade*.45,.6);
    // Frame 6 is the irregular rolling flame cloud, never a spiked flash frame.
    v.draw('combat-fx',6,x,y,(76+28*t)*scale,fade*.68,seed*29,0xffdfb0);
    for(let i=0;i<5;i++){
      const a=variation(seed,i)*Math.PI*2,r=(8+variation(seed,i+10)*32)*(reduced?.5:t)*scale;
      const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r*.6-t*12;
      v.draw('combat-props',5,px,py,(35+35*t)*scale,fade*.42,variation(seed,i+20)*360,0xa97454);
      v.glow(px,py,(42-18*t)*scale,0xff9b44,fade*.7);
      v.glow(px,py,(19-9*t)*scale,0xffefd0,fade*.65);
    }
  }
  update(run:RunState,fresh:VisualEvent[],now:number,reduced:boolean,origin:Origin){
    for(const event of fresh){
      if(!ownsUltimateVfx(event))continue;
      const primary=event.kind==='tactical';
      const echo=event.kind==='explosion'&&!fresh.some(e=>e.kind==='tactical'&&e.skill==='ultimate'&&e.source===event.source&&e.tick===event.tick);
      if(primary||echo){this.casts.push({source:event.source!,event,born:now,from:origin(event.source,event.x),echo});this.count++;}
    }
    this.casts=this.casts.filter(c=>now-c.born<(c.echo?700:1250)).slice(-10);
    const activeSeq=new Set(this.casts.map(c=>String(c.event.seq)));
    for(const key of this.shaken)if(!activeSeq.has(key.split(':')[0]))this.shaken.delete(key);
    const g=this.ground,v=this.light;g.begin();v.begin();this.flash.setAlpha(0);
    for(const c of this.casts){
      const age=now-c.born,t=Math.min(1,age/1000),fade=1-t,{x,y,seq}=c.event;
      if(c.echo){
        if(c.source==='C01'||c.source==='C05')this.fire(x,y,age/700,seq,reduced,.7);
        else g.ring(x,y,40+age*.15,0x93dfff,Math.max(0,1-age/700)*.32,.7);
        continue;
      }
      if(c.source==='C02'){
        if(!reduced)this.flash.setAlpha(Math.max(this.flash.alpha,.085*Math.max(0,1-age/75)));
        g.wash(x,y,200,105,0x318fbd,fade*.32);
        for(let i=0;i<2;i++){
          const p=(age-i*100)/650;
          if(p>=0&&p<1)g.ring(x,y,reduced?120:30+220*(1-(1-p)**2),i?0xbbefff:0x75c7ff,(1-p)*(reduced?.16:.6),.78);
        }
        v.glow(x,y,60,0xe7fbff,Math.max(0,1-age/170)*.85);
        this.dust(v,c,t,0xc9f5ff,reduced?7:28,reduced);
      }else if(c.source==='C01'){
        const beam=Math.max(0,1-age/290);
        if(beam>0){
          // Broad tapered light, with a white hot core; no stroked laser line.
          v.wash(x,y/2,82,(y+40)/v.aspect,0xf77b38,beam*.72);
          v.wash(x,y/2,28,(y+35)/v.aspect,0xffe4a9,beam*.95);
        }
        this.fire(x,y,t,seq,reduced);
        this.dust(v,c,t,0xffd18f,reduced?5:16,reduced);
      }else if(c.source==='C03'){
        const p=Math.min(1,age/160),dx=x-c.from.x,dy=(y-c.from.y)/v.aspect,angle=Math.atan2(dy,dx)*180/Math.PI;
        if(age<210&&!reduced){
          const px=c.from.x+(x-c.from.x)*p,py=c.from.y+(y-c.from.y)*p;
          v.wash(px,py,115,9,0xa5dfff,1-age/210,angle);
          v.wash(px,py,90,2.5,0xf2fbff,1-age/210,angle);
        }
        const core=Math.max(0,1-age/400);
        v.wash(x,y,72,5,0xe1f5ff,core*.85);v.wash(x,y,5,65,0xffffff,core*.7);
        v.glow(x,y,38,0xb2e3ff,core*.5);
        this.dust(v,c,t,0xd2ebff,reduced?5:20,reduced);
      }else if(c.source==='C05'){
        for(let i=0;i<5;i++){
          const local=age-i*75,flight=210;
          if(local<0)continue;
          const tx=x+(variation(seq,i)-.5)*65,ty=y+(variation(seq,i+6)-.5)*42;
          if(local<flight&&!reduced){
            const p=local/flight,side=(i-2)*35;
            const px=c.from.x+(tx-c.from.x)*p+Math.sin(p*Math.PI)*side;
            const py=c.from.y+(ty-c.from.y)*p-Math.sin(p*Math.PI)*55;
            const dx=tx-c.from.x+Math.cos(p*Math.PI)*Math.PI*side,dy=(ty-c.from.y-Math.cos(p*Math.PI)*Math.PI*55)/v.aspect;
            const angle=Math.atan2(dy,dx)*180/Math.PI;
            v.draw('combat-props',1,px,py,20,.95,angle);
            v.glow(px-Math.cos(angle*Math.PI/180)*8,py-Math.sin(angle*Math.PI/180)*8*v.aspect,17,0xffb66e,.5);
          }else{
            const hit=Math.max(0,(local-(reduced?0:flight))/700);
            if(hit<1)this.fire(tx,ty,hit,seq+i,reduced,.65);
            const key=`${seq}:${i}`;
            if(!reduced&&run.phase==='running'&&!this.shaken.has(key)){this.scene.cameras.main.shake(90,.004);this.shaken.add(key);}
          }
        }
      }
    }
    // The singularity remains for the actual simulation field lifetime.
    this.fields=[];
    for(const f of run.fields)if(f.ultimate&&['C01','C04'].includes(f.source)&&f.expires>run.tick){
      this.fields.push({id:f.id,x:f.x,y:f.y,radius:f.radius,width:f.radius*2.1,height:f.radius*2.1});
      const remaining=Math.min(1,(f.expires-run.tick)/15),r=f.radius;
      g.wash(f.x,f.y,r*2.1,r*2.1/g.aspect,f.source==='C01'?0xb74c21:0x351f51,.5*remaining);
      if(f.source==='C01'){
        for(let i=0;i<3;i++)g.draw('combat-props',5,f.x+(i-1)*r*.4,f.y-8,r*.7,.2*remaining,i*70,0xcb8558);
        continue;
      }
      g.ring(f.x,f.y,r*1.7,0x69d9b9,.4*remaining,.56);
      for(let i=0;i<5;i++){
        const angle=i*2.399+(reduced?0:now/720),reach=r*(.3+.07*(i%3));
        g.draw('combat-props',5,f.x+Math.cos(angle)*reach,f.y+Math.sin(angle)*reach*.45,r*.8,.25*remaining,angle*180/Math.PI,0x4ac6aa);
      }
      g.void(f.x,f.y,r*1.15,.95*remaining);
    }
    g.end();v.end();
  }
  diagnostics(){return {ultimateBattlefield:{count:this.count,active:this.casts.map(c=>({source:c.source,seq:c.event.seq,echo:c.echo,x:c.event.x,y:c.event.y})),fields:this.fields,
    sprites:this.ground.active+this.light.active,allocated:this.ground.allocated+this.light.allocated,flashAlpha:this.flash.alpha}};}
}
