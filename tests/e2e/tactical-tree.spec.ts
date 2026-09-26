import { expect, test } from '@playwright/test';
import { ready, reachable, startBattle, finishWave } from '../helpers/mobile-ui';

for(const viewport of [{width:390,height:844},{width:320,height:500},{width:1440,height:900}])test.describe(`viewport ${viewport.width}`,()=>{
 test.use({isMobile:viewport.width<=800,hasTouch:viewport.width<=800});
 test('current skill map keeps controls reachable and details return focus',async({page},info)=>{
  await page.setViewportSize(viewport);await ready(page);await startBattle(page);
  await page.locator('.range-toolbar [data-action=view-build]').click();await page.locator('[data-action=deep-owner][data-id=C06]').click();
  const current=await page.evaluate(async()=>{const path='/src/data/deep-trees.ts';const {deepTreesFor}=await import(path);return deepTreesFor('C06',window.__game.state());});
  await page.locator(`[data-action=deep-tab][data-id="${current[0].id}"]`).click();
  await expect(page.locator('.skill-map-viewport .deep-node')).toHaveCount(current.reduce((n:number,t:{nodes:unknown[]})=>n+t.nodes.length,0));
  const map=page.locator('.skill-map-viewport');expect(await map.evaluate(e=>e.clientHeight)).toBeGreaterThan(40);await expect(map).toHaveCSS('touch-action','none');
  const node=page.locator(`[data-action=deep-node][data-id="${current[0].nodes.at(-1).id}"]`);await node.focus();await node.press('Enter');
  for(const control of await page.locator('.network-controls button').all())await reachable(control);
  await reachable(page.locator('[data-action=tree-close]'));await reachable(page.locator('[data-action=tree-save-home]'));
  const detail=page.getByRole('button',{name:'效果／前置',exact:true});await detail.click();await expect(page.locator('dialog[open] .node-prerequisites')).toBeVisible();await page.keyboard.press('Escape');await expect(detail).toBeFocused();
  await page.screenshot({path:info.outputPath('skill-map.png')});await page.keyboard.press('Escape');await expect(page.locator('.tactical-tree')).toHaveCount(0);
 });
});

test('wave allocation accumulates choices across characters and confirms once',async({page})=>{
 await ready(page);await startBattle(page);await finishWave(page);const chosen:string[]=[];
 for(const owner of ['C01','C02']){
  await page.locator(`[data-action=deep-owner][data-id=${owner}]`).click();const node=page.locator('.deep-node.available').first();chosen.push((await node.getAttribute('data-id'))!);await node.focus();await node.press('Enter');
 }
 const before=await page.evaluate(()=>({tick:window.__game.state()!.tick,spent:window.__game.state()!.choicesSpent}));
 await page.keyboard.press('Escape');await expect(page.locator('.wave-allocation')).toBeVisible();expect(await page.evaluate(()=>window.__game.state()!.tick)).toBe(before.tick);
 await page.locator('[data-action=buy-node]').click();await expect(page.locator('.wave-allocation')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__game.state()!.treeNodes)).toEqual(expect.arrayContaining(chosen));expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(before.spent+2);
});
