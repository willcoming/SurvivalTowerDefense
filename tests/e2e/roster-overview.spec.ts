import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game);
}

async function seedOutfits(page: Page) {
  await page.evaluate(async () => {
    window.__game.getSave().collection.owned.push('C01-summer', 'C07-summer');
    await window.__game.save();
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
}

async function openRoster(page: Page) {
  await page.locator('.main-nav [data-action="roster"]').click();
  await expect(page.locator('.roster-tile')).toHaveCount(8);
}

async function openWardrobe(page: Page, id = 'C01') {
  await page.locator(`.roster-tile[data-id="${id}"]`).click();
  await page.locator('[data-action="roster-wardrobe"]').click();
  await expect(page.locator('[data-roster-view="wardrobe"]')).toBeVisible();
}

async function collectionSnapshot(page: Page) {
  return page.evaluate(() => {
    const { collection, revision } = window.__game.getSave();
    return structuredClone({ collection, revision });
  });
}

test('ROSTER: all eight members distinguish squad, standby, unrecruited and available outfits', async ({ page }) => {
  await ready(page);
  await openRoster(page);
  await expect(page.locator('.roster-summary')).toContainText('已招募 6 / 8');
  await expect(page.locator('.roster-summary')).toContainText('出戰 5 / 5');
  await expect(page.locator('.roster-tile[data-id="C01"]')).toHaveAccessibleName(/已出戰.*已擁有 1 套造型/);
  await expect(page.locator('.roster-tile[data-id="C03"]')).toHaveAccessibleName(/待命.*已擁有 1 套造型/);
  await expect(page.locator('.roster-tile[data-id="C07"]')).toHaveAccessibleName(/未招募.*已擁有 0 套造型/);
  await expect(page.locator('.roster-tile[data-id="C08"]')).toHaveAccessibleName(/未招募.*已擁有 0 套造型/);
  await seedOutfits(page);
  await openRoster(page);
  await expect(page.locator('.roster-summary')).toContainText('已招募 7 / 8');
  await expect(page.locator('.roster-tile[data-id="C01"]')).toHaveAccessibleName(/已擁有 2 套造型.*可換裝/);
  // Acquiring the summer outfit recruits its owner without granting the original.
  await expect(page.locator('.roster-tile[data-id="C07"]')).toHaveAccessibleName(/待命.*已擁有 1 套造型/);
  await expect(page.locator('.roster-tile[data-id="C07"]')).not.toHaveAccessibleName(/可換裝/);
  expect(await page.evaluate(() => window.__game.getSave().collection.owned.includes('C07-original'))).toBe(false);
});

test('ROSTER: locked members and outfits remain previewable with acquisition details', async ({ page }) => {
  await ready(page);
  await openRoster(page);
  await page.locator('.roster-tile[data-id="C07"]').click();
  await expect(page.locator('[data-action="toggle-character"][data-id="C07"]')).toBeDisabled();
  await page.locator('[data-action="roster-wardrobe"]').click();
  await expect(page.locator('[data-action="roster-preview"]')).toHaveCount(2);
  const before = await collectionSnapshot(page);
  for (const form of ['C07-original', 'C07-summer']) {
    await page.locator(`[data-action="roster-preview"][data-id="${form}"]`).click();
    await expect(page.locator(`[data-action="roster-preview"][data-id="${form}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-action="roster-equip"]')).toBeDisabled();
    await expect(page.locator('[data-roster-view="wardrobe"]')).toContainText('招募');
    await expect(page.locator('[data-roster-view="wardrobe"]')).toContainText('100');
    await expect.poll(() => page.locator('.wardrobe-preview img').evaluate((image: HTMLImageElement) => image.naturalWidth > 0)).toBe(true);
    expect(await collectionSnapshot(page)).toEqual(before);
  }
});

test('ROSTER: preview changes artwork and abilities without saving; explicit equip persists exactly once', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await seedOutfits(page);
  await openRoster(page);
  await openWardrobe(page);
  const before = await collectionSnapshot(page);
  const originalAlt = await page.locator('.wardrobe-preview img').getAttribute('alt');
  await expect(page.locator('[data-action="roster-equip"]')).toBeDisabled();
  await page.locator('[data-action="roster-preview"][data-id="C01-summer"]').click();
  await expect(page.locator('.wardrobe-preview img')).not.toHaveAttribute('alt', originalAlt!);
  await expect(page.locator('.wardrobe-preview img')).toHaveAttribute('alt', /浪潮救援/);
  await expect(page.locator('.wardrobe-preview')).toContainText('熱能');
  await expect(page.locator('.wardrobe-effect.preview-effect')).toContainText('8 DPS');
  await expect(page.locator('[data-action="roster-equip"]')).toBeEnabled();
  expect(await collectionSnapshot(page)).toEqual(before);
  // Closing and reopening discards the pending preview and restores equipped art.
  await page.locator('[data-action="roster-close"]').click();
  await openWardrobe(page);
  await expect(page.locator('[data-action="roster-preview"][data-id="C01-original"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action="roster-preview"][data-id="C01-summer"]').click();
  await page.locator('[data-action="roster-equip"]').evaluate(button => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect.poll(() => page.evaluate(() => window.__game.getSave().collection.equipped.C01)).toBe('C01-summer');
  await expect(page.locator('[data-action="roster-equip"]')).toBeDisabled();
  await expect(page.locator('[data-action="roster-equip"]')).toHaveText('已裝備');
  const after = await collectionSnapshot(page);
  expect(after.collection.sequence).toBe(before.collection.sequence + 1);
  expect(after.collection.owned).toEqual(before.collection.owned);
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  const reloaded = await collectionSnapshot(page);
  expect(reloaded.collection).toEqual(after.collection);
  expect(reloaded.revision).toBeGreaterThanOrEqual(after.revision);
  await openRoster(page);
  await openWardrobe(page);
  await expect(page.locator('[data-action="roster-preview"][data-id="C01-summer"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.wardrobe-preview img')).toHaveAttribute('alt', /浪潮救援/);
  expect(errors).toEqual([]);
});

test('ROSTER: keyboard navigation traps focus, backs out of preview and returns to the same member', async ({ page }) => {
  await ready(page);
  await seedOutfits(page);
  await openRoster(page);
  const trigger = page.locator('.roster-tile[data-id="C01"]');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-action="roster-wardrobe"]').click();
  await page.locator('[data-action="roster-preview"][data-id="C01-summer"]').click();
  const before = await collectionSnapshot(page);
  const panel = page.locator('[data-roster-view="wardrobe"]');
  const first = panel.locator('button:not(:disabled)').first();
  await first.focus();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-roster-view="wardrobe"]'))).toBe(true);
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-roster-view="wardrobe"]')).toHaveCount(0);
  await expect(page.locator('[data-roster-view="character"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.roster-dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await collectionSnapshot(page)).toEqual(before);
  await openWardrobe(page);
  await expect(page.locator('[data-action="roster-preview"][data-id="C01-original"]')).toHaveAttribute('aria-pressed', 'true');
});

test('ROSTER: an unfinished battle permits previews but prevents equipment changes', async ({ page }) => {
  await ready(page);
  await seedOutfits(page);
  await page.evaluate(async () => {
    const path = '/src/sim/engine.ts';
    const { createRun } = await import(path);
    const save = window.__game.getSave();
    save.activeRun = createRun({ stageId: 'S01', squadIds: ['C01'], captainId: 'C01', seed: 707 });
    await window.__game.save();
  });
  await openRoster(page);
  await openWardrobe(page);
  const before = await collectionSnapshot(page);
  await page.locator('[data-action="roster-preview"][data-id="C01-summer"]').click();
  await expect(page.locator('.wardrobe-preview img')).toHaveAttribute('alt', /浪潮救援/);
  await expect(page.locator('[data-action="roster-equip"]')).toBeDisabled();
  await expect(page.locator('[data-roster-view="wardrobe"]')).toContainText(/完成或放棄/);
  expect(await collectionSnapshot(page)).toEqual(before);
});

test('ROSTER: temporary play explains why equipping is unavailable', async ({ page }) => {
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => { throw new Error('roster temporary-play fixture'); };
  });
  await page.goto('/');
  await page.locator('[data-action="temporary-play"]').click();
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate(() => window.__game.getSave().collection.owned.push('C01-summer'));
  await openRoster(page);
  await openWardrobe(page);
  const before = await collectionSnapshot(page);
  await page.locator('[data-action="roster-preview"][data-id="C01-summer"]').click();
  await expect(page.locator('[data-action="roster-equip"]')).toBeDisabled();
  await expect(page.locator('[data-roster-view="wardrobe"]')).toContainText(/暫時.*無法儲存/);
  expect(await collectionSnapshot(page)).toEqual(before);
});

test('ROSTER: a failed equipment save stays visible in the wardrobe and can be retried', async ({ page }) => {
  await ready(page);
  await seedOutfits(page);
  await openRoster(page);
  await openWardrobe(page);
  await page.locator('[data-action="roster-preview"][data-id="C01-summer"]').click();
  const before = await collectionSnapshot(page);
  await page.evaluate(() => {
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function () {
      IDBDatabase.prototype.transaction = transaction;
      throw new DOMException('roster equipment save fixture', 'QuotaExceededError');
    };
  });
  await page.locator('[data-action="roster-equip"]').click();
  const panel = page.locator('[data-roster-view="wardrobe"]');
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(panel.getByRole('alert')).toContainText(/存檔|儲存/);
  await expect(page.locator('[data-action="roster-equip"]')).toBeEnabled();
  expect(await collectionSnapshot(page)).toEqual(before);
  await page.locator('[data-action="roster-equip"]').click();
  await expect.poll(() => page.evaluate(() => window.__game.getSave().collection.equipped.C01)).toBe('C01-summer');
  await expect(panel.getByRole('alert')).toHaveCount(0);
  expect((await collectionSnapshot(page)).collection.sequence).toBe(before.collection.sequence + 1);
});

test('ROSTER: the four-member challenge shows its actual capacity and blocks a fifth member', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    window.__game.getSave().profile.cleared = ['S01'];
    await window.__game.save();
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  await page.locator('[data-action="stage"][data-id="S01"]').click();
  await page.locator('[data-action="intel"]').click();
  await page.locator('[data-action="challenge"][data-id="four"]').click();
  await page.locator('.action-bar [data-action="roster"]').click();
  await expect(page.locator('.roster-summary')).toContainText('出戰 5 / 4');
  await expect(page.locator('[data-action="start"]')).toBeDisabled();
  await page.locator('.roster-tile[data-id="C01"]').click();
  await page.locator('[data-action="toggle-character"][data-id="C01"]').click();
  await page.locator('[data-action="roster-close"]').click();
  await expect(page.locator('.roster-summary')).toContainText('出戰 4 / 4');
  await expect(page.locator('[data-action="start"]')).toBeEnabled();
  await page.locator('.roster-tile[data-id="C03"]').click();
  await expect(page.locator('[data-action="toggle-character"][data-id="C03"]')).toBeDisabled();
  await page.locator('[data-action="roster-close"]').click();
  expect(await page.evaluate(() => window.__game.getSave().preferences.squadIds)).toHaveLength(4);
});
