import { impactMaterial } from './impact-material';
import { ownsUltimateVfx } from './ultimate-battlefield-effects';
import type Phaser from 'phaser';
import type { DamageType,RunState,VisualEvent } from '../sim/types';
import { attackType } from '../data/forms';
import { AreaCueStore } from './area-cues';
import type { Detail } from './presentation';
/** Atlas bodies stay in simulation coordinates, below actors and all HUD text. */
export class AreaEffects {
 private store=new AreaCueStore();private run:RunState|null=null;
 private g:Phaser.GameObjects.Graphics;
 private sprites:Phaser.GameObjects.Image[]=[];private used=0;private peak=0;private limit=160;private reserved=0;
 private bodies:{seq:number;type:DamageType;parts:number}[]=[];
 private fieldBodies:{id:number;parts:number}[]=[];
 private aspect=1;
 private sprite(key:string,frame:number|undefined,x:number,y:number,size:number,alpha:number,angle=0,width=size,tint?:number,footprint=false){
  if(key==='combat-fx'){const material=impactMaterial(frame??0);key=material.key;frame=material.frame;tint??=material.color;}
  if(alpha<=0)return;
  if(footprint)this.reserved=Math.max(0,this.reserved-1);
  if(this.used>=this.limit||!footprint&&this.used>=this.limit-this.reserved)return;
  let image=this.sprites[this.used++];if(!image){image=this.g.scene.add.image(x,y,key,frame);this.sprites.push(image);}
  image.setTexture(key,frame).setVisible(true).setPosition(x,y).setDisplaySize(width,size*(footprint?1:this.aspect)).setAlpha(alpha).setAngle(angle).setDepth(2.25);
  if(tint===undefined)image.clearTint();else image.setTint(tint);
 }
 /** Irregular atlas lobes convey the footprint without geometric outlines. */
 private volume(type:DamageType,x:number,y:number,r:number,t:number,seed:number,detail:Detail){
  const first=this.used,phase=Math.min(2,Math.floor(t*3)),fade=Math.max(0,1-t),gravity=type==='gravity';
  const key=type==='kinetic'?'combat-props':'combat-fx';
  const frame=type==='kinetic'?13+phase:type==='thermal'?5+phase:type==='arc'?9+phase:gravity?12:1+phase;
  const tint=type==='plasma'?0xffa8dd:undefined;
  this.sprite(key,frame,x,y,Math.min(440,r*(1.95+.18*Math.sin(Math.PI*t))),fade*.88,gravity?t*80:seed*17,undefined,tint,true);
  const count=detail==='compact'?2:5;
  for(let i=0;i<count;i++){
   const a=seed*.73+i*2.399,spread=.2+.12*((seed+i*3)%5),distance=r*(gravity?spread*(1-t):spread*(.35+.65*t));
   const px=x+Math.cos(a)*distance,py=y+Math.sin(a)*distance-(type==='thermal'?r*t*.14:0);
   this.sprite(gravity?'combat-props':key,gravity?6:frame,px,py,
    Math.min(gravity?30:62,r*(gravity?.27:.58))*(.8+.15*(i%3)),fade*(gravity?.7:.65),a*180/Math.PI+t*45,undefined,gravity?0x76e9d2:tint);
  }
  if(detail==='full'&&(type==='thermal'||type==='kinetic'||gravity)&&t>.25)
   this.sprite('combat-props',5,x,y-r*.18*t,Math.min(104,r*1.15),Math.sin(t*Math.PI)*.28,seed*13,undefined,gravity?0x579c92:undefined);
  return this.used-first;
 }
 private fieldVolume(type:DamageType,x:number,y:number,r:number,now:number,id:number,detail:Detail){
  const first=this.used,gravity=type==='gravity',arc=type==='arc';
  const phase=Math.floor(now/180)%2,tint=type==='plasma'?0xffa8dd:undefined;
  // A full footprint body persists for the actual field lifetime, below enemies.
  this.sprite(gravity?'combat-props':'combat-fx',gravity?5:arc?10+phase:6+phase,x,y,Math.min(440,r*2.08),gravity?.58:.64,id*37,undefined,gravity?0x438f91:tint,true);
  this.sprite(gravity?'combat-fx':'combat-props',gravity?12:5,x,y-r*.08,Math.min(gravity?64:190,r*(gravity?.7:1.5)),gravity?.62:.22,gravity?now/90:0,undefined,gravity?undefined:tint);
  const count=detail==='compact'?3:6;
  for(let i=0;i<count;i++){
   const cycle=(now/1300+i/count+id*.17)%1,a=i*2.399+id*.5;
   const reach=r*(gravity?(.45+.09*(i%4))*(1-cycle):.18+.48*((i*3+id)%7)/6),fade=.45+.55*Math.sin(cycle*Math.PI);
   this.sprite(gravity?'combat-props':'combat-fx',gravity?6:arc?9+phase:5+phase,x+Math.cos(a)*reach,y+Math.sin(a)*reach-(gravity?0:r*cycle*.16),
    Math.min(gravity?38:68,r*(gravity?.38:.68)),fade*(gravity?.84:.7),gravity?a*180/Math.PI+cycle*90:Math.sin(now/240+i)*16,undefined,gravity?0x76e9d2:tint);
  }
  return this.used-first;
 }
 private fields:{id:number;x:number;y:number;radius:number}[]=[];
 constructor(scene:Phaser.Scene){this.g=scene.add.graphics().setDepth(2);}
 update(run:RunState,events:readonly VisualEvent[],now:number,detail:Detail){
  if(run!==this.run){this.run=run;this.store=new AreaCueStore();}
  this.store.update(events.filter(e=>!ownsUltimateVfx(e)),now);const g=this.g;g.clear();
  this.used=0;this.bodies=[];this.fieldBodies=[];
  const activeFields=run.fields.filter(f=>f.expires>run.tick&&!(f.ultimate&&['C01','C04'].includes(f.source)));
  // Every real footprint has priority over smoke and fragments from earlier effects.
  this.reserved=activeFields.length+this.store.cues.reduce((count,c)=>count+(c.event.areaShape==='line'?0:c.event.areaShape==='world'||c.event.areaShape==='wall-band'?(detail==='compact'?3:6):1),0);
  this.limit=Math.max(detail==='compact'?88:160,this.reserved);
  this.aspect=Math.min(1.6,g.scene.cameras.main.zoomX/g.scene.cameras.main.zoomY);
  for(const f of activeFields)this.fieldBodies.push({id:f.id,parts:this.fieldVolume(f.damageType??attackType(run,f.source),f.x,f.y,f.radius,now,f.id,detail)});
  for(const cue of this.store.cues){
   const e=cue.event,t=Math.max(0,(now-cue.born)/cue.duration),r=e.radius??0;
   const type=e.damageType??(e.source?attackType(run,e.source):'thermal');
   if(e.areaShape==='line')continue; // MaterialEffects owns the illustrated projectile and energy.
   if(e.areaShape==='world'||e.areaShape==='wall-band'){
    const count=detail==='compact'?3:6;let parts=0;
    for(let i=0;i<count;i++)parts+=this.volume(type,35+(i%3)*160,e.areaShape==='wall-band'?e.y+28:125+Math.floor(i/3)*180,42,t,e.seq+i,detail);
    this.bodies.push({seq:e.seq,type,parts});
   }else this.bodies.push({seq:e.seq,type,parts:this.volume(type,e.x,e.y,r,t,e.seq,detail)});
  }
  this.fields=run.fields.filter(f=>f.expires>run.tick).map(f=>({id:f.id,x:f.x,y:f.y,radius:f.radius}));
  for(let i=this.used;i<this.sprites.length;i++)this.sprites[i].setVisible(false);
  this.peak=Math.max(this.peak,this.used);
 }
 diagnostics(){return {areaEffects:{depth:this.g.depth,geometryCommands:this.g.commandBuffer.length,vortexSprites:this.sprites.slice(0,this.used).filter(s=>s.texture.key==='combat-fx'&&Number(s.frame.name)>=13).length,volumeDepth:2.25,volume:{active:this.used,allocated:this.sprites.length,peak:this.peak,limit:this.limit,sprites:this.sprites.slice(0,this.used).map(s=>({x:s.x,y:s.y,width:s.displayWidth,height:s.displayHeight,alpha:s.alpha,key:s.texture.key,frame:Number(s.frame.name)})),bodies:this.bodies,fields:this.fieldBodies},active:this.store.cues.map(c=>({seq:c.event.seq,shape:c.event.areaShape??'circle',x:c.event.x,y:c.event.y,x2:c.event.x2,y2:c.event.y2,radius:c.event.radius,source:c.event.source,skill:c.event.skill,affectedIds:c.event.affectedIds,born:c.born,duration:c.duration})),fields:this.fields}};}
}
