import { expect,test } from '@playwright/test';
for(const viewport of [{width:320,height:500},{width:1440,height:900}])test(`stage budgets and wave previews at ${viewport.width}`,async({page},info)=>{
  await page.setViewportSize(viewport);await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  const results=await page.evaluate(async()=>{
    const profileModule='/src/data/progression.ts',uiModule='/src/ui/tactical-command.ts',engineModule='/src/sim/engine.ts';
    const {stageProfile}=await import(profileModule),{tacticalCommand}=await import(uiModule),{createRun}=await import(engineModule);
    return ['S01','S03','S12','X03'].map(stageId=>{
      const p=stageProfile(stageId),run=createRun({stageId,squadIds:['C01'],captainId:'C01',seed:101});
      const vm={stageId,commandView:'intel'},save=window.__game.getSave();
      const intel=tacticalCommand(save,vm),waves=tacticalCommand(save,{...vm,commandView:'waves'});
      return {stageId,points:p.points,enemies:p.enemies,count:p.waves.length,intel,waves,actual:run.spawnPlan.length,xp:run.spawnPlan.reduce((n:number,e:{xp:number})=>n+e.xp,0)};
    });
  });
  for(const row of results){
    expect(row.actual).toBe(row.enemies);expect(row.xp).toBe(row.points*30);
    await page.locator('#app').evaluate((app,html)=>{app.innerHTML=html;},row.intel);
    await expect(page.locator('.tactical-facts')).toContainText(`${row.points} 點`);await expect(page.locator('.tactical-facts')).toContainText(`${row.enemies} 隻`);
    await page.screenshot({path:info.outputPath(`${row.stageId}-${viewport.width}.png`),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.locator('#app').evaluate((app,html)=>{app.innerHTML=html;},row.waves);
    await expect(page.locator('.tactical-wave-list article')).toHaveCount(row.count);
  }
});
