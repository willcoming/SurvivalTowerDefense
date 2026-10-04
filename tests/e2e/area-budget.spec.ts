import {test,expect} from '@playwright/test';
import {ready,startBattle} from '../helpers/mobile-ui';
for(const compact of [false,true])test(`each impact survives concurrent fields, compact=${compact}`,async({page},info)=>{
 await ready(page);await startBattle(page);
 const seqs=await page.evaluate(async compact=>{
  const c='/src/sim/combat.ts',engine='/src/sim/engine.ts';const {createEnemy}=await import(c),{stepRun}=await import(engine);const s=window.__game.state()!;
  window.__game.getSave().preferences.reducedEffects=compact;s.pauseReasons=[];s.phase='running';s.enemies=[];s.fields=[];s.projectiles=[];s.scheduled=[];s.events=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.weapons.forEach(w=>w.nextAttack=1e9);
  const e=createEnemy(s,'E03',195,280,0);e.hp=e.maxHp=1e7;e.speed=e.armor=e.shield=0;
  for(let i=0;i<8;i++)s.fields.push({id:s.nextEntityId++,source:i%2?'C04':'C05',kind:i%2?'gravity':'fire',x:100+i*25,y:260,radius:65,expires:s.tick+600,nextTick:s.tick+600,dps:1,damageType:i%2?'gravity':'thermal',slow:0,slowDuration:0,pull:0,burnDuration:0,armorIgnore:0});
  for(let i=0;i<20;i++)s.scheduled.push({at:s.tick+1,x:150+i*3,y:280,radius:45,packet:{source:i%2?'C04':'C05',skill:'field-pressure',raw:1,damageType:i%2?'gravity':'thermal',armorIgnore:0,shieldMultiplier:1},enemyDamage:0,enemySource:null});stepRun(s);window.__game.ticks(0);return s.events.filter(e=>e.skill==='field-pressure'&&e.kind==='explosion').map(e=>e.seq);
 },compact);
 await page.waitForFunction(()=>(window.__game.presentation() as any).areaEffects.active.filter((e:any)=>e.skill==='field-pressure').length===20);
 await page.waitForTimeout(160);
 const area=await page.evaluate(()=>(window.__game.presentation() as any).areaEffects);
 expect(area.volume.fields).toHaveLength(8);expect(area.volume.fields.every((f:any)=>f.parts>0)).toBe(true);
 expect(area.volume.bodies.filter((b:any)=>seqs.includes(b.seq))).toHaveLength(20);
 expect(area.volume.bodies.filter((b:any)=>seqs.includes(b.seq)).every((b:any)=>b.parts>0)).toBe(true);
 expect(area.volume.active).toBeLessThanOrEqual(area.volume.limit);
 await page.screenshot({path:info.outputPath('concurrent-field-impacts.png')});
});
