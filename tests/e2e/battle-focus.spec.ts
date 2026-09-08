import { test, expect, type Page } from '@playwright/test';
async function boot(page:Page) {
  await page.routeWebSocket('**/*',s=>s.close());
  await page.goto('/'); await page.waitForFunction(()=>!!window.__game);
  await page.evaluate(()=>window.__game.start({stageId:'S03',squadIds:['C01'],captainId:'C01',seed:101}));
  await page.locator('#battle-loading').waitFor({state:'detached'});
  await page.locator('[data-action="tutorial-done"]').first().click();
}
for (const size of [{width:320,height:500},{width:390,height:844},{width:430,height:932}]) test(`focused battle fills ${size.width}×${size.height}`,async({page})=>{
  await page.setViewportSize(size); await boot(page);
  const canvas=await page.locator('canvas').boundingBox();
  await expect(page.locator('.game-hud')).not.toBeVisible();
  await expect(page.locator('.game-dock')).not.toBeVisible();
  const stage=await page.locator('.battle-layout').boundingBox();
  expect(stage!.y).toBe(0);
  expect(Math.abs(stage!.height-size.height)).toBeLessThan(1);
  expect(canvas!.height/stage!.height).toBeGreaterThan(.5);
  expect(canvas!.height).toBeGreaterThan(160);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('#weapon-strip')).not.toBeVisible();
  await page.locator('.battle-intel summary').click();
  await expect(page.locator('#range-C01')).toBeVisible();
  await page.locator('#range-C01').click();
  await expect(page.locator('#range-C01')).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#weapon-strip')).not.toBeVisible();
  expect(await page.evaluate(()=>window.__game.state()!.phase)).toBe('running');
  for(const selector of ['#speed-button','[data-action="pause"]','#auto-tactical-button','.battle-intel summary']) {
    const box=await page.locator(selector).boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await page.locator('.battle-header-controls [data-action="pause"]').click();
  const pause=page.locator('.pause-dialog');
  await expect(pause.locator('#pause-title')).toHaveCSS('font-size','24px');
  await expect(pause.locator(':scope > .eyebrow')).toHaveCSS('font-size','14px');
  await expect(pause.locator(':scope > p').first()).toHaveCSS('font-size','16px');
  for(const button of await pause.locator('button:visible').all()) {
    await expect(button).toHaveCSS('font-size','16px');
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  }
  await pause.locator('[data-action="resume"]').click();
  expect(await page.evaluate(()=>window.__game.state()!.phase)).toBe('running');
});
for(const boss of ['B01','B02','B03'] as const) test(`${boss} actual attack drives wall feedback`,async({page})=>{
  await boot(page);
  const before=await page.evaluate(async boss=>{
    const path='/src/sim/combat.ts';const {createEnemy}=await import(path);const s=window.__game.state()!;
    s.enemies=[];s.projectiles=[];s.fields=[];s.scheduled=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;
    s.weapons.forEach(w=>w.nextAttack=999999);s.tacticalReadyAt=999999;
    const e=createEnemy(s,boss,195,150,9);e.abilityAt=s.tick;e.hp=e.maxHp=100000;
    return s.wallHp;
  },boss);
  await page.waitForFunction(()=>window.__game.presentation().bossAssault.releases>0);
  const result=await page.evaluate(()=>({hp:window.__game.state()!.wallHp,view:window.__game.presentation().bossAssault}));
  expect(result.hp).toBeLessThan(before);expect(result.view.impactVisible).toBe(true);expect(result.view.active[0].type).toBe(boss);
  expect(result.view.impactText).toContain('防線 −');
  if(boss==='B02') await page.waitForFunction(()=>window.__game.presentation().bossAssault.releases===3);
});
test('dense horde retains only priority weakness markers',async({page})=>{
  await boot(page);
  const priority=await page.evaluate(async()=>{
    const path='/src/sim/combat.ts';const {createEnemy}=await import(path);const s=window.__game.state()!;
    s.enemies=[];s.spawnCursor=s.spawnPlan.length;s.weapons.forEach(w=>w.nextAttack=999999);
    for(let i=0;i<32;i++) {const e=createEnemy(s,'E01',24+(i%8)*48,40+Math.floor(i/8)*24,9);e.speed=0;}
    return [createEnemy(s,'B01',195,150,9).id,createEnemy(s,'E07',100,200,9).id];
  });
  await expect.poll(()=>page.evaluate(()=>window.__game.presentation().weaknessMarkers)).toEqual(priority);
});
