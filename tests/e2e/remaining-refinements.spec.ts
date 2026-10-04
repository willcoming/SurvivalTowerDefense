import {test,expect} from '@playwright/test';
import {ready,startBattle,reachable} from '../helpers/mobile-ui';
for(const viewport of [{width:320,height:500},{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900}])test.describe(`remaining improvements ${viewport.width}`,()=>{
 test.use({isMobile:viewport.width<=800,hasTouch:viewport.width<=800});
 test('common skills show effects, cost and prerequisite, then preserve detail and focus',async({page},info)=>{
  await page.setViewportSize(viewport);await ready(page);await page.evaluate(()=>{window.__game.getSave().profile.commander!.xp=240;window.__game.route('commander');});
  const lane=page.locator('.commander-route:not([hidden])').first();
  if(viewport.width<=800){
   const card=lane.locator('.mobile-commander-node').first();await expect(card.locator('.commander-node-effect')).toContainText('防線');await expect(card).toContainText('成本 1 點 · 前置：無前置');
   await card.click();const dialog=page.locator('.commander-node-dialog[open]');await expect(dialog).toBeVisible();expect((await dialog.boundingBox())!.height).toBeLessThan(viewport.height-60);
   await dialog.locator('[data-action=commander-upgrade]').click();await expect(dialog).toBeVisible();await expect(dialog.locator('[data-action=commander-upgrade]')).toBeDisabled();await page.keyboard.press('Escape');await expect(card).toBeFocused();
   const next=lane.locator('.mobile-commander-node').nth(1);await next.scrollIntoViewIfNeeded();await expect(next.locator('.commander-node-requirement')).toContainText('✓ 已升級');await reachable(next);
  }else{await expect(lane.locator('.commander-node-requirement').first()).toContainText('無前置');await lane.locator('[data-action=commander-upgrade]').first().click();await expect(lane.locator('.commander-node-requirement').nth(1)).toContainText('✓ 已升級');}
  await page.screenshot({path:info.outputPath(`common-skills-${viewport.width}.png`)});
 });
 test('reward state follows auto-award rules and preview never creates a claim',async({page},info)=>{
  await page.setViewportSize(viewport);await ready(page);const cases=page.locator('.durability-reward');
  await expect(cases.locator('.reward-state')).toHaveText(['未達成','未達成','未達成']);
  const before=await page.evaluate(()=>structuredClone(window.__game.getSave().collection));await cases.first().click();await expect(page.locator('.reward-preview-dialog')).toContainText('自動發放');await expect(page.locator('.reward-preview-dialog')).toContainText('無需手動領取');await page.keyboard.press('Escape');expect(await page.evaluate(()=>window.__game.getSave().collection)).toEqual(before);
  await page.evaluate(async()=>{const e='/src/sim/engine.ts',r='/src/storage/mission-rewards.ts';const {createRun}=await import(e),{awardDifficulty}=await import(r);const run=createRun({stageId:'S01',difficulty:'easy',squadIds:['C01'],captainId:'C01',seed:3});run.outcome='victory';run.wallHp=run.wallMaxHp*.5;const c=window.__game.getSave().collection;awardDifficulty(c,run);awardDifficulty(c,run);window.__game.route('home');});
  await expect(cases.locator('.reward-state')).toHaveText(['✓ 已領取','✓ 已領取','未達成']);expect(await page.evaluate(()=>window.__game.getSave().collection.points)).toBe(before.points+50);
  await cases.first().click();await expect(page.locator('.reward-preview-state')).toContainText('已領取');await page.keyboard.press('Escape');await reachable(page.locator('[data-action=start]'));
  await page.screenshot({path:info.outputPath(`reward-state-${viewport.width}.png`)});
 });
 test('defeat shows recorded pressure and counter beside retry without opening a report',async({page},info)=>{
  await page.setViewportSize(viewport);await ready(page);await startBattle(page);
  await page.evaluate(()=>{const s=window.__game.state()!;s.wallHp=0;s.stats.wallDamageByEnemy={E05:800,E02:200};s.outcome='wall';s.phase='ended';window.__game.ticks(0);});
  const insight=page.getByRole('region',{name:'本局原因與重試建議'});await expect(insight).toBeVisible();await expect(insight).toContainText('800');await expect(insight).toContainText('80%');await expect(insight).toContainText('不代表最後一擊');
  expect(await insight.evaluate(el=>el.nextElementSibling?.classList.contains('result-actions'))).toBe(true);
  const retry=page.locator('[data-action=retry]');await retry.scrollIntoViewIfNeeded();await reachable(retry);await page.screenshot({path:info.outputPath(`defeat-retry-${viewport.width}.png`)});await retry.click();await expect(page.locator('.battle-canvas')).toBeVisible();
 });
 test('boss health stays outside charge warnings and combat effects',async({page},info)=>{
  await page.setViewportSize(viewport);await ready(page);await startBattle(page);
  await page.evaluate(async()=>{const path='/src/sim/combat.ts';const {createEnemy,applyEffect}=await import(path);const s=window.__game.state()!;s.enemies=[];s.projectiles=[];s.fields=[];s.scheduled=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.wallHp=s.wallMaxHp=100000;s.weapons.forEach(w=>w.nextAttack=1e9);const boss=createEnemy(s,'B01',195,150,0);boss.hp=90000;boss.maxHp=100000;boss.speed=0;boss.chargeKind='boss';boss.chargeUntil=s.tick+180;applyEffect(s,boss,{id:'qa-burn',kind:'burn',source:'C05',value:8,expires:s.tick+300,nextTick:s.tick+1,armorIgnore:0});window.__game.ticks(0);});
  await expect(page.locator('#boss-health')).toBeVisible();await expect(page.locator('#boss-health-value')).toContainText('100,000');
  await page.waitForFunction(()=>(window.__game.presentation() as any).warnings.visible&&(window.__game.presentation() as any).burnNumbers.length>0);
  const positions=await page.evaluate(()=>({health:document.querySelector('#boss-health')!.getBoundingClientRect().bottom,canvas:document.querySelector('#battle-canvas')!.getBoundingClientRect().top,numbers:(window.__game.presentation() as any).burnNumbers,warnings:(window.__game.presentation() as any).warnings}));
  expect(positions.health).toBeLessThanOrEqual(positions.canvas+1);for(const n of positions.numbers)expect(n.y).toBeGreaterThan(positions.warnings.bottom+5);
  await page.screenshot({path:info.outputPath(`boss-clear-${viewport.width}.png`)});
 });
});
