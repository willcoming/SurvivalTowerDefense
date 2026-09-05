import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const dir=process.env.VALIDATION_OUTPUT_DIR??'artifacts/validation/skill-trees/browser';
mkdirSync(`${dir}/screenshots`,{recursive:true});
async function boot(page:Page) {
  await page.routeWebSocket('**/*',socket=>socket.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  // Frozen 0.2 regression: these assertions intentionally cover the saved three-card UI.
  await page.evaluate(()=>window.__game.start({stageId:'S01',squadIds:['C01','C02','C03','C05','C06'],captainId:'C02',seed:101},'0.2.0-dev.1'));
  await page.locator('#battle-loading').waitFor({state:'detached'});await page.locator('[data-action="tutorial-done"]').first().click();
}
async function draft(page:Page,synthetic=false) {
  await page.evaluate(synthetic=>{if(synthetic){const s=window.__game.state()!;s.xp=720;s.choicesEarned=18;}window.__game.ticks(synthetic?1:1200);},synthetic);
  await expect(page.locator('.tree-upgrade')).toBeVisible();
}
async function selectTreeNode(page:Page,id:string){
  const node=page.locator(`[data-action="tree-node"][data-id="${id}"]`),pager=page.getByRole('combobox',{name:'技能階段',exact:true});
  if(await pager.count())await pager.selectOption((await node.getAttribute('data-layer'))!);
  await node.click();
}
async function openTree(page:Page) {
  const pager=page.getByRole('combobox',{name:'升級候選',exact:true});
  if(await pager.count())await pager.selectOption('0');
  await page.locator('[data-action="tree-open"]').click();
}
async function candidate(page:Page,id:string) {
  const tree=id.split(':')[0],owner=tree.slice(0,3);
  await openTree(page);await page.locator(`[data-action="tree-character"][data-id="${owner}"]`).click();
  await page.locator(`[data-action="tree-tab"][data-id="${tree}"]`).click();await selectTreeNode(page,id);
  await page.locator('[data-action="tree-candidate"]').click();
}
async function take(page:Page,id:string) {await candidate(page,id);await page.locator('[data-action="confirm-card"]').click();}

test('TREE: real earned upgrade, locked preview, separate confirmation, cross-tree candidate and restored random slots',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);await draft(page);
  expect(await page.evaluate(()=>window.__game.state()!.contentVersion)).toBe('0.2.0-dev.1');
  await expect(page.locator('.upgrade-card')).toHaveCount(3);await expect(page.locator('[data-action="confirm-card"]')).toBeDisabled();
  const before=await page.evaluate(()=>structuredClone(window.__game.state()!));
  await page.locator('[data-action="tree-open"]').click();await page.locator('[data-action="tree-character"][data-id="C01"]').click();
  await expect(page.locator('.tree-tabs button')).toHaveCount(3);
  await selectTreeNode(page,'C01-A:4');
  await expect(page.locator('.node-preview')).toContainText('先取得入口');await expect(page.locator('[data-action="tree-candidate"]')).toBeDisabled();
  await page.getByRole('button',{name:'效果／前置',exact:true}).click();
  await expect(page.locator('dialog.mobile-detail[open]')).toContainText('先取得入口');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'效果／前置',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(before.choicesSpent);
  await page.screenshot({path:`${dir}/screenshots/${info.project.name}-tree-locked.png`});
  await selectTreeNode(page,'C01-A:0');await page.locator('[data-action="tree-candidate"]').click();
  expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(before.choicesSpent);
  expect(await page.evaluate(()=>window.__game.state()!.rng)).toEqual(before.rng);
  await expect(page.locator('[data-action="confirm-card"]')).toBeEnabled();
  await page.locator('[data-action="reroll"]').click();
  const saved=await page.evaluate(async()=>{await window.__game.save();return structuredClone(window.__game.state()!);});
  await page.reload();await page.waitForFunction(()=>!!window.__game);await page.locator('[data-action="continue"]').click();await page.locator('[data-action="resume"]').click();
  expect(await page.evaluate(()=>window.__game.state()!.draft)).toEqual(saved.draft);expect(await page.evaluate(()=>window.__game.state()!.rng)).toEqual(saved.rng);
  await candidate(page,'C01-C:0');await page.locator('[data-action="confirm-card"]').click();
  expect(await page.evaluate(()=>window.__game.state()!.treeNodes)).toEqual(['C01-C:0']);
  await page.evaluate(()=>window.__game.save());await expect(page.locator('.system-notice')).toHaveCount(0);expect(errors).toEqual([]);
});

test('TREE: four picks unlock terminal, other terminal locks, remaining ordinary nodes stay available; 18-pick fixture',async({page},info)=>{
  await boot(page);await draft(page,true);
  for(const id of ['C05-A:0','C05-A:1','C05-A:2','C05-A:4'])await take(page,id);
  await page.locator('[data-action="tree-open"]').click();await page.locator('[data-action="tree-character"][data-id="C05"]').click();
  await page.locator('[data-action="tree-tab"][data-id="C05-A"]').click();await expect(page.locator('[data-id="C05-A:3"][data-action="tree-node"]')).toHaveAttribute('data-state','available');
  await page.locator('[data-action="tree-tab"][data-id="C05-B"]').click();await selectTreeNode(page,'C05-B:4');
  await expect(page.locator('.node-preview')).toContainText('本角色已選擇其他終極');await expect(page.locator('[data-action="tree-candidate"]')).toBeDisabled();
  await page.screenshot({path:`${dir}/screenshots/${info.project.name}-terminal-lock.png`});
  await page.locator('[data-action="tree-close"]').click();await take(page,'C05-B:0');await take(page,'C05-B:1');
  expect(await page.evaluate(()=>window.__game.state()!.treeNodes)).toHaveLength(6);expect(await page.evaluate(()=>window.__game.state()!.evolvedCount)).toBe(1);
  const snap=await page.evaluate(async()=>{await window.__game.save();return {nodes:window.__game.state()!.treeNodes,offer:window.__game.state()!.draft};});
  await page.reload();await page.waitForFunction(()=>!!window.__game);await page.locator('[data-action="continue"]').click();await page.locator('[data-action="resume"]').click();
  expect(await page.evaluate(()=>({nodes:window.__game.state()!.treeNodes,offer:window.__game.state()!.draft}))).toEqual(snap);
});

test('TREE: read-only inspection freezes 3×, restores existing pause, survives reload and is keyboard-contained',async({page})=>{
  await boot(page);await page.locator('#speed-button').click();await page.locator('#speed-button').click();
  await page.getByRole('button',{name:'自動施放隊長技能',exact:true}).click();await page.locator('.range-toolbar [data-action="view-build"]').click();
  await expect(page.locator('.tree-panel')).toBeVisible();const before=await page.evaluate(()=>structuredClone(window.__game.state()!));
  await page.waitForTimeout(250);await page.evaluate(()=>window.__game.ticks(300));expect(await page.evaluate(()=>window.__game.state()!.tick)).toBe(before.tick);
  await page.locator('[data-action="tree-node"]').first().click();await expect(page.locator('[data-action="tree-candidate"]')).toBeDisabled();
  await page.locator('[data-action="tree-close"]').focus();await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('.tree-panel'))).toBe(true);
  await page.keyboard.press('Escape');await expect(page.locator('.tree-panel')).toHaveCount(0);expect(await page.evaluate(()=>window.__game.state()!.phase)).toBe('running');
  await page.locator('[data-action="pause"]').click();await page.locator('[data-action="view-build"]').last().click();await page.keyboard.press('Escape');
  await expect(page.locator('.pause-dialog')).toBeVisible();await page.locator('[data-action="view-build"]').last().click();await page.evaluate(()=>window.__game.save());
  await page.reload();await page.waitForFunction(()=>!!window.__game);await page.locator('[data-action="continue"]').click();await page.locator('[data-action="resume"]').click();
  await expect(page.locator('#speed-button')).toHaveText('3×');await expect(page.locator('#auto-tactical-button')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>window.__game.state()!.pauseReasons)).not.toContain('tree');
});

test('TREE: narrow and wide layouts keep controls inside screen with mobile skill paging',async({page},info)=>{
  await boot(page);await draft(page,true);await page.locator('[data-action="tree-open"]').click();
  for(const [width,height] of [[320,720],[768,1024],[1024,1400],[1440,1600]]) {
    await page.setViewportSize({width,height});await page.locator('[data-action="tree-character"][data-id="C01"]').click();await selectTreeNode(page,'C01-A:0');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const bounds=await page.locator('[data-action="tree-candidate"]').boundingBox();expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(height);
    expect(await page.locator('.tree-scroll').evaluate(e=>e.clientHeight)).toBeGreaterThan(180);
    if(width<=800) {
      expect(await page.locator('.tree-scroll').evaluate(e=>e.scrollHeight-e.clientHeight)).toBeLessThanOrEqual(1);
      await expect(page.locator('.mobile-node-page:not([hidden])')).toHaveCount(1);
    } else await expect(page.getByRole('combobox',{name:'技能階段',exact:true})).toHaveCount(0);
    await page.screenshot({path:`${dir}/screenshots/${info.project.name}-tree-${width}.png`});
  }
});

test('TREE: resumed dev.3 save still renders and accepts A/B upgrades',async({page})=>{
  await boot(page);
  await page.evaluate(async()=>{
    const path='/src/sim/engine.ts';const engine=await import(path);
    const state=engine.createRun({stageId:'S01',squadIds:['C01','C02'],captainId:'C01',seed:101},'0.1.0-dev.3');
    state.choicesEarned=1;state.xp=40;engine.stepRun(state);window.__game.getSave().activeRun=state;await window.__game.save();
  });
  await page.reload();await page.waitForFunction(()=>!!window.__game);await page.locator('[data-action="continue"]').click();await page.locator('[data-action="resume"]').click();
  await expect(page.locator('#focus-character')).toBeVisible();await page.locator('#focus-character').selectOption('C02');await page.locator('#focus-branch').selectOption('B');
  await page.locator('[data-action="select-card"][data-id="C02-B-1"]').click();await page.locator('[data-action="confirm-card"]').click();
  expect(await page.evaluate(()=>window.__game.state()!.contentVersion)).toBe('0.1.0-dev.3');
  expect(await page.evaluate(()=>window.__game.state()!.weapons.find(w=>w.id==='C02')!.branch)).toBe('B');
  await page.evaluate(()=>window.__game.save());await expect(page.locator('.system-notice')).toHaveCount(0);
});
