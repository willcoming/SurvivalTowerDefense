import { expect,test } from '@playwright/test';
import { finishWave } from '../helpers/mobile-ui';
for(const width of [320,1440])test.describe(`百波挑戰 ${width}`,()=>{
 test.use({isMobile:width===320,hasTouch:width===320});
 test('entry, battle, defeat, retry and persistent best score',async({page},info)=>{
  await page.setViewportSize({width,height:width===320?640:900});
  await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  await page.screenshot({path:info.outputPath('hundred-home.png')});
  await page.locator('.hundred-entry').click();
  await expect(page.getByRole('heading',{name:/百波挑戰$/,level:1})).toBeVisible();
  await expect(page.getByRole('region',{name:'百波最高成績'})).toContainText('尚未挑戰');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('hundred-entry.png'),fullPage:true});
  await page.locator('[data-action="start-hundred"]').click();
  await page.locator('#battle-loading').waitFor({state:'detached'});
  await page.locator('[data-action="tutorial-done"]').first().click();
  await expect(page.locator('#wave-text')).toContainText('WAVE 1 / 100');
  const seed=await page.evaluate(()=>window.__game.state()!.config.seed);
  expect(await page.evaluate(()=>window.__game.state()!.config.mode)).toBe('hundred');
  await page.screenshot({path:info.outputPath('hundred-battle.png')});
  while(await page.evaluate(()=>window.__game.state()!.waveFlow!.wave<4)) { await finishWave(page); await page.locator('[data-action=bank-wave-points]').click(); }
  const kills=await page.evaluate(()=>window.__game.state()!.stats.kills);
  await page.evaluate(()=>{window.__game.state()!.wallHp=0;window.__game.ticks(1);});
  await expect(page.locator('.result-screen')).toBeVisible();
  await expect(page.getByRole('heading',{name:'本次完成 3 / 100 波'})).toBeVisible();
  if(width===320) await page.getByRole('button',{name:'戰鬥報告與行動後記',exact:true}).click();
  await expect(page.getByRole('region',{name:'百波最高成績'})).toContainText('3 / 100 波');
  if(width===320) await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>window.__game.getSave().profile.cleared)).toEqual([]);
  await page.screenshot({path:info.outputPath('hundred-result.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('[data-action="retry"]').click();
  await page.locator('#battle-loading').waitFor({state:'detached'});
  expect(await page.evaluate(()=>window.__game.state()!.config)).toMatchObject({mode:'hundred',seed});
  await page.locator('[data-action="pause"]').click();
  await page.locator('[data-action="abandon-confirm"]').click();
  await page.locator('[data-action="abandon"]').click();
  await expect(page.locator('.result-screen')).toBeVisible();
  await page.reload();await page.waitForFunction(()=>!!window.__game);
  await expect(page.locator('.hundred-entry')).toContainText('最高 3 波');
  await page.locator('.hundred-entry').click();
  await expect(page.getByRole('region',{name:'百波最高成績'})).toContainText(`擊殺 ${kills}`);
 });
});
test('hundred-wave victory records 100 without unlocking campaign progression',async({page})=>{
 await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
 await page.locator('.hundred-entry').click();await page.locator('[data-action="start-hundred"]').click();
 await page.locator('#battle-loading').waitFor({state:'detached'});
 await page.locator('[data-action="tutorial-done"]').first().click();
 await page.evaluate(async()=>{
  const engine='/src/sim/engine.ts',combat='/src/sim/combat.ts';const {stepRun,command}=await import(engine),{hitEnemy}=await import(combat),s=window.__game.state()!;
  for(let i=0;i<300000&&!s.outcome;i++){
   if(s.draft)command(s,{type:'confirm-node',offerId:s.draft.id,nodeIds:[]});
   if(s.bossIntro)command(s,{type:'finish-boss-intro'});
   for(const enemy of s.enemies)if(enemy.hp>0)hitEnemy(s,enemy,{source:'C01',skill:'test',raw:1e9,damageType:'plasma',armorIgnore:1,shieldMultiplier:1});
   stepRun(s);
  }
  window.__game.ticks(0);
 });
 await expect(page.locator('.result-screen')).toBeVisible();
 await expect(page.getByRole('heading',{name:'本次完成 100 / 100 波'})).toBeVisible();
 await expect(page.locator('[data-action="next-stage"]')).toHaveCount(0);
 await expect(page.locator('.result-story')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__game.getSave().profile.cleared)).toEqual([]);
 await page.reload();await page.waitForFunction(()=>!!window.__game);
 await expect(page.locator('.hundred-entry')).toContainText('最高 100 波');
});
