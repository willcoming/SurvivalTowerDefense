import {test,expect,type Page} from '@playwright/test';
async function ready(page:Page){await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);}

test('summer-first exchange recruits its owner and preserves the missing original form',async({page})=>{
  await ready(page);await page.evaluate(async()=>{window.__game.getSave().collection.points=100;await window.__game.save();window.__game.route('recruitment');});
  await page.locator('[data-action="recruit-tab"][data-id="exchange"]').click();await page.locator('[data-action="exchange"][data-id="C07-summer"]').click();
  await expect(page.locator('.recruitment-receipt')).toContainText('兌換成功');await page.locator('.game-dock [data-action="roster"]').click();
  await page.locator('[data-action="roster-edit"]').click();await expect(page.locator('.roster-tile[data-id="C07"]')).toContainText('待命');await page.locator('.roster-tile[data-id="C07"]').click();
  await page.locator('[data-action="roster-wardrobe"]').click();
  await page.locator('[data-action="roster-preview"][data-id="C07-original"]').click();await expect(page.locator('[data-action="roster-equip"]')).toBeDisabled();
  await page.locator('[data-action="roster-preview"][data-id="C07-summer"]').click();await expect(page.locator('[data-action="roster-equip"]')).toHaveText('已選用');
  const c=await page.evaluate(()=>window.__game.getSave().collection);expect(c.owned).toContain('C07-summer');expect(c.owned).not.toContain('C07-original');
  await page.reload();await page.waitForFunction(()=>!!window.__game);expect(await page.evaluate(async()=>{const path='/src/storage/collection.ts';const {ownedForm}=await import(path);return ownedForm(window.__game.getSave().collection,'C07');})).toBe('C07-summer');
});

test('all original and summer collection artwork uses complete current images',async({page})=>{
  const loaded=new Set<string>(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());if(r.ok())loaded.add(new URL(r.url()).pathname);});
  await ready(page);await page.locator('.game-dock [data-action="recruitment"]').click();
  await expect(page.locator('.recruit-item')).toHaveCount(10);await expect(page.locator('[data-action="draw"]')).toBeDisabled();
  for(const trigger of await page.locator('.recruit-card-grid [data-action="recruit-preview"]').all()){
    await trigger.scrollIntoViewIfNeeded();await trigger.click();await expect(page.locator('.recruit-art-viewer img')).toHaveCSS('object-fit','contain');
    await expect.poll(()=>page.locator('.recruit-art-viewer img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
  }
  for(const owner of ['C07','C08'])for(const theme of ['original','summer'])expect(loaded.has(`/assets/forms/${owner}-${theme}-${theme==='summer'?'pose-v4':'stage-v3'}.webp`)).toBe(true);
  expect([...loaded].some(path=>/\/C0[78]-(original|summer)(-stage-v2)?\.webp$|\/C0[78]-summer-stage-v3\.webp$/.test(path))).toBe(false);expect(errors).toEqual([]);
});

test('both new captains deploy with their selected form and leaving clears the battle',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
  await page.evaluate(async()=>{const s=window.__game.getSave();s.collection.owned.push('C07-original','C07-summer','C08-original','C08-summer');s.preferences.tutorialSeen=true;await window.__game.save();});
  for(const theme of ['original','summer'] as const)for(const captainId of ['C07','C08'] as const){
    await page.evaluate(async({theme,captainId})=>window.__game.start({stageId:'S01',squadIds:['C07','C08','C02','C03','C05'],captainId,seed:101,forms:{C07:`C07-${theme}`,C08:`C08-${theme}`}}),{theme,captainId});
    await page.locator('#battle-loading').waitFor({state:'detached'});
    await expect(page.locator('#mechanic-readout')).toContainText('地雷');await expect(page.locator('#mechanic-readout')).toContainText('熱量');
    expect(await page.evaluate(()=>window.__game.state()!.config.captainId)).toBe(captainId);
    expect(await page.evaluate(()=>window.__game.state()!.config.forms)).toMatchObject({C07:`C07-${theme}`,C08:`C08-${theme}`});
    await page.evaluate(()=>window.__game.route('home'));expect(await page.evaluate(()=>window.__game.getSave().activeRun)).toBeNull();
  }
  expect(errors).toEqual([]);
});
