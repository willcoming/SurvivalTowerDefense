import { expect, test, type Page } from '@playwright/test';
import { finishWave, ready, startBattle } from '../helpers/mobile-ui';

const camera = (page: Page) => page.locator('.network-viewport');
async function snapshot(page: Page) {
  return camera(page).evaluate(el => ({ scale: el.getAttribute('data-scale'), x: el.getAttribute('data-pan-x'), y: el.getAttribute('data-pan-y') }));
}
async function selectNode(page: Page, id: string) {
  const node = page.locator(`.skill-network .deep-node[data-id="${id}"]`);
  await page.keyboard.press('Tab'); await node.focus(); await node.click();
  await expect(node).toHaveAttribute('aria-pressed', 'true');
}
async function selectedIsClear(page: Page, id: string, upperFocus = false) {
  await expect.poll(() => page.locator(`.skill-network .deep-node[data-id="${id}"]`).evaluate((node, upper) => {
    const r = node.getBoundingClientRect(), v = node.closest('.network-viewport')!.getBoundingClientRect();
    const centerY = r.top + r.height / 2;
    const bodyFits = r.left >= v.left - 1 && r.right <= v.right + 1 && r.top >= v.top - 1 && r.bottom <= v.bottom + 1;
    return bodyFits && (!upper || Math.abs((centerY - v.top) / v.height - .35) < .015);
  }, upperFocus)).toBe(true);
}
async function openPreview(page: Page) {
  await ready(page); await page.evaluate(() => window.__game.route('codex'));
  await page.getByRole('button', { name: '技能樹與節點', exact: true }).click();
}

test('reopening the same low node refocuses above the sheet and a purchase retains the camera', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page); await startBattle(page); await finishWave(page);
  await page.evaluate(async () => {
    const path = '/src/data/battle-experience.ts', { battleXpAt } = await import(path), run = window.__game.state()!;
    run.xp = battleXpAt(4); run.choicesEarned = 3; run.draft!.pointTarget = 3; window.__game.ticks(0);
  });
  const id = 'C01-A4/0', node = page.locator(`[data-action="deep-node"][data-id="${id}"]`);
  await selectNode(page, id); await selectedIsClear(page, id, true);
  await page.locator('[data-action="tree-detail-close"]').click();
  await expect(node).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.combat-skill-detail')).toHaveAttribute('data-open', 'false');
  const v = (await camera(page).boundingBox())!, n = (await node.boundingBox())!;
  const delta = v.y + v.height - 34 - (n.y + n.height / 2), x = v.x + v.width - 8, y = v.y + 40;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x, y + delta, { steps: 12 }); await page.mouse.up();
  await expect.poll(async () => {
    const moved = (await node.boundingBox())!;
    return Math.abs(v.y + v.height - (moved.y + moved.height / 2) - 34);
  }).toBeLessThan(2);
  // A real tap near the lower edge must reveal this same ID after the sheet reopens.
  await node.tap(); await selectedIsClear(page, id, true);
  await expect(page.locator('.combat-skill-detail')).toHaveAttribute('data-open', 'true');
  await page.getByRole('button', { name: '放大技能樹', exact: true }).click();
  const before = await snapshot(page), spent = await page.evaluate(() => window.__game.state()!.choicesSpent);
  await page.locator('[data-action="buy-node"]').click();
  await expect(node).toHaveAttribute('data-state', 'owned');
  expect(await page.evaluate(() => window.__game.state()!.choicesSpent)).toBe(spent + 1);
  expect(await snapshot(page)).toEqual(before);
});

test('camera survives preview rerenders, resets on a new opening and keeps selection through breakpoints', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await openPreview(page);
  const initial = await snapshot(page);
  await page.getByRole('button', { name: '放大技能樹', exact: true }).click();
  const zoomed = await snapshot(page);
  await page.getByRole('button', { name: '夏日換裝', exact: true }).click();
  expect(await snapshot(page)).toEqual(zoomed);
  await page.getByRole('button', { name: '關閉技能樹', exact: true }).click();
  await page.getByRole('button', { name: '技能樹與節點', exact: true }).click();
  expect(await snapshot(page)).toEqual(initial);
  const id = 'C01-A4/2'; await selectNode(page, id); await selectedIsClear(page, id, true);
  for (const [width, height, mode] of [[1023, 1400, 'mobile'], [1024, 1400, 'desktop'], [390, 844, 'mobile']] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('.skill-network')).toHaveAttribute('data-map-layout', mode);
    await expect(page.locator(`.deep-node[data-id="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.personnel-skill-detail')).toHaveAttribute('data-open', 'true');
    await selectedIsClear(page, id, width === 390);
    if (mode === 'mobile') await expect(camera(page)).toHaveAttribute('data-scale', '1');
  }
});
