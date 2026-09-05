import { expect, test, type Locator, type Page } from '@playwright/test';

const phoneSizes = [
  // Available page height after Safari's browser controls consume screen space.
  { width: 320, height: 500 },
  { width: 375, height: 548 },
  { width: 320, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

async function ready(page: Page) {
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game);
}

async function noDocumentScroll(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const root = document.documentElement;
    return {
      horizontal: root.scrollWidth > innerWidth + 1,
      vertical: root.scrollHeight > innerHeight + 1,
      x: Math.abs(scrollX) > 1,
      y: Math.abs(scrollY) > 1,
    };
  })).toEqual({ horizontal: false, vertical: false, x: false, y: false });
}

/** A clipped button can satisfy toBeVisible/toBeInViewport; require its whole hit area. */
async function fullyVisible(control: Locator) {
  await expect(control).toBeVisible();
  const geometry = await control.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom,
      width: bounds.width, height: bounds.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.top).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  expect(geometry.width).toBeGreaterThanOrEqual(44);
  expect(geometry.height).toBeGreaterThanOrEqual(44);
  // A bottom game dock must not cover controls that are technically in the viewport.
  const covered = await control.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return [bounds.top + 2, bounds.top + bounds.height / 2, bounds.bottom - 2].flatMap(y => {
      const target = document.elementFromPoint(bounds.left + bounds.width / 2, y);
      return target && element.contains(target) ? [] : [target?.tagName + '.' + target?.className];
    });
  });
  expect(covered).toEqual([]);
}

async function nav(page: Page, action: string) {
  await page.locator(`.main-nav [data-action="${action}"]`).click();
  await expect(page.locator('#app')).toHaveAttribute('data-page', action);
}

for (const size of phoneSizes) {
  test(`MOBILE: ${size.width}×${size.height} menus keep primary actions on one screen`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(size);
    await ready(page);
    await noDocumentScroll(page);
    await fullyVisible(page.locator('[data-action="intel"]'));

    const chapter = page.getByRole('combobox', { name: '選擇章節', exact: true });
    await fullyVisible(chapter);
    await chapter.selectOption({ index: 1 });
    await expect(page.locator('.chapter-group:visible')).toHaveCount(1);
    await expect(page.locator('.chapter-group:visible [data-action="stage"]')).not.toHaveCount(0);
    await chapter.selectOption({ index: 0 });
    await expect(page.locator('[data-action="stage"][data-id="S01"]')).toBeVisible();
    await page.locator('[data-action="intel"]').click();
    await noDocumentScroll(page);
    await fullyVisible(page.locator('.action-bar .primary'));
    await page.locator('.action-bar [data-action="roster"]').click();

    const character = page.getByRole('combobox', { name: '選擇隊員', exact: true });
    await character.selectOption({ index: 1 });
    const selectedValue = await character.inputValue();
    const selectedId = await page.locator('.character-card:visible .add-character').getAttribute('data-id');
    await expect(page.locator('.character-card:visible')).toHaveCount(1);
    await fullyVisible(page.locator('.character-card:visible .add-character'));
    await fullyVisible(page.locator('[data-action="start"]'));
    // Rerendering a squad mutation must not jump the pager back to the first card.
    await page.locator('.character-card:visible .add-character').click();
    await expect(character).toHaveValue(selectedValue);
    await expect(page.locator('.character-card:visible .add-character')).toHaveAttribute('data-id', selectedId!);
    await page.locator('.character-card:visible .add-character').click();
    await expect(character).toHaveValue(selectedValue);
    await page.locator('.character-card:visible .captain-button').click();
    await expect(character).toHaveValue(selectedValue);
    await expect(page.locator('.character-card:visible .captain-button')).toHaveClass(/selected/);
    await noDocumentScroll(page);

    await nav(page, 'recruitment');
    await noDocumentScroll(page);
    await fullyVisible(page.locator('[data-action="draw"]'));
    await nav(page, 'codex');
    await page.locator('.character-tabs [data-id="C06"]').click();
    await expect(page.locator('.character-tabs [data-id="C06"]')).toHaveClass(/selected/);
    await fullyVisible(page.getByRole('button', { name: '角色與武器詳情', exact: true }));
    await fullyVisible(page.getByRole('button', { name: '技能樹與節點', exact: true }));
    await noDocumentScroll(page);
    await nav(page, 'stories');
    await noDocumentScroll(page);
    await fullyVisible(page.locator('.mobile-pager select').first());
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await noDocumentScroll(page);
    await page.getByRole('button', { name: '存檔管理', exact: true }).click();
    await fullyVisible(page.locator('[data-action="save-retry"]'));
    await fullyVisible(page.locator('.settings-screen [data-action="home"]'));
    expect(errors).toEqual([]);
  });
}

test('MOBILE: detail panels contain keyboard focus and restore the trigger on Escape', async ({ page }) => {
  await ready(page);
  await nav(page, 'codex');
  const trigger = page.getByRole('button', { name: '技能樹與節點', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.locator('dialog.mobile-detail[open]');
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: '關閉詳細資訊', exact: true });
  await fullyVisible(close);
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog.mobile-detail[open]'))).toBe(true);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog.mobile-detail[open]'))).toBe(true);
  await noDocumentScroll(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await noDocumentScroll(page);
});

test('MOBILE: reset confirmation traps focus despite closed detail panels and Escape preserves progress', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 500 });
  await ready(page);
  const before = await page.evaluate(async () => {
    const save = window.__game.getSave();
    save.preferences.sfxVolume = 0.35;
    await window.__game.save();
    return structuredClone({ preferences: save.preferences, collection: save.collection, profile: save.profile });
  });
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('button', { name: '存檔管理', exact: true }).click();
  expect(await page.locator('dialog.mobile-detail:not([open])').count()).toBeGreaterThan(0);
  const trigger = page.locator('[data-action="reset-confirm"]');
  await trigger.click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  const cancel = dialog.locator('[data-action="cancel-confirm"]');
  const reset = dialog.locator('[data-action="reset"]');
  await fullyVisible(cancel);
  await fullyVisible(reset);
  await cancel.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(reset).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => {
    const save = window.__game.getSave();
    return { preferences: save.preferences, collection: save.collection, profile: save.profile };
  })).toEqual(before);
  await noDocumentScroll(page);
});

test('MOBILE: a storage error keeps the primary action visible at Safari toolbar height', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 500 });
  await ready(page);
  await page.evaluate(async () => {
    const transaction = IDBDatabase.prototype.transaction;
    try {
      IDBDatabase.prototype.transaction = () => { throw new DOMException('mobile layout storage fixture', 'QuotaExceededError'); };
      await window.__game.save();
    } finally {
      IDBDatabase.prototype.transaction = transaction;
    }
  });
  await expect(page.locator('.local-status')).toContainText('尚未儲存');
  await expect(page.locator('.system-notice')).toContainText('儲存未完成');
  await fullyVisible(page.locator('[data-action="intel"]'));
  await noDocumentScroll(page);
  await page.getByRole('button', { name: '存檔需要處理', exact: true }).click();
  const retry = page.locator('.system-notice dialog[open] [data-action="save-retry"]');
  await fullyVisible(retry);
  await retry.click();
  await expect(page.locator('.local-status')).toContainText('已儲存在本機');
  await expect(page.locator('.system-notice')).toHaveCount(0);
  await fullyVisible(page.locator('[data-action="intel"]'));
  await noDocumentScroll(page);
});

test('MOBILE: recruitment result keeps the next draw accessible without scrolling', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    window.__game.getSave().profile.cleared = ['S01', 'S02', 'S03'];
    await window.__game.save();
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  await nav(page, 'recruitment');
  await page.locator('[data-action="draw"]').click();
  await expect(page.locator('.recruitment-receipt')).toBeVisible();
  expect(await page.evaluate(() => window.__game.getSave().collection.sequence)).toBe(1);
  for (const size of phoneSizes) {
    await page.setViewportSize(size);
    await fullyVisible(page.locator('[data-action="draw"]'));
    await noDocumentScroll(page);
  }
});

test('MOBILE: tutorial, skill allocation, pause and result controls fit every phone size', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await page.locator('[data-action="intel"]').click();
  await page.locator('.action-bar [data-action="roster"]').click();
  await page.locator('[data-action="start"]').click();
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  for (const size of phoneSizes) {
    await page.setViewportSize(size);
    await fullyVisible(page.locator('.tutorial-dialog .primary'));
    await noDocumentScroll(page);
  }
  await page.locator('.tutorial-dialog .primary').click();
  await page.locator('[data-action="pause"]').click();
  for (const size of phoneSizes) {
    await page.setViewportSize(size);
    for (const action of ['resume', 'save-home', 'abandon-confirm']) {
      await fullyVisible(page.locator(`.pause-dialog [data-action="${action}"]`));
    }
    await noDocumentScroll(page);
  }
  await page.locator('[data-action="resume"]').click();
  // A deterministic two-point fixture isolates layout from battle duration/balance.
  await page.evaluate(() => {
    const state = window.__game.state()!;
    state.xp = 60;
    state.choicesEarned = 2;
    window.__game.ticks(1);
  });
  await expect(page.locator('.deep-panel')).toBeVisible();
  await page.locator('[data-action="deep-owner"][data-id="common"]').click();
  await page.locator('[data-action="deep-node"][data-id="TEAM/0"]').click();
  for (const size of phoneSizes) {
    await page.setViewportSize(size);
    await fullyVisible(page.locator('[data-action="buy-node"]'));
    await fullyVisible(page.locator('[data-action="tree-save-home"]'));
    await noDocumentScroll(page);
  }
  await page.locator('[data-action="buy-node"]').click();
  await page.locator('[data-action="deep-node"][data-id="TEAM/4"]').click();
  await page.locator('[data-action="buy-node"]').click();
  await expect(page.locator('.deep-panel')).toHaveCount(0);
  for (const size of phoneSizes) {
    await page.setViewportSize(size);
    await fullyVisible(page.locator('#tactical-button'));
    await fullyVisible(page.locator('#speed-button'));
    await fullyVisible(page.locator('[data-action="pause"]'));
    await noDocumentScroll(page);
  }
  await page.locator('[data-action="pause"]').click();
  await page.locator('[data-action="abandon-confirm"]').click();
  await page.locator('[data-action="abandon"]').click();
  await expect(page.locator('.result-screen')).toBeVisible();
  for (const size of phoneSizes) {
    await page.setViewportSize(size);
    await fullyVisible(page.locator('.result-actions [data-action="retry"]'));
    await fullyVisible(page.locator('.result-actions [data-action="adjust"]'));
    await fullyVisible(page.locator('.result-actions [data-action="home"]'));
    await noDocumentScroll(page);
  }
  expect(errors).toEqual([]);
});

test('MOBILE: crossing the desktop breakpoint restores all content and preserves selection', async ({ page }) => {
  await ready(page);
  await nav(page, 'roster');
  const picker = page.getByRole('combobox', { name: '選擇隊員', exact: true });
  await picker.selectOption({ index: 4 });
  const selectedValue = await picker.inputValue();
  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1024 });
    await expect(page.locator('.character-card:visible')).toHaveCount(width <= 800 ? 1 : 8);
    await expect(page.locator('dialog.mobile-detail[open]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator('[data-action="start"]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-action="start"]')).toBeEnabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(picker).toHaveValue(selectedValue);
    await expect(page.locator('.character-card:visible')).toHaveCount(1);
    await fullyVisible(page.locator('[data-action="start"]'));
    await noDocumentScroll(page);
  }
});
