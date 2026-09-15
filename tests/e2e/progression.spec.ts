import { expect,test } from '@playwright/test';
for(const viewport of [{width:320,height:500},{width:1440,height:900}])test(`stage budgets and wave previews at ${viewport.width}`,async({page},info)=>{
  await page.setViewportSize(viewport);await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  const results=await page.evaluate(async()=>{
    const profileModule='/src/data/progression.ts',uiModule='/src/ui/tactical-command.ts',engineModule='/src/sim/engine.ts';
    const {stageProfile}=await import(profileModule),{tacticalCommand}=await import(uiModule),{createRun}=await import(engineModule);
    return ['S01','S03','S12','X03'].flatMap(stageId=>(['easy','hard'] as const).map(difficulty=>{
      const p=stageProfile(stageId,difficulty),run=createRun({stageId,difficulty,squadIds:['C01'],captainId:'C01',seed:101});
      const vm={stageId,commandView:'intel'},save=window.__game.getSave();
      save.profile.easyCleared=['S01','S03','S12','X03'];save.preferences.difficulty=difficulty;
      const intel=tacticalCommand(save,vm),waves=tacticalCommand(save,{...vm,commandView:'waves'});
      return {stageId,difficulty,points:p.points,enemies:p.enemies,count:p.waves.length,intel,waves,actual:run.spawnPlan.length,xp:run.spawnPlan.reduce((n:number,e:{xp:number})=>n+e.xp,0)};
    }));
  });
  for(const row of results){
    expect(row.actual).toBe(row.enemies);expect(row.xp).toBe(row.points*30-42);
    await page.locator('#app').evaluate((app,html)=>{app.innerHTML=html;},row.intel);
    await expect(page.locator('.tactical-facts')).toContainText(`${row.points} 點`);await expect(page.locator('.tactical-facts')).toContainText(`${row.enemies} 隻`);
    await page.screenshot({path:info.outputPath(`${row.stageId}-${row.difficulty}-${viewport.width}.png`),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.locator('#app').evaluate((app,html)=>{app.innerHTML=html;},row.waves);
    await expect(page.locator('.tactical-wave-list article')).toHaveCount(row.count);
    await expect(page.locator('.tactical-wave-list article').first()).toContainText('前哨推進');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
});

for(const width of [320,1440])test.describe(`unlimited operation ${width}`,()=>{
  test.use({isMobile:width===320,hasTouch:width===320});
  test(`unlimited battle keeps clocks and waves visible at ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:width===320?500:900});
  await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  await page.evaluate(()=>window.__game.start({stageId:'S01',squadIds:['C01'],captainId:'C01',seed:101}));
  await page.locator('#battle-loading').waitFor({state:'detached'});
  await page.locator('[data-action="tutorial-done"]').first().click();
  await expect(page.locator('#time-text')).toContainText('已戰鬥');
  await expect(page.locator('#wave-text')).toBeVisible();
  await expect(page.locator('#wave-text')).toContainText('WAVE 1 / 5');
  await expect(page.locator('#boss-countdown')).toContainText('首領倒數');
  await page.screenshot({path:info.outputPath(`unlimited-hud-${width}.png`)});
  const result=await page.evaluate(async()=>{
    const p='/src/data/progression.ts',e='/src/sim/engine.ts';
    const {operationProfile}=await import(p),{restoreRun}=await import(e),s=window.__game.state()!;
    s.enemies=[];s.projectiles=[];s.fields=[];s.scheduled=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;
    s.tick=(operationProfile(s).deadline+300)*30;
    s.weapons.forEach(w=>w.nextAttack=999999);s.tacticalReadyAt=999999;
    return restoreRun(s).tick;
  });
  await expect(page.locator('#boss-countdown')).toHaveText('首領降臨');
  await expect(page.locator('#wave-text')).toHaveText('WAVE 5 / 5');
  await expect.poll(()=>page.evaluate(()=>window.__game.state()!.tick)).toBeGreaterThan(result);
  expect(await page.evaluate(()=>window.__game.state()!.outcome)).toBeNull();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
});
