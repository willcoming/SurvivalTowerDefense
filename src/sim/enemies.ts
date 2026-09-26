import { highPressure, pressureMode } from '../data/high-pressure';
import { operationProfile } from '../data/progression';
import { ENEMY_MAP, STAGE_MAP, ticks, WORLD } from '../data/content';
import { alive, boss, createEnemy, distance, hitWall } from './combat';
import type { Enemy, RunState } from './types';
import { pressure } from './difficulty';
import { waveAttackDamage } from './operations';
export const BOSS_ESCORT_COUNT = 42;
/** One-time entrance escorts share the authored skill budget; summons grant no XP. */
export function spawnBossEscort(s: RunState, leader: Enemy) {
  if((s.balanceVersion===3||s.balanceVersion===4||s.balanceVersion===5))return; // Entrance escorts are deterministic delayed spawn entries.
  const profile=operationProfile(s),count=profile.escortCount??32,xp=profile.escortXp??0;
  const specialist = leader.defId === 'B02' ? 'E03' : 'E02';
  const escortTypes = ['E03','E04','E05','E02','E06','E03','E05','E02','E04','E03','E05','E06'] as const;
  const specialists = s.balanceVersion===2?highPressure(s.config.stageId,pressureMode(s.config)).escortSpecialists:s.config.stageId.startsWith('X') || Number(s.config.stageId.slice(1)) > 3 ? 12 : 6;
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 8), column = i % 8;
    const authored = i < specialists ? escortTypes[i%escortTypes.length] : 'E01';
    const type = s.balanceVersion !== undefined ? STAGE_MAP[s.config.stageId].enemyIds.includes(authored) ? authored : 'E01' : leader.defId === 'B01' || i % 4 !== 3 ? 'E01' : specialist;
    createEnemy(s, type,
      24 + column * 48 + (row % 2) * 6, 20 + row * 20, Math.floor(xp/count)+(i<xp%count?1:0), profile.waves.length+1);
  }
}
function acted(s:RunState,e:Enemy,kind:NonNullable<Enemy['lastAction']>['kind']){e.lastAction={tick:s.tick,kind};}
function wallShot(s:RunState,e:Enemy,damage:number){
  acted(s,e,'shot');
  s.projectiles.push({id:s.nextEntityId++,x:e.x,y:e.y,tx:e.x,ty:450,vx:0,vy:160,expires:s.tick+ticks(5),hitIds:[],remaining:1,falloff:[1],radius:7,blastRadius:0,packet:null,enemyDamage:damage,enemySource:e.defId,impactAt:0});
}
function summon(s:RunState,e:Enemy){
  acted(s,e,'summon');
  const def=e.defId==='B01'?'E01':e.summonCount%2===0?'E02':'E03';const count=e.defId==='B01'?6:def==='E02'?4:2;
  for(let i=0;i<count;i++)createEnemy(s,def,Math.max(20,Math.min(370,e.x+(i-(count-1)/2)*35)),Math.min(320,e.y+50),0,s.config.mode==='hundred'||(s.balanceVersion===4||s.balanceVersion===5)?e.wave:9);
  e.summonCount++;e.summonAt+=ticks(e.defId==='B01'?18:24);
}
export function stepEnemies(s:RunState){
  const tuning=pressure(s);
  for(const e of alive(s)){
    const stunned=e.effects.some(f=>f.kind==='stun'&&f.expires>s.tick);
    const slow=Math.max(0,...e.effects.filter(f=>f.kind==='slow'&&f.expires>s.tick).map(f=>f.value));
    if(boss(e)){
      if(!stunned)e.y+=Math.sign(150-e.y)*Math.min(Math.abs(150-e.y),8/30);
      if(e.summonAt<=s.tick){if(e.defId==='B02'){acted(s,e,'shield');e.shield=Math.min(1800,e.shield+600);e.summonAt+=ticks(20);}else summon(s,e);}
      if(e.chargeKind&&e.chargeUntil<=s.tick){
        if(!e.chargeCancelled&&!stunned){acted(s,e,e.defId==='B02'?'burst':'blast');if(e.defId==='B02'){hitWall(s,25*tuning.bossDamage,e.defId);for(let i=1;i<3;i++)s.scheduled.push({at:s.tick+i*ticks(.3),packet:null,x:195,y:450,radius:0,enemyDamage:25*tuning.bossDamage,enemySource:e.defId});}else hitWall(s,ENEMY_MAP[e.defId].damage*tuning.bossDamage,e.defId);}
        if(e.defId==='B03')e.exposureUntil=s.tick+ticks(6);
        e.chargeKind=null;e.chargeUntil=0;
      }
      if(!stunned&&!e.chargeKind&&e.abilityAt<=s.tick){e.chargeKind='boss';e.chargeCancelled=false;e.chargeUntil=s.tick+ticks(e.defId==='B03'?3:2);e.abilityAt+=Math.round(ticks(ENEMY_MAP[e.defId].interval)*tuning.bossInterval);}
      continue;
    }
    if(e.chargeKind&&e.chargeUntil<=s.tick){
      if(!e.chargeCancelled&&!stunned){if(e.chargeKind==='shot')wallShot(s,e,waveAttackDamage(s,e.wave,35));else if(e.chargeKind==='rush'){acted(s,e,'rush');e.rushUntil=s.tick+ticks(2);}}
      e.chargeKind=null;e.chargeUntil=0;
    }
    if(stunned)continue;
    if(e.defId==='E06'&&e.abilityAt<=s.tick){
      const ally=alive(s).filter(t=>t.id!==e.id&&!boss(t)&&t.hp<t.maxHp&&distance(t,e)<=100).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id)[0];
      if(ally){acted(s,e,'repair');ally.hp=Math.min(ally.maxHp,ally.hp+ally.maxHp*.05);}e.abilityAt=s.tick+ticks(8);
    }
    const stop=e.defId==='E05'?250:WORLD.wallY;
    if(!e.chargeKind)e.y=Math.min(stop,e.y+e.speed*(1-slow)*(e.rushUntil>s.tick?2:1)/30);
    if(e.defId==='E05'&&e.y>=250&&e.abilityAt<=s.tick&&!e.chargeKind){e.chargeKind='shot';e.chargeUntil=s.tick+ticks(1.5);e.chargeCancelled=false;e.abilityAt=s.tick+ticks(8);}
    if(e.y>=WORLD.wallY){if(!e.attackAt)e.attackAt=s.tick+ticks(.3);if(e.attackAt<=s.tick){acted(s,e,'melee');hitWall(s,waveAttackDamage(s,e.wave,ENEMY_MAP[e.defId].damage),e.defId);e.attackAt=s.tick+ticks(ENEMY_MAP[e.defId].interval);}}
    else e.attackAt=0;
  }
}
