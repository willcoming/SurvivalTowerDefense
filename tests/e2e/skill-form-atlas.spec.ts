import { expect, test } from '@playwright/test';
import { CHARACTER_IDS } from '../../src/data/content';
import { ULTIMATES } from '../../src/data/reworked-skills';
import type { FormId } from '../../src/sim/types';

test.use({isMobile:false,hasTouch:false});

const colors: Record<FormId, string> = {
  'C01-original': '#ff806b', 'C01-summer': '#ffb45c',
  'C02-original': '#81d6ff', 'C02-summer': '#ff806b',
  'C03-original': '#b7d5f0', 'C03-summer': '#b68aff',
  'C04-original': '#b68aff', 'C04-summer': '#81d6ff',
  'C05-original': '#ffb45c', 'C05-summer': '#ff806b',
  'C06-original': '#ff806b', 'C06-summer': '#b7d5f0',
  'C07-original': '#b7d5f0', 'C07-summer': '#ff806b',
  'C08-original': '#ffb45c', 'C08-summer': '#81d6ff',
};

test('all eight characters keep their selected ultimate and collection while previewing both form atlases', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await page.waitForFunction(() => !!window.__game);
  await page.evaluate(() => window.__game.route('codex'));
  const collection = await page.evaluate(() => structuredClone(window.__game.getSave().collection));
  const crests = new Map<FormId, string>();

  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    for (const owner of CHARACTER_IDS) {
      const picker = page.getByRole('combobox', { name: '圖鑑角色', exact: true });
      if (await picker.count()) await picker.selectOption(owner);
      else await page.locator(`.character-tabs [data-id="${owner}"]`).click();
      await page.getByRole('button', { name: '技能樹與節點', exact: true }).click();
      const panel = page.locator('.personnel-skills-dialog');
      const map = panel.locator('.skill-network');
      const ultimate = map.locator('[data-action="personnel-skill-node"].ultimate');
      await expect(map.locator('.deep-node')).toHaveCount(24);
      await expect(ultimate).toHaveCount(1);
      const selectedId = (await ultimate.getAttribute('data-id'))!;
      await ultimate.focus(); await ultimate.press('Enter');

      for (const theme of ['original', 'summer'] as const) {
        const form = `${owner}-${theme}` as FormId;
        await panel.locator(`[data-action="personnel-skill-form"][data-id="${form}"]`).click();
        await expect(map.locator('.deep-node')).toHaveCount(24);
        await expect(map.locator('.ultimate')).toHaveCount(1);
        await expect(map).toHaveAttribute('data-form', form);
        await expect(map).toHaveAttribute('data-selected', selectedId);
        await expect(map.locator(`.deep-node[data-id="${selectedId}"]`)).toHaveAttribute('aria-pressed', 'true');
        await expect(ultimate.locator('svg')).toHaveAttribute('data-emblem', 'ultimate');
        await expect(ultimate.locator('svg')).toHaveAttribute('data-emblem-variant', form);
        const detail = panel.locator('.skill-bottom-sheet');
        await expect(detail).toHaveAttribute('data-open', 'true');
        await expect(detail.locator('.node-title-row h3')).toHaveText(ULTIMATES[form].name);
        await expect(detail.locator('.node-detail-icon svg')).toHaveAttribute('data-emblem-variant', form);
        expect(await map.evaluate(element => getComputedStyle(element).getPropertyValue('--atlas-accent').trim())).toBe(colors[form]);
        expect(await panel.evaluate(element => getComputedStyle(element).getPropertyValue('--skill-accent').trim())).toBe(colors[form]);
        const paths = await ultimate.locator('svg').innerHTML();
        if (crests.has(form)) expect(paths).toBe(crests.get(form));
        else crests.set(form, paths);
        expect(await page.evaluate(() => window.__game.getSave().collection)).toEqual(collection);
      }
      await panel.locator('[data-action="personnel-skills-close"]').click();
      await expect(panel).toHaveCount(0);
    }
  }
  expect(crests.size).toBe(16);
  expect(new Set(crests.values()).size).toBe(16);
  expect(await page.evaluate(() => window.__game.getSave().collection)).toEqual(collection);
  expect(errors).toEqual([]);
});
