import { chromium, webkit, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { CONTENT_VERSION } from '../src/data/content';
import { FORMS, formPortrait } from '../src/data/forms';
import { MAIN_IDS, SIDE_IDS, stageArt } from '../src/data/campaign';

const base = new URL(process.env.PRODUCTION_URL ?? 'http://127.0.0.1:5175/SurvivalTowerDefense/');
const output = process.env.VALIDATION_OUTPUT_DIR ?? `artifacts/validation/${CONTENT_VERSION}/pages-release/collection-production`;
mkdirSync(output, { recursive: true });
const summaries = [];
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]] as const) {
  const browser = await engine.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), errors: string[] = [], requests = new Set<string>();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname.includes('/assets/')) requests.add(url.href); });
  try {
    await page.goto(base.href);
    await expect(page.locator('.campaign-selector [data-action="stage"]')).toHaveCount(15);
    assert.equal(await page.evaluate(() => typeof (window as unknown as Record<string, unknown>).__game), 'undefined');
    const commit = await page.locator('meta[name="build-revision"]').getAttribute('content');
    if (process.env.EXPECTED_COMMIT) assert.equal(commit, process.env.EXPECTED_COMMIT);
    await page.locator('.main-nav [data-action="recruitment"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.collection-card')).toHaveCount(10);
    await expect(page.locator('[data-action="draw"]')).toBeDisabled();
    await expect(page.locator('.collection-card').filter({ hasText: '晴海狙擊' })).toHaveCount(1);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const card of await page.locator('.collection-card').all()) {
        await card.scrollIntoViewIfNeeded();
        await expect.poll(() => card.locator('img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: `${output}/${name}-pool-${width}.png`, fullPage: true });
    }
    for (const id of ['C07', 'C08']) {
      for (const [theme, revision] of [['original', 'stage-v3'], ['summer', 'pose-v4']]) {
        assert.ok([...requests].some(url => new URL(url).pathname.endsWith(`/${id}-${theme}-${revision}.webp`)));
      }
    }
    assert.ok(![...requests].some(url => /C0[78]-summer-stage-v3\.webp/.test(url)));
    await page.locator('.main-nav [data-action="codex"]').click();
    for (const id of ['C07', 'C08']) {
      const tab = page.locator(`.character-tabs [data-id="${id}"]`);
      await tab.focus(); await page.keyboard.press('Space');
      await expect(page.locator('.dossier-art img')).toHaveAttribute('alt', id === 'C07' ? '汐音・原始形態' : '熾夏・原始形態');
      await expect.poll(() => page.locator('.dossier-art img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await page.locator('.dossier-art').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/${name}-${id}-codex.png` });
    }
    const checkedAssets = [];
    const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
    for (const path of new Set([...FORMS.map(f => formPortrait(f.id)), ...[...MAIN_IDS, ...SIDE_IDS].map(stageArt)])) {
      const url = new URL(path.slice(1), base); url.searchParams.set('v', commit ?? CONTENT_VERSION);
      const response = await context.request.get(url.href);
      assert.equal(response.status(), 200, path);
      const localHash = hash(readFileSync(`public${path}`)), liveHash = hash(await response.body());
      assert.equal(liveHash, localHash, `Artwork bytes differ: ${path}`);
      checkedAssets.push({ path: url.pathname, sha256: liveHash });
    }
    assert.ok([...requests].every(url => url.startsWith(new URL('assets/', base).href)), 'Assets must retain the project base path');
    assert.deepEqual(errors, []);
    summaries.push({ browser: name, commit, poolEntries: 10, stages: 15, widths: [320, 768, 1024, 1440], checkedAssets, requests: [...requests], errors, passed: true });
  } catch (error) {
    await page.screenshot({ path: `${output}/${name}-failure.png`, fullPage: true });
    writeFileSync(`${output}/${name}-failure.json`, JSON.stringify({ error: String(error), errors }, null, 2));
    throw error;
  } finally { await browser.close(); }
}
const result = { passed: true, url: base.href, contentVersion: CONTENT_VERSION, checkedAt: new Date().toISOString(), browsers: summaries, note: 'Isolated fresh browser contexts; no player save mutation, debug API, seeded rewards or ownership. Exact art bytes, public collection, keyboard navigation and responsive layouts checked. Real gameplay is verified separately by verify-production.ts.' };
writeFileSync(`${output}/summary.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, browsers: summaries.map(({ checkedAssets, requests, ...summary }) => ({ ...summary, verifiedAssets: checkedAssets.length, assetRequests: requests.length })) }, null, 2));
