import type Phaser from 'phaser';
import type { DamageType,RunState,VisualEvent } from '../sim/types';
import { attackType,ELEMENTS } from '../data/forms';
import { AreaCueStore } from './area-cues';
import type { Detail } from './presentation';
/** World geometry stays in simulation coordinates, below actors and all HUD text. */
export class AreaEffects {
 private store=new AreaCueStore();private run:RunState|null=null;
 private g:Phaser.GameObjects.Graphics;
 private sprites:Phaser.GameObjects.Image[]=[];private used=0;private peak=0;private limit=160;
 private bodies:{seq:number;type:DamageType;parts:number}[]=[];
 private fieldBodies:{id:number;parts:number}[]=[];
 private aspect=1;
 private sprite(key:string,frame:number,x:number,y:number,size:number,alpha:number,angle=0,width=size){
  if(this.used>=this.limit||alpha<=0)return;
  let image=this.sprites[this.used++];if(!image){image=this.g.scene.add.image(x,y,key,frame);this.sprites.push(image);}
  image.setTexture(key,frame).setVisible(true).setPosition(x,y).setDisplaySize(width,size*this.aspect).setAlpha(alpha).setAngle(angle).setDepth(2.25).clearTint();
 }
 /** Atlas bodies expand and dissolve inside the real footprint; actors remain above them. */
 private volume(type:DamageType,x:number,y:number,r:number,t:number,seed:number,detail:Detail){
  const first=this.used,phase=Math.min(3,Math.floor(t*4)),fade=Math.max(0,1-t);
  const frame=(type==='arc'?8:type==='gravity'?12:type==='thermal'?4:0)+phase;
  const key=type==='kinetic'?'combat-props':'combat-fx',actualFrame=type==='kinetic'?12+phase:frame;
  const core=Math.min(132,r*(.9+.3*Math.sin(Math.PI*t)));
  this.sprite(key,actualFrame,x,y,core,fade*.82,type==='gravity'?t*100:0);
  const count=detail==='compact'?2:5;
  for(let i=0;i<count;i++){
   const a=seed*.73+i*Math.PI*2/count+(type==='gravity'?t*1.4:0);
   const distance=r*(type==='gravity'?.55*(1-t):.16+.44*t);
   this.sprite(key,actualFrame,x+Math.cos(a)*distance,y+Math.sin(a)*distance,
    Math.min(52,r*.42)*(type==='gravity'?1.1:1+t*.35),fade*(detail==='compact'?.4:.55),a*180/Math.PI);
  }
  if(detail==='full'&&(type==='thermal'||type==='kinetic')&&t>.25)
   this.sprite('combat-props',5,x,y-r*.07*t,Math.min(90,r*.95),Math.sin(t*Math.PI)*.18);
  return this.used-first;
 }
 private fieldVolume(type:DamageType,x:number,y:number,r:number,now:number,id:number,detail:Detail){
  const first=this.used,row=type==='arc'?8:type==='gravity'?12:type==='thermal'?4:0;
  this.sprite('combat-fx',row+2,x,y,Math.min(122,r*1.2),.33, type==='gravity'?now/55:Math.sin(now/900)*10);
  const count=detail==='compact'?2:5;
  for(let i=0;i<count;i++){
   const cycle=((now/1600+i/count+id*.17)%1),a=i*Math.PI*2/count+id*.5+(type==='gravity'?cycle*1.8:0);
   const reach=r*(type==='gravity'?.68*(1-cycle):.35+.32*cycle),fade=Math.sin(cycle*Math.PI);
   this.sprite('combat-fx',row+(type==='gravity'?1:cycle<.5?1:2),x+Math.cos(a)*reach,y+Math.sin(a)*reach,
    Math.min(38,r*.35),fade*.34,a*180/Math.PI);
  }
  return this.used-first;
 }
 private fields:{id:number;x:number;y:number;radius:number}[]=[];
 constructor(scene:Phaser.Scene){this.g=scene.add.graphics().setDepth(2);}
 update(run:RunState,events:readonly VisualEvent[],now:number,detail:Detail){
  if(run!==this.run){this.run=run;this.store=new AreaCueStore();}
  this.store.update(events,now);const g=this.g;g.clear();
  this.used=0;this.bodies=[];this.fieldBodies=[];this.limit=detail==='compact'?88:160;
  this.aspect=Math.min(1.6,g.scene.cameras.main.zoomX/g.scene.cameras.main.zoomY);
  for(const f of run.fields)if(f.expires>run.tick)this.fieldBodies.push({id:f.id,parts:this.fieldVolume(f.damageType??attackType(run,f.source),f.x,f.y,f.radius,now,f.id,detail)});
  for(const cue of this.store.cues){
   const e=cue.event,t=Math.max(0,(now-cue.born)/cue.duration),alpha=(1-t)*.85;
   const color=parseInt((e.color??'#ffd18a').slice(1),16),r=e.radius??0;
   if(e.areaShape==='wall-band'){g.fillStyle(color,.04*(1-t)).fillRect(0,e.y,390,520-e.y);g.lineStyle(2,color,alpha).strokeRect(1,e.y,388,519-e.y);}
   else if(e.areaShape==='world'){g.fillStyle(color,.035*(1-t)).fillRect(0,0,390,450);g.lineStyle(2,color,alpha).strokeRect(2,2,386,446);}
   else if(e.areaShape==='line'){
    const x2=e.x2??e.x,y2=e.y2??e.y,angle=Math.atan2(y2-e.y,x2-e.x),dx=Math.sin(angle)*r,dy=-Math.cos(angle)*r;
    g.fillStyle(color,.10*(1-t)).fillPoints([{x:e.x+dx,y:e.y+dy},{x:x2+dx,y:y2+dy},{x:x2-dx,y:y2-dy},{x:e.x-dx,y:e.y-dy}],true);
    g.lineStyle(1.5,color,alpha).beginPath().moveTo(e.x+dx,e.y+dy).lineTo(x2+dx,y2+dy).moveTo(e.x-dx,e.y-dy).lineTo(x2-dx,y2-dy).strokePath();
   }else{
    const type=e.damageType??(e.source?attackType(run,e.source):'thermal');
    this.bodies.push({seq:e.seq,type,parts:this.volume(type,e.x,e.y,r,t,e.seq,detail)});
    g.fillStyle(color,(detail==='compact'?.045:.075)*(1-t)/Math.max(1,this.store.cues.length/4)).fillCircle(e.x,e.y,r);
    g.lineStyle(1.25,color,alpha*.7).strokeCircle(e.x,e.y,r);
    if(detail==='full')g.lineStyle(1,color,alpha*.25).strokeCircle(e.x,e.y,r*(.5+.5*t));
   }
  }
  this.fields=run.fields.filter(f=>f.expires>run.tick).map(f=>({id:f.id,x:f.x,y:f.y,radius:f.radius}));
  for(const f of run.fields){if(f.expires<=run.tick)continue;const color=parseInt(ELEMENTS[f.damageType??attackType(run,f.source)].color.slice(1),16);
   g.fillStyle(color,.025).fillCircle(f.x,f.y,f.radius);g.lineStyle(1.25,color,.48).strokeCircle(f.x,f.y,f.radius);
  }
  for(let i=this.used;i<this.sprites.length;i++)this.sprites[i].setVisible(false);
  this.peak=Math.max(this.peak,this.used);
 }
 diagnostics(){return {areaEffects:{depth:this.g.depth,volumeDepth:2.25,volume:{active:this.used,allocated:this.sprites.length,peak:this.peak,limit:this.limit,bodies:this.bodies,fields:this.fieldBodies},active:this.store.cues.map(c=>({seq:c.event.seq,shape:c.event.areaShape??'circle',x:c.event.x,y:c.event.y,x2:c.event.x2,y2:c.event.y2,radius:c.event.radius,source:c.event.source,skill:c.event.skill,affectedIds:c.event.affectedIds,born:c.born,duration:c.duration})),fields:this.fields}};}
}
