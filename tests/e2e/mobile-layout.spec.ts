import { expect, test } from '@playwright/test';
import { phoneSizes, ready, fitsScreen, reachable, finishWave, startBattle } from '../helpers/mobile-ui';

for (const size of phoneSizes) test(`MOBILE: ${size.width}×${size.height} current entry points and paged screens fit`, async ({page},info) => {
  await page.setViewportSize(size); await ready(page);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await fitsScreen(page);await reachable(page.locator('[data-action=start]'));await reachable(page.locator('.offline-summary'));
  await page.getByRole('button',{name:'作戰功能與說明'}).click();
  for(const name of ['情報','波次','敵情']){
    await page.getByRole('tab',{name,exact:true}).click();await fitsScreen(page);
    const trigger=page.getByRole('button',{name:`閱讀完整${name}`});await reachable(trigger);await trigger.click();
    await reachable(page.getByRole('button',{name:'關閉詳細資訊',exact:true}));await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  }
  await page.locator('.game-dock [data-action=roster]').click();await fitsScreen(page);await page.locator('[data-action=roster-edit]').click();
  const picker=page.getByRole('combobox',{name:'隊員',exact:true});const count=await picker.locator('option').count();
  for(let i=0;i<count;i++){await picker.selectOption(String(i));await fitsScreen(page);for(const tile of await page.locator('.roster-tile:visible').all())await reachable(tile);}
  await reachable(page.locator('[data-action=roster-commit]'));await page.locator('[data-action=roster-commit]').click();
  await page.locator('.game-dock [data-action=recruitment]').click();await fitsScreen(page);await reachable(page.locator('[data-action=draw]'));
  const pool=page.getByRole('combobox',{name:'獎池項目',exact:true});await pool.selectOption({index:2});
  const chosen=await pool.inputValue();const ability=page.getByRole('button',{name:'能力詳情',exact:true}).first();await reachable(ability);await ability.click();await page.keyboard.press('Escape');await expect(ability).toBeFocused();await expect(pool).toHaveValue(chosen);
  await page.locator('[data-action=recruit-tab][data-id=exchange]').click();await fitsScreen(page);await expect(pool).toHaveValue(chosen);
  for(const button of await page.locator('.recruit-item:not([hidden]) [data-action=exchange]').all())await reachable(button);
  await page.getByRole('button',{name:'設定',exact:true}).click();
  for(const tab of ['一般','存檔管理','離線與版本']){await page.getByRole('button',{name:tab,exact:true}).click();await fitsScreen(page);await reachable(page.locator('.settings-screen > [data-action=home]'));}
  await page.locator('.game-hud [data-action=commander]').click();await fitsScreen(page);
  for(const button of await page.locator('.mobile-commander-tabs button').all()){
    await button.click();await fitsScreen(page);for(const node of await page.locator('.commander-route:not([hidden]) .mobile-commander-node').all())await reachable(node);
  }
  await page.locator('[data-action=home]:visible').first().click();await page.locator('.hundred-entry').click();await fitsScreen(page);
  for(const action of ['start-hundred','roster','home'])await reachable(page.locator(`.hundred-screen [data-action=${action}]`));
  await page.screenshot({path:info.outputPath('hundred-entry.png')});expect(errors).toEqual([]);
});

test('MOBILE: native details retain selection and restore focus across rotation and commander upgrade',async({page})=>{
  await page.setViewportSize({width:320,height:500});await ready(page);
  await page.evaluate(()=>{window.__game.getSave().profile.commander!.xp=240;});
  await page.locator('.game-hud [data-action=commander]').click();
  const trigger=page.locator('.commander-route:not([hidden]) .mobile-commander-node').first();await trigger.click();
  const dialog=page.locator('dialog.mobile-detail[open]');await reachable(dialog.locator('[data-action=commander-upgrade]'));
  await page.setViewportSize({width:844,height:390});await expect(page.locator('.portrait-guard')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('.portrait-guard')).toBeVisible();
  await page.setViewportSize({width:320,height:500});await expect(page.locator('.portrait-guard')).not.toBeVisible();await expect(dialog).toBeVisible();
  await dialog.locator('[data-action=commander-upgrade]').click();await expect(dialog).toBeVisible();await expect(dialog.locator('[data-action=commander-upgrade]')).toBeDisabled();
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await fitsScreen(page);
});

test('MOBILE: reset confirmation and storage recovery preserve progress',async({page})=>{
  await page.setViewportSize({width:320,height:500});await ready(page);
  await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByRole('button',{name:'存檔管理',exact:true}).click();
  const trigger=page.locator('[data-action=reset-confirm]');await trigger.click();const cancel=page.locator('[data-action=cancel-confirm]'),reset=page.locator('[data-action=reset]');
  await reachable(cancel);await reachable(reset);await cancel.focus();await page.keyboard.press('Shift+Tab');await expect(reset).toBeFocused();await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  await page.locator('.game-dock [data-action=home]').click();
  await page.evaluate(async()=>{const tx=IDBDatabase.prototype.transaction;try{IDBDatabase.prototype.transaction=()=>{throw new DOMException('test','QuotaExceededError')};await window.__game.save();}finally{IDBDatabase.prototype.transaction=tx;}});
  await reachable(page.locator('[data-action=start]'));await reachable(page.locator('.offline-summary'));await fitsScreen(page);
  await page.getByRole('button',{name:'存檔需要處理',exact:true}).click();await page.locator('dialog[open] [data-action=save-retry]').click();await expect(page.locator('.system-notice')).toHaveCount(0);
});

test('MOBILE: result, resources and recruitment details remain reachable',async({page})=>{
  await page.setViewportSize({width:320,height:500});await ready(page);await page.locator('.game-dock [data-action=recruitment]').click();await expect(page.locator('[data-action=draw]')).toBeDisabled();
  await page.evaluate(async()=>{window.__game.getSave().collection.tickets=2;await window.__game.save();window.__game.route('recruitment');});
  await page.locator('[data-action=draw]').click();await expect(page.getByRole('button',{name:'招募結果',exact:true})).toBeVisible();
  for(const size of phoneSizes){await page.setViewportSize(size);await fitsScreen(page);await reachable(page.locator('[data-action=draw]'));await reachable(page.getByRole('button',{name:'招募結果',exact:true}));}
  await page.getByRole('button',{name:'招募結果',exact:true}).click();await expect(page.locator('dialog[open] .recruitment-receipt')).toBeVisible();await page.keyboard.press('Escape');
});

test('MOBILE: battle allocation toolbars and defeat actions fit all sizes; rotation preserves pending points',async({page},info)=>{
  await ready(page);await startBattle(page);
  for(const size of phoneSizes){
    await page.setViewportSize(size);await reachable(page.locator('#speed-button'));await reachable(page.locator('[data-action=pause]'));await reachable(page.locator('.range-toolbar [data-action=command-panel]'));
    for(const selector of ['#wall-text','#wave-text','.battle-intel > summary','.ultimate-strip small'])await expect(page.locator(selector).first()).toHaveCSS('font-size','14px');
  }
  await finishWave(page);
  const id=await page.evaluate(()=>window.__game.state()!.draft!.focusId);
  await page.locator(`[data-action=deep-owner][data-id=${id}]`).click();const node=page.locator('.deep-node.available').first();await node.focus();await node.press('Enter');
  const pending=await page.evaluate(()=>({tick:window.__game.state()!.tick,nodes:window.__game.state()!.draft!.pendingNodeIds}));
  for(const size of phoneSizes){await page.setViewportSize(size);for(const selector of ['[data-map-control=out]','[data-map-control=root]','[data-action=buy-node]'])await reachable(page.locator(selector));await page.screenshot({path:info.outputPath(`allocation-${size.width}x${size.height}.png`)});}
  await page.setViewportSize({width:844,height:390});await expect(page.locator('.portrait-guard')).toBeVisible();await page.setViewportSize({width:320,height:500});await expect(page.locator('.portrait-guard')).not.toBeVisible();
  expect(await page.evaluate(()=>({tick:window.__game.state()!.tick,nodes:window.__game.state()!.draft!.pendingNodeIds}))).toEqual(pending);
  expect(await page.evaluate(()=>window.__game.state()!.pauseReasons)).toEqual(expect.arrayContaining(['user','upgrade']));
  await page.locator('[data-action=buy-node]').click();await expect(page.locator('[data-action=resume]')).toBeVisible();await page.locator('[data-action=resume]').click();
  await page.evaluate(()=>{window.__game.state()!.wallHp=0;window.__game.ticks(1);});await expect(page.locator('.result-screen')).toBeVisible();
  for(const size of phoneSizes){await page.setViewportSize(size);await fitsScreen(page);await reachable(page.locator('.result-actions [data-action=retry]'));await reachable(page.locator('.result-actions [data-action=home]'));}
  await page.getByRole('button',{name:'戰鬥報告與行動後記',exact:true}).click();await expect(page.locator('dialog[open] [data-action=adjust]')).toBeVisible();
});

test('MOBILE: safe areas protect home controls at short and tall heights',async({page})=>{
  await ready(page);
  await page.evaluate(()=>{document.querySelectorAll('style[data-vite-dev-id]').forEach(s=>{s.textContent=s.textContent!.replaceAll('env(safe-area-inset-top)','34px').replaceAll('env(safe-area-inset-bottom)','34px');});});
  for(const size of [phoneSizes[0],phoneSizes[4]]){
    await page.setViewportSize(size);await fitsScreen(page);await reachable(page.locator('[data-action=start]'));await reachable(page.locator('.offline-summary'));
    await expect.poll(()=>page.locator('.game-hud').evaluate(e=>parseFloat(getComputedStyle(e).paddingTop))).toBeGreaterThanOrEqual(34);
    await expect.poll(()=>page.locator('.game-dock button').first().evaluate(e=>e.getBoundingClientRect().bottom)).toBeLessThanOrEqual(size.height-34);
  }
});

test('MOBILE: keyboard-height resize retains unfinished name and input focus',async({page})=>{
  await ready(page);await page.getByRole('button',{name:'設定',exact:true}).click();
  const input=page.locator('#commander-name');const name='二十字以內的長名稱測試';await input.fill(name);
  await page.setViewportSize({width:390,height:400});await expect(input).toBeFocused();await expect(input).toHaveValue(name);await reachable(input);
  await expect(input).toHaveCSS('font-size','16px');await fitsScreen(page);
  await page.setViewportSize({width:390,height:844});await expect(input).toBeFocused();await input.press('Tab');
  await expect.poll(()=>page.evaluate(()=>window.__game.getSave().preferences.commanderName)).toBe(name);
});

test.describe('desktop preservation',()=>{
  test.use({isMobile:false,hasTouch:false});
  test('MOBILE: transitions preserve editing state and desktop pages use original layout',async({page})=>{
    await page.setViewportSize({width:390,height:844});await ready(page);await page.locator('.game-dock [data-action=roster]').click();await page.locator('[data-action=roster-edit]').click();await page.locator('.roster-tile[data-id=C02]').click();
    for(const width of [768,1024,1440]){
      await page.setViewportSize({width,height:1024});await expect(page.locator('[data-roster-view=character]')).toBeVisible();await expect(page.locator('[data-action=captain]')).toHaveAttribute('data-id','C02');
      if(width>800){await expect(page.locator('.roster-tile:visible')).toHaveCount(8);await expect(page.locator('.portrait-guard')).not.toBeVisible();}
    }
  });
});
