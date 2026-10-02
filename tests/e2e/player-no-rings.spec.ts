import {test,expect} from '@playwright/test';
import {ready,startBattle} from '../helpers/mobile-ui';
for(const width of [390,1440])for(const reduced of [false,true])test.describe(`no rings ${width} ${reduced?'compact':'full'}`,()=>{
 test.use({viewport:{width,height:width===390?844:900},isMobile:width<800,hasTouch:width<800});
 test('player bodies have no circle strokes; enemy danger remains',async({page})=>{
 await ready(page);await startBattle(page);
 await page.waitForFunction(()=>!!window.__game.presentation());
 await page.evaluate(async reduced=>{
  const {createEnemy}=await import('/src/sim/combat.ts' as string);const state=window.__game.state()!;
  window.__game.getSave().preferences.reducedEffects=reduced;state.pauseReasons=[];state.phase='running';state.spawnCursor=state.spawnPlan.length;state.bossSpawned=true;state.enemies=[];state.fields=[];state.events=[];state.projectiles=[];state.scheduled=[];state.weapons.forEach(w=>w.nextAttack=1e9);
  const target=createEnemy(state,'E03',195,280,0);target.hp=target.maxHp=1e7;target.speed=0;
  for(let i=0;i<4;i++)state.fields.push({id:state.nextEntityId++,source:i%2?'C04':'C05',kind:i%2?'gravity':'fire',x:110+i*45,y:250,radius:65,expires:state.tick+300,nextTick:state.tick+300,dps:1,damageType:i%2?'gravity':'thermal',slow:0,slowDuration:0,pull:0,burnDuration:0,armorIgnore:0});
  for(let i=0;i<20;i++)state.scheduled.push({at:state.tick+1,x:150+i*3,y:280,radius:45,packet:{source:i%2?'C04':'C05',skill:'dense-ring-regression',raw:1,damageType:i%2?'gravity':'thermal',armorIgnore:0,shieldMultiplier:1},enemyDamage:0,enemySource:null});
  window.__game.ticks(1);
 },reduced);
 await page.waitForFunction(()=>(window.__game.presentation() as any).areaEffects.active.some((e:any)=>e.skill==='dense-ring-regression'));
 await expect.poll(()=>page.evaluate(()=>(window.__game.presentation() as any).areaEffects.volume.active)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>(window.__game.presentation() as any).warningCommands)).toBe(0);
 expect(await page.evaluate(()=>(window.__game.presentation() as any).areaEffects.vortexSprites)).toBe(0);
 expect(await page.evaluate(()=>(window.__game.presentation() as any).materialEffects.vortexSprites)).toBe(0);
 expect(await page.evaluate(()=>(window.__game.presentation() as any).areaEffects.geometryCommands)).toBe(0);
 // Keep an actual enemy charge legible even with player fields still active.
 await page.evaluate(()=>{const s=window.__game.state()!,e=s.enemies[0];e.defId='E05';e.chargeKind='shot';e.chargeCancelled=false;e.chargeUntil=s.tick+90;e.abilityAt=s.tick+300;window.__game.ticks(1);});
 await expect.poll(()=>page.evaluate(()=>(window.__game.presentation() as any).warningCommands)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>(window.__game.presentation() as any).areaEffects.geometryCommands)).toBe(0);
});
});
