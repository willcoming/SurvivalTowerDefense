import type Phaser from 'phaser';
import { ELEMENTS, usesCollection, WEAKNESSES } from '../data/forms';
import type { RunState } from '../sim/types';
import { enemySize } from './actors';

/** One small atlas keeps weakness symbols batched and independent of enemy HP/status icons. */
export class WeaknessMarkers {
  private markers=new Map<number,Phaser.GameObjects.Image>();
  constructor(private scene:Phaser.Scene){
    const atlas=scene.textures.createCanvas('weakness-atlas',160,32)!,ctx=atlas.context;
    Object.entries(ELEMENTS).forEach(([type,e],i)=>{ctx.fillStyle='#102d38';ctx.fillRect(i*32,0,30,30);ctx.strokeStyle=e.color;ctx.strokeRect(i*32+1,1,28,28);ctx.fillStyle=e.color;ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(e.icon,i*32+15,15);atlas.add(type,0,i*32,0,30,30);});atlas.refresh();
  }
  update(run:RunState){
    if(!usesCollection(run))return;const ids=new Set(run.enemies.map(e=>e.id));
    for(const [id,image] of this.markers)if(!ids.has(id)){image.destroy();this.markers.delete(id);}
    for(const e of run.enemies){let image=this.markers.get(e.id);if(!image){image=this.scene.add.image(0,0,'weakness-atlas',WEAKNESSES[e.defId]).setDisplaySize(15,15).setDepth(8.6);this.markers.set(e.id,image);}image.setPosition(e.x+enemySize(e.defId)/2,e.y-enemySize(e.defId)/2).setVisible(run.bossIntro?.enemyId!==e.id);}
  }
}
