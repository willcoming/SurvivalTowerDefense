import { test, expect, type Page } from '@playwright/test';
import { ready } from '../helpers/mobile-ui';
import type { CharacterId } from '../../src/sim/types';

test.use({video:'on'});

async function prepare(page:Page) {
  await ready(page);
  await page.evaluate(()=>window.__game.start({stageId:'S01',squadIds:['C01','C02','C03','C04','C05'],captainId:'C01',seed:101}));
  await page.locator('#battle-loading').waitFor({state:'detached'});
  await page.locator('[data-action=tutorial-done]').first().click();
  await page.evaluate(async()=>{
    const treesPath='/src/data/deep-trees.ts',ultPath='/src/sim/ultimates.ts',combatPath='/src/sim/combat.ts';
    const {deepTreesFor}=await import(treesPath),{ultimateNodeId}=await import(ultPath),{createEnemy}=await import(combatPath);
    const s=window.__game.state()!;
    s.enemies=[];s.projectiles=[];s.fields=[];s.events=[];s.scheduled=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;
    for(const id of s.config.squadIds){
      const tree=deepTreesFor(id,s).find((t:any)=>t.nodes.some((n:any)=>n.id===ultimateNodeId(id,s)))!;
      s.treeNodes!.push(...tree.nodes.slice(0,5).map((n:any)=>n.id));
    }
    s.weapons.forEach(w=>{w.nextAttack=1e9;w.ultimateReadyAt=1e9;});
    const e=createEnemy(s,'E03',195,-200,0);e.hp=e.maxHp=1e7;e.speed=e.shield=e.armor=0;
  });
}
async function cast(page:Page,ids:CharacterId[]) {
  await page.evaluate(async ids=>{
    const combatPath='/src/sim/combat.ts',ultPath='/src/sim/ultimates.ts';
    const {createEnemy}=await import(combatPath),{stepUltimates}=await import(ultPath);
    const s=window.__game.state()!;s.enemies=[];
    for(const x of [155,195,235]){const e=createEnemy(s,'E03',x,265,0);e.hp=e.maxHp=1e7;e.speed=e.shield=e.armor=0;}
    for(const id of ids)s.weapons.find(w=>w.id===id)!.ultimateReadyAt=0;
    stepUltimates(s);
  },ids);
}
for(const width of [390,1440])test.describe(`ultimate ${width}`,()=>{
  test.use({viewport:{width,height:width===390?844:1000},isMobile:width===390,hasTouch:width===390});
  test('cooldown tracks remain below portraits, reset after real casts, and clear after effects expire',async({page},info)=>{
    await prepare(page);
    await page.evaluate(async()=>{
      const path='/src/data/reworked-skills.ts';const {ultimateForForm}=await import(path),s=window.__game.state()!;
      s.weapons.forEach((w,i)=>w.ultimateReadyAt=s.tick+Math.round(ultimateForForm(w.id).cooldown*30*(1-[.1,.4,.78,.99,1][i])));
    });
    await page.waitForFunction(()=>{const e=(window.__game.presentation() as any).ultimateEnergy;return e.readyCount>=1&&e.bars[3]?.progress>.98;});
    const energy=await page.evaluate(()=>(window.__game.presentation() as any).ultimateEnergy);
    expect(energy.bars).toHaveLength(5);
    expect(energy.bars.every((b:any)=>b.y===514&&b.width===44&&b.height===3.5)).toBe(true);
    expect(energy.bars[0].progress).toBeLessThan(.2);expect(energy.bars[3].progress).toBeGreaterThan(.98);
    await page.screenshot({path:info.outputPath('energy-cooldown-and-ready.png')});
    await cast(page,['C01','C02']);
    await page.waitForFunction(()=>(window.__game.presentation() as any).ultimateEnergy.castCount>=2);
    const fired=await page.evaluate(()=>(window.__game.presentation() as any).ultimateEnergy);
    expect(fired.bars.filter((b:any)=>['C01','C02'].includes(b.id)).every((b:any)=>b.progress<.1&&!b.ready)).toBe(true);
    await page.waitForFunction(()=>(window.__game.presentation() as any).ultimateEnergy.banner?.source==='C02');
    await page.waitForFunction(()=>(window.__game.presentation() as any).ultimateEnergy.banner===null);
    await page.waitForFunction(()=>(window.__game.presentation() as any).ultimateBattlefield.sprites===0);
    expect((await page.evaluate(()=>(window.__game.presentation() as any).ultimateEnergy)).dimAlpha).toBe(0);
  });
  for(const id of ['C01','C02','C03','C04','C05'] as CharacterId[])test(`${id} real ultimate has its own banner and battlefield effect`,async({page},info)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await prepare(page);
    if(id==='C03'){await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));}
    await cast(page,[id]);
    if(id==='C03')await page.clock.runFor(96);
    await page.waitForFunction(id=>(window.__game.presentation() as any).ultimateEnergy.banner?.source===id,id);
    if(id!=='C03')await page.waitForTimeout(id==='C05'?320:140);
    const view=await page.evaluate(()=>(window.__game.presentation() as any));
    expect(await page.locator('#ultimate-cue').evaluate(el=>el.classList.contains('sr-only'))).toBe(true);
    expect(view.ultimateEnergy.banner).toMatchObject({source:id,y:435,height:22,visible:true});
    expect(view.ultimateBattlefield.active.some((c:any)=>c.source===id)).toBe(true);
    expect(view.ultimateBattlefield.sprites).toBeGreaterThan(0);
    expect(view.areaEffects.active.some((c:any)=>c.source===id&&c.skill==='ultimate')).toBe(false);
    expect(view.materialEffects.textures['combat-fx']??0).toBe(0);
    await page.screenshot({path:info.outputPath(`${id}-ultimate.png`)});
    if(id==='C04'){
      const before=await page.evaluate(()=>window.__game.state()!.enemies.map(e=>({id:e.id,x:e.x})));
      await page.waitForTimeout(600);
      const field=await page.evaluate(()=>(window.__game.presentation() as any).ultimateBattlefield.fields[0]);
      expect(field.radius).toBe(90);
      const after=await page.evaluate(()=>window.__game.state()!.enemies.map(e=>({id:e.id,x:e.x})));
      expect(after.some(e=>Math.abs(e.x-field.x)<Math.abs(before.find(b=>b.id===e.id)!.x-field.x))).toBe(true);
      await page.evaluate(()=>window.__game.state()!.fields.forEach(f=>f.expires=window.__game.state()!.tick));
    }
    if(id==='C03')await page.clock.runFor(1400);
    await page.waitForFunction(()=>(window.__game.presentation() as any).ultimateBattlefield.active.length===0);
    expect(errors).toEqual([]);
  });
});
test('reduced motion keeps energy and the banner without dimming, flash or caster hit-stop',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await prepare(page);await cast(page,['C02']);
  await page.waitForFunction(()=>(window.__game.presentation() as any).ultimateEnergy.banner?.source==='C02');
  const view=await page.evaluate(()=>(window.__game.presentation() as any));
  expect(view.ultimateEnergy.dimAlpha).toBe(0);expect(view.ultimateBattlefield.flashAlpha).toBe(0);
  expect(view.casterFlashIds).toEqual([]);expect(view.casterHitStopIds).toEqual([]);
  await page.screenshot({path:info.outputPath('ultimate-reduced-motion.png')});
});

test('cinematic timing keeps the caster flash brief and fades the background independently of damage',async({page},info)=>{
  await prepare(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now()+100));
  await cast(page,['C01']);
  await page.clock.runFor(48);
  const start=await page.evaluate(()=>(window.__game.presentation() as any));
  expect(start.ultimateEnergy.dimAlpha).toBeCloseTo(.2);
  expect(start.casterFlashIds).toContain('C01');expect(start.casterHitStopIds).toContain('C01');
  const damage=await page.evaluate(()=>window.__game.state()!.stats.ultimateCasts!.filter(c=>c.ownerId==='C01').length);
  expect(damage).toBe(1);
  await page.clock.runFor(80);
  expect((await page.evaluate(()=>(window.__game.presentation() as any))).casterFlashIds).toEqual([]);
  await page.screenshot({path:info.outputPath('C01-column-cinematic-frame.png')});
  await page.clock.runFor(240);
  expect((await page.evaluate(()=>(window.__game.presentation() as any))).ultimateEnergy.dimAlpha).toBe(0);
  await page.clock.runFor(300);
  expect((await page.evaluate(()=>(window.__game.presentation() as any))).ultimateEnergy.banner).toBeNull();
});
