import { expect, test } from '@playwright/test';
import { ready, reachable, startBattle, finishWave } from '../helpers/mobile-ui';

for(const viewport of [{width:390,height:844},{width:320,height:500},{width:1440,height:900}])test.describe(`viewport ${viewport.width}`,()=>{
 test.use({isMobile:viewport.width<=800,hasTouch:viewport.width<=800});
 test('current skill map keeps controls reachable and details return focus',async({page},info)=>{
  await page.setViewportSize(viewport);await ready(page);await startBattle(page);
  await page.locator('.range-toolbar [data-action=view-build]').click();await page.locator('[data-action=deep-owner][data-id=C06]').click();
  const current=await page.evaluate(async()=>{const path='/src/data/deep-trees.ts';const {deepTreesFor}=await import(path);return deepTreesFor('C06',window.__game.state());});
  await expect(page.locator('[data-action=deep-tab]')).toHaveCount(0);
  await expect(page.locator('.skill-map-viewport .deep-node')).toHaveCount(current.reduce((n:number,t:{nodes:unknown[]})=>n+t.nodes.length,0));
  const map=page.locator('.skill-map-viewport');expect(await map.evaluate(e=>e.clientHeight)).toBeGreaterThan(40);await expect(map).toHaveCSS('touch-action','none');
  const node=page.locator(`[data-action=deep-node][data-id="${current[0].nodes.at(-1).id}"]`);await node.focus();await node.press('Enter');
  await expect(page.locator('.skill-description-dialog[open] .node-prerequisites')).toBeVisible();await expect(page.locator('.skill-description-dialog button')).toHaveText(['確認配置','關閉']);await expect(page.locator('[data-action=buy-node]')).toBeDisabled();await page.keyboard.press('Escape');await expect(node).toBeFocused();
  for(const control of await page.locator('.network-controls button').all())await reachable(control);
  await reachable(page.locator('[data-action=tree-close]'));await reachable(page.locator('[data-action=tree-save-home]'));

  await page.screenshot({path:info.outputPath('skill-map.png')});await page.keyboard.press('Escape');await expect(page.locator('.tactical-tree')).toHaveCount(0);
 });
});

test('confirming a skill only acquires the current character selection',async({page})=>{
 await ready(page);await startBattle(page);await finishWave(page);const chosen:string[]=[];
 await page.evaluate(async()=>{const path='/src/data/battle-experience.ts';const {battleXpAt}=await import(path);const s=window.__game.state()!;s.xp=battleXpAt(5);s.choicesEarned=4;s.draft!.pointTarget=4;window.__game.ticks(0);});
 for(const owner of ['C01','C02']){
  await page.locator(`[data-action=deep-owner][data-id=${owner}]`).click();const node=page.locator('.deep-node.available').first();chosen.push((await node.getAttribute('data-id'))!);await node.focus();await node.press('Enter');if(owner==='C01')await page.getByRole('button',{name:'關閉',exact:true}).click();
 }
 const before=await page.evaluate(()=>({tick:window.__game.state()!.tick,spent:window.__game.state()!.choicesSpent}));
 await expect(page.locator('.wave-allocation')).toBeVisible();expect(await page.evaluate(()=>window.__game.state()!.tick)).toBe(before.tick);
 expect(await page.evaluate(()=>window.__game.state()!.draft!.pendingNodeIds)).toEqual([chosen[1]]);
 await page.locator('[data-action=buy-node]').click();await expect(page.locator('.wave-allocation')).toBeVisible();await expect(page.locator('.skill-description-dialog[open]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__game.state()!.treeNodes)).toEqual([chosen[1]]);expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(before.spent+1);
});
