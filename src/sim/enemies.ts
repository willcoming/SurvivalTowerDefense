import { ENEMY_MAP, ticks, WORLD } from '../data/content';
import { alive, boss, createEnemy, distance, hitWall } from './combat';
import type { Enemy, RunState } from './types';
function wallShot(s:RunState,e:Enemy,damage:number){
  s.projectiles.push({id:s.nextEntityId++,x:e.x,y:e.y,tx:e.x,ty:450,vx:0,vy:160,expires:s.tick+ticks(5),hitIds:[],remaining:1,falloff:[1],radius:7,blastRadius:0,packet:null,enemyDamage:damage,enemySource:e.defId,impactAt:0});
}
function summon(s:RunState,e:Enemy){
  const def=e.defId==='B01'?'E01':e.summonCount%2===0?'E02':'E03';const count=e.defId==='B01'?6:def==='E02'?4:2;
  for(let i=0;i<count;i++)createEnemy(s,def,Math.max(20,Math.min(370,e.x+(i-(count-1)/2)*35)),Math.min(320,e.y+50),0,9);
  e.summonCount++;e.summonAt+=ticks(e.defId==='B01'?18:24);
}
export function stepEnemies(s:RunState){
  for(const e of alive(s)){
    const stunned=e.effects.some(f=>f.kind==='stun'&&f.expires>s.tick);
    const slow=Math.max(0,...e.effects.filter(f=>f.kind==='slow'&&f.expires>s.tick).map(f=>f.value));
    if(boss(e)){
      if(!stunned)e.y+=Math.sign(150-e.y)*Math.min(Math.abs(150-e.y),8/30);
      if(e.summonAt<=s.tick){if(e.defId==='B02'){e.shield=Math.min(1800,e.shield+600);e.summonAt+=ticks(20);}else summon(s,e);}
      if(e.chargeKind&&e.chargeUntil<=s.tick){
        if(!e.chargeCancelled&&!stunned){if(e.defId==='B02'){for(let i=0;i<3;i++)s.scheduled.push({at:s.tick+i*ticks(.3),packet:null,x:195,y:450,radius:0,enemyDamage:25,enemySource:e.defId});}else hitWall(s,ENEMY_MAP[e.defId].damage,e.defId);}
        if(e.defId==='B03')e.exposureUntil=s.tick+ticks(6);
        e.chargeKind=null;e.chargeUntil=0;
      }
      if(!stunned&&!e.chargeKind&&e.abilityAt<=s.tick){e.chargeKind='boss';e.chargeCancelled=false;e.chargeUntil=s.tick+ticks(e.defId==='B03'?3:2);e.abilityAt+=ticks(ENEMY_MAP[e.defId].interval);}
      continue;
    }
    if(e.chargeKind&&e.chargeUntil<=s.tick){
      if(!e.chargeCancelled&&!stunned){if(e.chargeKind==='shot')wallShot(s,e,35);else if(e.chargeKind==='rush')e.rushUntil=s.tick+ticks(2);}
      e.chargeKind=null;e.chargeUntil=0;
    }
    if(stunned)continue;
    if(e.defId==='E06'&&e.abilityAt<=s.tick){
      const ally=alive(s).filter(t=>t.id!==e.id&&!boss(t)&&t.hp<t.maxHp&&distance(t,e)<=100).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id)[0];
      if(ally)ally.hp=Math.min(ally.maxHp,ally.hp+ally.maxHp*.05);e.abilityAt=s.tick+ticks(8);
    }
    const stop=e.defId==='E05'?250:WORLD.wallY;
    if(!e.chargeKind)e.y=Math.min(stop,e.y+e.speed*(1-slow)*(e.rushUntil>s.tick?2:1)/30);
    if(e.defId==='E05'&&e.y>=250&&e.abilityAt<=s.tick&&!e.chargeKind){e.chargeKind='shot';e.chargeUntil=s.tick+ticks(1.5);e.chargeCancelled=false;e.abilityAt=s.tick+ticks(8);}
    if(e.y>=WORLD.wallY){if(!e.attackAt)e.attackAt=s.tick+ticks(.3);if(e.attackAt<=s.tick){hitWall(s,ENEMY_MAP[e.defId].damage,e.defId);e.attackAt=s.tick+ticks(ENEMY_MAP[e.defId].interval);}}
    else e.attackAt=0;
  }
}
