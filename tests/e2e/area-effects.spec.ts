import {test,expect} from '@playwright/test';
import {ready,startBattle} from '../helpers/mobile-ui';
for(const viewport of [{width:320,height:500},{width:390,height:844},{width:1440,height:900}])for(const reduced of [false,true])test.describe(`area ${viewport.width} ${reduced?'compact':'full'}`,()=>{
 test.use({viewport,isMobile:viewport.width<800,hasTouch:viewport.width<800});
 test('real impacts, penetration and active field render and expire',async({page},info)=>{
  await ready(page);await page.evaluate(()=>{const p=window.__game.getSave().preferences;p.squadIds=['C03','C04','C05'];p.captainId='C03';window.__game.route('home');});await startBattle(page);await page.waitForFunction(()=>!!window.__game.presentation());
  const expected=await page.evaluate(async reduced=>{
   const combat='/src/sim/combat.ts',engine='/src/sim/engine.ts',weapons='/src/sim/weapons.ts',ult='/src/sim/ultimates.ts',trees='/src/data/deep-trees.ts';
   const {createEnemy}=await import(combat),{stepRun}=await import(engine),{stepWeapons}=await import(weapons),{stepUltimates,ultimateNodeId}=await import(ult),{deepTreesFor}=await import(trees);
   const save=window.__game.getSave(),s=window.__game.state()!;save.preferences.reducedEffects=reduced;s.pauseReasons=[];s.phase='running';s.enemies=[];s.projectiles=[];s.fields=[];s.scheduled=[];s.events=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.wallHp=s.wallMaxHp=100000;
   s.weapons.forEach(w=>w.nextAttack=1e9);const enemies=[{x:130,y:270},{x:175,y:270},{x:330,y:220}].map(p=>{const e=createEnemy(s,'E03',p.x,p.y,0);e.hp=e.maxHp=1e7;e.shield=e.armor=e.speed=0;return e;});
   const sniper=s.weapons.find(w=>w.id==='C03')!;sniper.nextAttack=0;stepWeapons(s);sniper.nextAttack=1e9;
   const tree=deepTreesFor('C04',s).find((t:any)=>t.nodes.some((n:any)=>n.id===ultimateNodeId('C04',s)))!;s.treeNodes!.push(...tree.nodes.slice(0,5).map((n:any)=>n.id));s.weapons.find(w=>w.id==='C04')!.ultimateReadyAt=0;stepUltimates(s);
   const packet={source:'C05' as const,skill:'qa-area',raw:100,damageType:'thermal' as const,armorIgnore:0,shieldMultiplier:1};
   s.projectiles.push({id:s.nextEntityId++,x:195,y:490,tx:130,ty:270,vx:0,vy:0,expires:s.tick+10,hitIds:[],remaining:1,falloff:[1],radius:6,blastRadius:48,packet,enemyDamage:0,enemySource:null,impactAt:s.tick+1});
   stepRun(s);window.__game.ticks(0);
   const blast=s.events.find(e=>e.kind==='explosion'&&e.skill==='qa-area')!;return {blast,ids:enemies.map(e=>e.id),fields:s.fields.map(f=>({id:f.id,x:f.x,y:f.y,radius:f.radius}))};
  },reduced);
  await page.waitForFunction(()=>(window.__game.presentation() as any).areaEffects?.active.some((e:any)=>e.skill==='qa-area'));
  const effects=await page.evaluate(()=>(window.__game.presentation() as any).areaEffects);
  expect(effects.geometryCommands).toBe(0);expect(effects.depth).toBeLessThan(3);expect(effects.volumeDepth).toBeLessThan(3);expect(effects.volume.active).toBeGreaterThan(0);expect(effects.volume.active).toBeLessThanOrEqual(effects.volume.limit);expect(effects.volume.bodies.find((b:any)=>b.seq===expected.blast.seq).parts).toBeGreaterThanOrEqual(3);expect(effects.volume.fields.every((f:any)=>f.parts>=2)).toBe(true);expect(effects.active.find((e:any)=>e.skill==='qa-area')).toMatchObject({x:130,y:270,radius:48,affectedIds:expected.blast.affectedIds});expect(expected.blast.affectedIds).toEqual(expected.ids.slice(0,2));expect(effects.active.some((e:any)=>e.shape==='line'&&e.radius===7)).toBe(true);expect(effects.fields).toEqual(expected.fields);
  for(const field of expected.fields){
   const body=effects.volume.sprites.find((sprite:any)=>Math.abs(sprite.x-field.x)<.01&&Math.abs(sprite.y-field.y)<.01&&sprite.width>=field.radius*1.9&&sprite.height>=field.radius*1.9);
   expect(body,`field ${field.id} covers its damage footprint`).toBeDefined();
  }
  expect(effects.volume.sprites.some((sprite:any)=>Math.abs(sprite.x-expected.blast.x)<.01&&Math.abs(sprite.y-expected.blast.y)<.01&&sprite.width>=48*1.9&&sprite.height>=48*1.9)).toBe(true);
  await expect(page.locator('#battle-overlay')).toBeEmpty();
  await page.screenshot({path:info.outputPath(`actual-area-${viewport.width}-${reduced?'compact':'full'}.png`)});
  await page.evaluate(()=>{const s=window.__game.state()!;s.fields.forEach(f=>f.expires=s.tick);s.pauseReasons=[];s.phase='running';window.__game.ticks(1);});
  await page.waitForFunction(()=>(window.__game.presentation() as any).areaEffects.active.length===0&&(window.__game.presentation() as any).areaEffects.fields.length===0&&(window.__game.presentation() as any).areaEffects.volume.active===0);
 });
 test('20 same-frame real delayed impacts all arrive despite sprite limits',async({page})=>{
  await ready(page);await page.evaluate(()=>{const p=window.__game.getSave().preferences;p.squadIds=['C03','C04','C05'];p.captainId='C03';window.__game.route('home');});await startBattle(page);await page.waitForFunction(()=>!!window.__game.presentation());
  const seqs=await page.evaluate(async reduced=>{window.__game.getSave().preferences.reducedEffects=reduced;const c='/src/sim/combat.ts',e='/src/sim/engine.ts';const {createEnemy}=await import(c),{stepRun}=await import(e);const s=window.__game.state()!;s.pauseReasons=[];s.phase='running';s.enemies=[];s.fields=[];s.projectiles=[];s.scheduled=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.weapons.forEach(w=>w.nextAttack=1e9);const t=createEnemy(s,'E03',195,280,0);t.hp=t.maxHp=1e7;t.speed=t.armor=t.shield=0;for(let i=0;i<20;i++)s.scheduled.push({at:s.tick+1,x:180+i,y:280,radius:35,packet:{source:'C05',skill:'repeat-area',raw:10,damageType:'thermal',armorIgnore:0,shieldMultiplier:1},enemyDamage:0,enemySource:null});stepRun(s);window.__game.ticks(0);return s.events.filter(e=>e.kind==='explosion'&&e.skill==='repeat-area').map(e=>e.seq);},reduced);
  expect(seqs).toHaveLength(20);await page.waitForFunction(()=>(window.__game.presentation() as any).areaEffects.active.filter((e:any)=>e.skill==='repeat-area').length===20);const rendered=await page.evaluate(()=>(window.__game.presentation() as any).areaEffects.active.filter((e:any)=>e.skill==='repeat-area').map((e:any)=>e.seq));expect(rendered).toEqual(seqs);const volume=await page.evaluate(()=>(window.__game.presentation() as any).areaEffects.volume);expect((await page.evaluate(()=>(window.__game.presentation() as any).areaEffects)).geometryCommands).toBe(0);expect(volume.active).toBeLessThanOrEqual(volume.limit);expect(volume.bodies.filter((b:any)=>seqs.includes(b.seq)).every((b:any)=>b.parts>=1)).toBe(true);expect(volume.allocated).toBeLessThanOrEqual(160);
  await page.evaluate(()=>{const s=window.__game.state()!;s.pauseReasons=[];s.phase='running';window.__game.ticks(0);});await page.waitForFunction(()=>(window.__game.presentation() as any).areaEffects.active.length===0&&(window.__game.presentation() as any).areaEffects.volume.active===0);
 });
});
