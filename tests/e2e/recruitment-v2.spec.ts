import {test,expect,type Page} from '@playwright/test';
async function ready(page:Page){await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);}
async function visit(page:Page){await page.locator('.game-dock [data-action="recruitment"]').click();}

for(const viewport of [{width:320,height:500},{width:390,height:844},{width:1440,height:900}]){
  test(`draw button and receipt stay above navigation at ${viewport.width}`,async({page})=>{
    await page.setViewportSize(viewport);await ready(page);
    await page.evaluate(async()=>{window.__game.getSave().collection.tickets=1;await window.__game.save();});await visit(page);
    for(const afterDraw of [false,true]){
      if(afterDraw){await page.locator('[data-action="draw"]').click();await expect(page.locator('.recruitment-receipt')).toBeVisible();}
      const action=await page.locator('[data-action="draw"]').boundingBox(),dock=await page.locator('.game-dock').boundingBox();
      expect(action!.y+action!.height).toBeLessThanOrEqual(dock!.y);
      const catalog=await page.locator('.recruit-v2-catalog').boundingBox();
      expect(catalog!.height).toBeGreaterThan(90);
      if(afterDraw)await expect(page.locator('.recruitment-receipt')).toBeInViewport({ratio:1});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(viewport.width);
      expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height);
    }
  });
  test(`merged recruitment opens full-screen artwork and restores browsing at ${viewport.width}`,async({page})=>{
    await page.setViewportSize(viewport);await ready(page);await visit(page);
    await expect(page.locator('.recruit-v2-tabs button')).toHaveText(['招募','兌換']);
    await expect(page.locator('.recruit-item')).toHaveCount(10);
    const before=await page.evaluate(()=>structuredClone(window.__game.getSave().collection));
    for(const view of ['draw','exchange']){
      await page.locator(`[data-action="recruit-tab"][data-id="${view}"]`).click();
      const trigger=page.locator('.recruit-card-grid [data-action="recruit-preview"]').last();
      const name=(await trigger.locator('img').getAttribute('alt'))!;
      await trigger.scrollIntoViewIfNeeded();
      const scroll=await page.locator('.recruit-v2-catalog').evaluate(e=>e.scrollTop);
      await trigger.focus();await page.keyboard.press('Enter');
      const viewer=page.getByRole('dialog',{name,exact:true});
      await expect(viewer).toBeVisible();
      const bounds=await viewer.boundingBox();
      expect(bounds!.x).toBe(0);expect(bounds!.y).toBe(0);
      expect(Math.abs(bounds!.width-viewport.width)).toBeLessThan(1);
      expect(Math.abs(bounds!.height-viewport.height)).toBeLessThan(1);
      await expect(viewer.locator('img')).toHaveAttribute('alt',`${name}完整立繪`);
      await expect(viewer.locator('img')).toHaveCSS('object-fit','contain');
      expect(await page.locator('.recruitment-v2').evaluate(e=>(e as HTMLElement).inert)).toBe(true);
      await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'關閉大圖'})).toBeFocused();
      if(view==='draw')await page.keyboard.press('Escape');else await page.getByRole('button',{name:'關閉大圖'}).click();
      await expect(viewer).toHaveCount(0);await expect(trigger).toBeFocused();
      expect(await page.locator('.recruit-v2-catalog').evaluate(e=>e.scrollTop)).toBe(scroll);
    }
    expect(await page.evaluate(()=>window.__game.getSave().collection)).toEqual(before);
    await page.locator('[data-action="recruit-tab"][data-id="draw"]').click();
    await page.evaluate(async()=>{window.__game.getSave().collection.tickets=1;await window.__game.save();window.__game.route('recruitment');});
    await page.locator('[data-action="draw"]').click();
    const receipt=page.locator('.recruitment-receipt [data-action="recruit-preview"]');
    await expect(receipt).toBeVisible();await receipt.click();
    await expect(page.locator('.recruit-art-viewer')).toBeVisible();
    await page.getByRole('button',{name:'關閉大圖'}).click();
    await expect(receipt).toBeFocused();
  });
}

test('pool rates, content, rules and exchange tab match the redesigned pool',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await ready(page);await visit(page);await expect(page.locator('[data-action="draw"]')).toBeDisabled();
  await expect(page.locator('.recruit-guarantee')).toContainText('10 抽');
  await expect(page.locator('.recruit-v2-tabs button')).toHaveText(['招募','兌換']);
  await expect(page.locator('.recruit-item')).toHaveCount(10);
  await expect(page.locator('.recruit-item-rate').filter({hasText:/^15%$/})).toHaveCount(2);
  await expect(page.locator('.recruit-item-rate').filter({hasText:/^8.75%$/})).toHaveCount(8);
  await page.getByRole('button',{name:'獎池機率與規則'}).click();
  await expect(page.getByRole('dialog')).toContainText('20 共鳴點數');
  await expect(page.getByRole('dialog')).toContainText('10 抽內');
  await page.keyboard.press('Escape');
  await page.locator('[data-action="recruit-tab"][data-id="exchange"]').click();
  await expect(page.locator('[data-action="exchange"]:disabled')).toHaveCount(10);
  expect(errors).toEqual([]);
});

test('double click draws once, commits the new guarantee state and survives reload',async({page})=>{
  await ready(page);await page.evaluate(async()=>{window.__game.getSave().collection.tickets=2;await window.__game.save();});await visit(page);
  await page.locator('[data-action="draw"]').evaluate(b=>{(b as HTMLButtonElement).click();(b as HTMLButtonElement).click();});
  await expect(page.locator('.recruitment-receipt')).toBeVisible();
  const saved=await page.evaluate(()=>structuredClone(window.__game.getSave().collection));
  expect(saved.tickets).toBe(1);expect(saved.sequence).toBe(1);expect(saved.drawsSinceNew).toBe(0);
  await page.reload();await page.waitForFunction(()=>!!window.__game);await visit(page);
  expect(await page.evaluate(()=>window.__game.getSave().collection)).toEqual(saved);
  await expect(page.locator('.recruitment-receipt')).toBeVisible();
});

test('exchange preserves guarantee count, reveals receipt, and unlocks only the selected form',async({page})=>{
  await ready(page);await page.evaluate(async()=>{const c=window.__game.getSave().collection;c.points=100;c.drawsSinceNew=8;await window.__game.save();});await visit(page);
  await page.locator('[data-action="recruit-tab"][data-id="exchange"]').click();
  await page.locator('[data-action="exchange"][data-id="C07-summer"]').click();
  await expect(page.locator('.recruitment-receipt')).toContainText('兌換成功');
  await expect(page.locator('.recruit-guarantee')).toContainText('再 2 抽');
  const c=await page.evaluate(()=>window.__game.getSave().collection);
  expect(c.points).toBe(0);expect(c.owned).toContain('C07-summer');expect(c.owned).not.toContain('C07-original');
});

test('guaranteed draw is unowned and full collection cannot consume resources',async({page})=>{
  await ready(page);await page.evaluate(async()=>{const c=window.__game.getSave().collection;c.owned.push('C01-summer');c.tickets=2;c.drawsSinceNew=9;await window.__game.save();});await visit(page);
  await expect(page.locator('.recruit-guarantee')).toContainText('本次必得');await page.locator('[data-action="draw"]').click();
  await expect(page.locator('.recruitment-receipt')).toContainText('保底招募');
  expect((await page.evaluate(()=>window.__game.getSave().collection.lastReceipt))?.duplicate).toBe(false);
  await page.evaluate(async()=>{const s=window.__game.getSave(),path='/src/data/forms.ts';const {POOL}=await import(path);s.collection.owned=[...new Set([...s.collection.owned,...POOL.map((f:{id:string})=>f.id)])] as typeof s.collection.owned;await window.__game.save();window.__game.route('recruitment');});
  await expect(page.locator('[data-action="draw"]')).toBeDisabled();
  expect(await page.evaluate(()=>window.__game.getSave().collection.tickets)).toBe(1);
});

test('legacy points and fragments migrate once and fund both draw and exchange',async({page})=>{
  await ready(page);await page.evaluate(async()=>{
    await window.__game.save();const saved=structuredClone(window.__game.getSave());
    const raw={...saved,collection:{...saved.collection,version:1,points:125,fragments:75}};
    await new Promise<void>((resolve,reject)=>{const req=indexedDB.open('starfall-defense',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('records','readwrite');tx.objectStore('records').put(raw,'save');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);});
  });
  await page.reload();await page.waitForFunction(()=>!!window.__game);await visit(page);
  await expect(page.locator('.hud-resources')).toContainText('共鳴點數');
  expect(await page.evaluate(()=>window.__game.getSave().collection.points)).toBe(200);
  await page.locator('[data-action="draw"]').click();await expect(page.locator('.recruitment-receipt')).toBeVisible();
  expect(await page.evaluate(()=>window.__game.getSave().collection.points)).toBe(100);
  expect(await page.evaluate(()=>window.__game.getSave().collection.lastReceipt!.spent)).toBe('points');
  await page.locator('[data-action="recruit-tab"][data-id="exchange"]').click();await page.locator('[data-action="exchange"]:enabled').first().click();
  await expect(page.locator('.recruitment-receipt')).toContainText('兌換成功');
  const after=await page.evaluate(()=>structuredClone(window.__game.getSave().collection));expect(after.points).toBe(0);expect(after.version).toBe(2);expect(after).not.toHaveProperty('fragments');
  await page.reload();await page.waitForFunction(()=>!!window.__game);
  expect(await page.evaluate(()=>window.__game.getSave().collection)).toEqual(after);
});
