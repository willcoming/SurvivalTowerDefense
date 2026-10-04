import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const output=process.env.VALIDATION_OUTPUT_DIR!;
for(const width of [390,1440])test.describe(`viewport ${width}`,()=>{
  test.use({isMobile:width===390,hasTouch:width===390});
  test(`zero point continuation, spendable allocation and dense hundred entrance at ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:width===390?844:900});
  await page.routeWebSocket('**/*',socket=>socket.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  await page.evaluate(()=>window.__game.start({stageId:'S03',mode:'hundred',difficulty:'easy',squadIds:['C01'],captainId:'C01',seed:101}));
  await page.locator('#battle-loading').waitFor({state:'detached'});
  const tutorial=page.locator('[data-action="tutorial-done"]');if(await tutorial.count())await tutorial.first().click();
  const zero=await page.evaluate(async()=>{
    const path='/src/sim/engine.ts';const {stepRun}=await import(path);const s=window.__game.state()!;
    s.enemies=[];s.spawnCursor=s.spawnPlan.findIndex(e=>e.wave===2);s.tick=Math.max(...s.spawnPlan.slice(0,s.spawnCursor).map(e=>e.at));
    s.xp=0;s.choicesEarned=0;stepRun(s);window.__game.ticks(0);return {wave:s.waveFlow!.wave,draft:s.draft,phase:s.phase};
  });
  expect(zero).toEqual({wave:2,draft:null,phase:'running'});await expect(page.locator('.wave-allocation')).toHaveCount(0);
  const dense=await page.evaluate(async()=>{
    const path='/src/sim/combat.ts';const {createEnemy,distance}=await import(path);const s=window.__game.state()!;s.enemies=[];
    for(const w of s.weapons)w.nextAttack=1e9;
    for(let i=0;i<42;i++){const e=createEnemy(s,i%3===0?'E07':'E01',195,180,0,2,true);e.speed=0;e.abilityAt=1e9;e.hp=e.maxHp=1e9;}
    window.__game.ticks(0);return {count:s.enemies.length,minGap:Math.min(...s.enemies.flatMap((e,i)=>s.enemies.slice(i+1).map(o=>distance(e,o)-e.radius-o.radius)))};
  });
  expect(dense.count).toBe(42);expect(dense.minGap).toBeGreaterThanOrEqual(4);
  await page.waitForTimeout(200);mkdirSync(output,{recursive:true});await page.screenshot({path:`${output}/dense-${info.project.name}-${width}.png`});
  await page.evaluate(async()=>{
    const path='/src/sim/engine.ts';const {stepRun}=await import(path);const s=window.__game.state()!;
    s.enemies=[];s.spawnCursor=s.spawnPlan.findIndex(e=>e.wave===3);s.tick=s.waveFlow!.startedAt+Math.max(...s.spawnPlan.filter(e=>e.wave===2).map(e=>e.at));s.xp=40;s.choicesEarned=1;
    stepRun(s);window.__game.ticks(0);
  });
  await expect(page.locator('.wave-allocation')).toBeVisible();await expect(page.locator('[data-action="deep-node"][data-id="C01-A4/0"]')).toBeVisible();
  await page.screenshot({path:`${output}/allocation-${info.project.name}-${width}.png`});
  const full=await page.evaluate(async()=>{
    const engine='/src/sim/engine.ts',tree='/src/sim/deep-tree.ts',weapons='/src/sim/weapons.ts';
    const {stepRun}=await import(engine),{deepLegalNodes,deepPointCost}=await import(tree),{applyUpgrade}=await import(weapons);
    const s=window.__game.state()!;
    for(let guard=0;guard<100;guard++){const id=deepLegalNodes(s)[0];if(!id)break;applyUpgrade(s,id);}
    s.choicesSpent=deepPointCost(s.treeNodes!,s);s.choicesEarned=s.choicesSpent+1;
    s.draft=null;s.pauseReasons=[];s.waveFlow!.phase='combat';stepRun(s);window.__game.ticks(0);
    return {wave:s.waveFlow!.wave,draft:s.draft,legal:deepLegalNodes(s).length};
  });
  expect(full).toEqual({wave:3,draft:null,legal:0});await expect(page.locator('.wave-allocation')).toHaveCount(0);
});
});
