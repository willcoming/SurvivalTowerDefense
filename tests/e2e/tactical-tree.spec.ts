import { expect, test } from '@playwright/test';

for (const viewport of [{ width:390, height:844 }, { width:320, height:500 }, { width:1440, height:900 }]) {
  test.describe(`viewport ${viewport.width}`, () => {
  test.use({isMobile:viewport.width <= 800, hasTouch:viewport.width <= 800});
  test(`SKILL MAP: ${viewport.width}×${viewport.height} shows connected routes and keeps actions accessible`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.routeWebSocket('**/*', socket => socket.close());
    await page.goto('/'); await page.waitForFunction(() => !!window.__game);
    await page.locator('[data-action="start"]').click();
    await page.locator('#battle-loading').waitFor({state:'detached'});
    await page.locator('[data-action="tutorial-done"]').first().click();
    await page.locator('.range-toolbar [data-action="view-build"]').click();
    await expect(page.getByRole('combobox', {name:'技能階段', exact:true})).toHaveCount(0);
    await page.locator('[data-action="deep-owner"][data-id="C06"]').click();
    await page.locator('[data-action="deep-tab"][data-id="C06-A"]').click();
    const map = page.locator('.skill-map-viewport');
    await expect(map.locator('.deep-node')).toHaveCount(12);
    await expect(map.locator('.deep-connections')).toBeVisible();
    const mapGeometry = await map.evaluate(element => ({height:element.clientHeight,content:element.scrollHeight}));
    expect(mapGeometry.height).toBeGreaterThan(60);
    const modal = await page.locator('.tactical-tree').boundingBox();
    expect(modal!.x).toBe(0);
    expect(modal!.y).toBe(0);
    expect(Math.abs(modal!.width-viewport.width)).toBeLessThan(1);
    expect(Math.abs(modal!.height-viewport.height)).toBeLessThan(1);
    await expect(page.locator('.tactical-tree .deep-node strong').first()).toHaveCSS('font-size','16px');
    await expect(page.locator('.tactical-tree .skill-selection-copy p')).toHaveCSS('font-size','16px');
    if (viewport.height < 600) expect(mapGeometry.content).toBeGreaterThan(mapGeometry.height);
    await page.locator('[data-action="deep-node"][data-id="C06-A/11"]').click();
    await expect(page.locator('.deep-node.inspecting')).toBeInViewport();
    await expect(page.locator('[data-action="buy-node"]')).toBeDisabled();
    const scroll = await map.evaluate(element => element.scrollTop);
    await page.getByRole('button', {name:'效果／前置', exact:true}).click();
    await expect(page.locator('dialog[open] .node-prerequisites')).toBeVisible();
    await page.getByRole('button', {name:'關閉詳細資訊', exact:true}).click();
    expect(await map.evaluate(element => element.scrollTop)).toBe(scroll);
    for (const selector of ['[data-action="buy-node"]','[data-action="tree-close"]','[data-action="tree-save-home"]']) {
      const rect = await page.locator(selector).boundingBox();
      expect(rect!.height).toBeGreaterThanOrEqual(44);
      expect(rect!.y+rect!.height).toBeLessThanOrEqual(viewport.height+1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height+1);
    await page.screenshot({path:testInfo.outputPath(`skill-modal-${viewport.width}.png`)});
    await page.keyboard.press('Escape');
    await expect(page.locator('.tactical-tree')).toHaveCount(0);
    expect(await page.evaluate(() => window.__game.state()!.phase)).toBe('running');
    expect(errors).toEqual([]);
  });
  });
}


test('skill selection stays over the paused battle and confirms across characters', async ({page}, testInfo) => {
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game);
  await page.locator('[data-action="start"]').click();
  await page.locator('#battle-loading').waitFor({state:'detached'});
  await page.locator('[data-action="tutorial-done"]').first().click();
  await page.evaluate(() => { const s=window.__game.state()!; s.xp=60; s.choicesEarned=2; window.__game.ticks(1); });
  await expect(page.locator('.tactical-tree')).toBeVisible();
  await expect(page.locator('#battle-canvas canvas')).toBeVisible();
  const tick = await page.evaluate(() => window.__game.state()!.tick);
  await page.locator('[data-action="deep-owner"][data-id="C06"]').click();
  await page.locator('[data-action="deep-node"][data-id="C06-A/0"]').click();
  await expect(page.locator('[data-action="buy-node"]')).toBeDisabled();
  await expect(page.locator('.points-left')).toContainText('1 / 2');
  await page.locator('[data-action="deep-owner"][data-id="C02"]').click();
  await page.locator('[data-action="deep-node"][data-id="C02-A/0"]').click();
  await expect(page.locator('[data-action="buy-node"]')).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('.tactical-tree')).toBeVisible();
  expect(await page.evaluate(() => window.__game.state()!.tick)).toBe(tick);
  await page.screenshot({path:testInfo.outputPath('skill-modal-selection.png')});
  await page.locator('[data-action="buy-node"]').click();
  await expect(page.locator('.tactical-tree')).toHaveCount(0);
  const state = await page.evaluate(() => window.__game.state()!);
  expect(state.treeNodes).toEqual(expect.arrayContaining(['C06-A/0','C02-A/0']));
  expect(state.choicesSpent).toBe(2);
  expect(state.phase).toBe('running');
});

test('an ultimate uses both milestone points, blocks overspending and confirms alone',async({page})=>{
  await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  await page.locator('[data-action="start"]').click();await page.locator('#battle-loading').waitFor({state:'detached'});await page.locator('[data-action="tutorial-done"]').first().click();
  await page.evaluate(async()=>{
    const path='/tests/helpers/deep-build.ts';const {pathTo}=await import(path);const s=window.__game.state()!;s.xp=180;s.choicesEarned=6;window.__game.ticks(1);
    for(const nodeId of pathTo('C01-A/9').slice(0,4))window.__game.command({type:'buy-node',offerId:s.draft!.id,nodeId});
  });
  await page.locator('[data-action="deep-owner"][data-id="C01"]').click();
  const ult=page.locator('[data-action="deep-node"][data-id="C01-A/9"]');await expect(ult).toContainText('2 點');
  await page.locator('[data-action="deep-owner"][data-id="C02"]').click();await page.locator('[data-action="deep-node"][data-id="C02-A/0"]').click();
  await page.locator('[data-action="deep-owner"][data-id="C01"]').click();await expect(ult).toBeDisabled();await expect(ult).toHaveAttribute('aria-label',/剩餘點數不足/);
  await page.locator('[data-action="deep-owner"][data-id="C02"]').click();await page.locator('[data-action="deep-node"][data-id="C02-A/0"]').click();
  await page.locator('[data-action="deep-owner"][data-id="C01"]').click();await ult.click();
  await expect(page.locator('.points-left')).toContainText('2 / 2');await expect(page.locator('[data-action="buy-node"]')).toBeEnabled();
  await page.locator('[data-action="buy-node"]').click();await expect(page.locator('.tactical-tree')).toHaveCount(0);
  const result=await page.evaluate(()=>({spent:window.__game.state()!.choicesSpent,nodes:window.__game.state()!.treeNodes,phase:window.__game.state()!.phase}));
  expect(result.spent).toBe(6);expect(result.nodes).toHaveLength(5);expect(result.nodes).toContain('C01-A/9');expect(result.nodes).not.toContain('C02-A/0');expect(result.phase).toBe('running');
});
