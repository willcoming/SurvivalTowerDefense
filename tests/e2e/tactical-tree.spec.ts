import { expect, test } from '@playwright/test';

for (const viewport of [{ width:390, height:844 }, { width:320, height:500 }, { width:1440, height:900 }]) {
  test.describe(`viewport ${viewport.width}`, () => {
  test.use({isMobile:viewport.width <= 800, hasTouch:viewport.width <= 800});
  test(`SKILL MAP: ${viewport.width}×${viewport.height} shows connected routes and keeps actions accessible`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.routeWebSocket('**/*', socket => socket.close());
    await page.goto('/'); await page.waitForFunction(() => !!window.__game);
    await page.locator('[data-action="intel"]').click();
    await page.locator('.action-bar [data-action="roster"]').click();
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
    if (viewport.height >= 844) expect(mapGeometry.content).toBeLessThanOrEqual(mapGeometry.height + 1);
    else expect(mapGeometry.content).toBeGreaterThan(mapGeometry.height);
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
    expect(errors).toEqual([]);
  });
  });
}
