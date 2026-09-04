import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { CONTENT_VERSION } from '../../src/data/content';
import { BUILD_POLICIES, configFor } from '../simulation/policies';
import { runPolicy } from '../simulation/runner';
import type { Command, RunConfig, RunState } from '../../src/sim/types';
import type { GameSave } from '../../src/storage/repository';

interface BrowserApi {
  state(): RunState | null; getSave(): GameSave; command(command: Command): boolean;
  ticks(count: number): void; start(config: RunConfig): Promise<void>; save(): Promise<void>; route(page: string): void;
}
declare global { interface Window { __game: BrowserApi; __rafPending: number } }
const output = `artifacts/validation/${CONTENT_VERSION}`;
mkdirSync(`${output}/screenshots`, { recursive: true });
// Production has no Vite HMR socket; isolate tests from unrelated asset/document writes.
test.beforeEach(async ({ page }) => { await page.routeWebSocket('**/*', socket => socket.close()); });

async function ready(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game);
}
async function startUi(page: Page) {
  await page.locator('[data-action="intel"]').click();
  await page.locator('.action-bar [data-action="roster"]').click();
  await page.locator('[data-action="start"]').click();
  await page.locator('#battle-loading').waitFor({ state: 'detached', timeout: 30000 });
  await page.locator('[data-action="tutorial-done"]').first().click();
  await expect(page.locator('#battle-canvas canvas')).toBeVisible();
}

test('AC01/02: fresh local game, all six characters, legal squad and three responsive widths', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await expect(page.locator('[data-action="stage"][data-id="S01"]')).toBeEnabled();
  await expect(page.locator('[data-action="stage"][data-id="S02"]')).toBeDisabled();
  await page.locator('.main-nav [data-action="roster"]').click();
  await expect(page.locator('.character-card')).toHaveCount(6);
  await expect(page.locator('.add-character[data-id="C03"]')).toBeDisabled();
  while (await page.locator('.filled-slot').count()) await page.locator('.filled-slot').first().click();
  await expect(page.locator('[data-action="start"]')).toBeDisabled();
  await page.locator('.add-character[data-id="C03"]').click();
  await expect(page.locator('[data-action="start"]')).toBeEnabled();
  await expect(page.locator('.captain-button[data-id="C03"]')).toHaveClass(/selected/);
  await page.locator('[data-action="build"][data-id="T01"]').click();
  for (const [width, height] of [[360, 640], [390, 844], [430, 932]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${output}/screenshots/${info.project.name}-roster-${width}.png`, fullPage: true });
  }
  await page.locator('.main-nav [data-action="codex"]').click();
  await expect(page.locator('.character-tabs button')).toHaveCount(6);
  await expect(page.locator('.route-columns article')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('AC05/06/09: real draft, reroll, reload preservation, explicit card confirmation and pause', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await ready(page); await startUi(page);
  await page.evaluate(() => window.__game.ticks(1200));
  await expect(page.locator('.upgrade-dialog')).toBeVisible();
  await page.locator('#focus-character').selectOption('C05');
  await page.locator('#focus-branch').selectOption('B');
  await page.locator('[data-action="reroll"]').click();
  const before = await page.evaluate(async () => { await window.__game.save(); return structuredClone(window.__game.state()!); });
  await page.reload(); await page.waitForFunction(() => !!window.__game);
  await page.locator('[data-action="continue"]').click();
  await page.locator('[data-action="resume"]').click();
  await expect(page.locator('.upgrade-dialog')).toBeVisible();
  const after = await page.evaluate(() => structuredClone(window.__game.state()!));
  expect(after.tick).toBe(before.tick); expect(after.draft).toEqual(before.draft);
  expect(after.rng).toEqual(before.rng); expect(after.rerollsRemaining).toBe(before.rerollsRemaining);
  expect(after.enemies).toEqual(before.enemies); expect(after.weapons).toEqual(before.weapons);
  expect(after.tacticalReadyAt).toBe(before.tacticalReadyAt);
  await expect(page.locator('[data-action="confirm-card"]')).toBeDisabled();
  await page.locator('.upgrade-card').first().click();
  expect(await page.evaluate(() => window.__game.state()!.choicesSpent)).toBe(before.choicesSpent);
  await page.screenshot({ path: `${output}/screenshots/${info.project.name}-upgrade.png`, fullPage: true });
  await page.locator('[data-action="confirm-card"]').click();
  expect(await page.evaluate(() => window.__game.state()!.choicesSpent)).toBe(before.choicesSpent + 1);
  await page.locator('[data-action="pause"]').click();
  const pausedTick = await page.evaluate(() => window.__game.state()!.tick);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__game.state()!.tick)).toBe(pausedTick);
  await page.locator('[data-action="save-home"]').click();
  await expect(page.locator('[data-action="continue"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('AC09: denied storage is explicit and allows temporary play without fake saved status', async ({ page }) => {
  await page.addInitScript(() => { indexedDB.open = () => { throw new DOMException('test storage denied', 'SecurityError'); }; });
  await page.goto('/');
  await expect(page.locator('[data-action="temporary-play"]')).toBeVisible();
  await page.locator('[data-action="temporary-play"]').click();
  await expect(page.getByText('暫時試玩 · 未儲存', { exact: false }).first()).toBeVisible();
  await expect(page.locator('[data-action="intel"]')).toBeEnabled();
});

test('AC06/UI05: mobile landscape suspends combat and returning portrait keeps explicit user pause', async ({ page }) => {
  await ready(page); await startUi(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByText('請將手機轉回直向', { exact: true })).toBeVisible();
  const tick = await page.evaluate(() => window.__game.state()!.tick);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__game.state()!.tick)).toBe(tick);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-action="resume"]')).toBeEnabled();
  expect(await page.evaluate(() => window.__game.state()!.pauseReasons)).toContain('user');
  await page.locator('[data-action="resume"]').click();
  await expect(page.locator('.pause-dialog')).toHaveCount(0);
});

test('BAL05/AC07/12: browser replays a legitimate complete win and survives five consecutive menu returns', async ({ page }, info) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    window.__rafPending = 0;
    const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
    const pending = new Set<number>();
    window.requestAnimationFrame = callback => {
      let id = 0; id = request(time => { if (pending.delete(id)) window.__rafPending--; callback(time); });
      pending.add(id); window.__rafPending++; return id;
    };
    window.cancelAnimationFrame = id => { if (pending.delete(id)) window.__rafPending--; cancel(id); };
  });
  await ready(page); await startUi(page);
  await page.locator('[data-action="pause"]').click();
  await page.locator('[data-action="abandon-confirm"]').click();
  await page.locator('[data-action="abandon"]').click();
  const policy = BUILD_POLICIES[0];
  const stages = ['S01', 'S02', 'S03', 'S01', 'S02'] as const;
  const cycles: unknown[] = [];
  for (let cycle = 0; cycle < 5; cycle++) {
    const config = { ...configFor(policy, 101), stageId: stages[cycle] };
    const expected = runPolicy(policy, 101, { config }).report;
    expect(expected.outcome).toBe('victory');
    const actual = await page.evaluate(async ({ config, actions }) => {
      const api = window.__game;
      const start = api.start(config);
      const state = api.state()!;
      api.command({ type: 'pause', reason: 'user' });
      await start;
      await new Promise<void>(resolve => { const check = () => document.getElementById('battle-loading') ? setTimeout(check, 20) : resolve(); check(); });
      await new Promise(resolve => setTimeout(resolve, 100));
      api.command({ type: 'resume', reason: 'user' });
      let cursor = 0;
      for (let guard = 0; guard < 16000 && state.phase !== 'ended'; guard++) {
        while (cursor < actions.length && actions[cursor].tick === state.tick) {
          if (!api.command(actions[cursor++].command)) throw new Error(`Browser replay rejected action ${cursor}`);
        }
        if (state.pauseReasons.length) throw new Error(`Browser replay paused: ${state.pauseReasons}`);
        const nextTick = actions[cursor]?.tick ?? 14400;
        api.ticks(Math.max(1, nextTick - state.tick));
      }
      await api.save();
      return { outcome: state.outcome, tick: state.tick, wallHp: state.wallHp, stats: state.stats, choicesSpent: state.choicesSpent, actionsConsumed: cursor, profile: api.getSave().profile };
    }, { config, actions: expected.commandLog });
    expect(actual.outcome).toBe(expected.outcome); expect(actual.tick).toBe(expected.endTick);
    expect(actual.wallHp).toBeCloseTo(expected.wallHp, 8); expect(actual.stats.choices).toEqual(expected.choices);
    expect(actual.stats.damageByCharacter).toEqual(expected.characterDamage); expect(actual.actionsConsumed).toBe(expected.commandLog.length);
    expect(actual.profile.cleared).toContain(config.stageId);
    await expect(page.locator('.result-screen')).toBeVisible();
    await page.locator('.result-actions [data-action="home"]').click();
    await expect(page.locator('[data-action="stage"][data-id="S02"]')).toBeEnabled();
    await page.waitForTimeout(100);
    cycles.push({ stageId: config.stageId, effectiveSeconds: expected.effectiveSeconds, ...await page.evaluate(() => ({ canvasCount: document.querySelectorAll('canvas').length, pendingAnimationFrames: window.__rafPending, activeRunCleared: window.__game.getSave().activeRun === null, summaryCount: window.__game.getSave().profile.recentRuns.length })) });
  }
  const counts = cycles as { canvasCount: number; pendingAnimationFrames: number; activeRunCleared: boolean }[];
  writeFileSync(`${output}/browser-results/${info.project.name}-replay-cycles.json`, JSON.stringify({ contentVersion: CONTENT_VERSION, browser: info.project.name, environment: 'desktop browser engine, not physical mobile', seed: 101, replayedStages: stages, replayPassed: true, cycles }, null, 2));
  expect(counts.every(c => c.canvasCount === 0 && c.activeRunCleared)).toBe(true);
  expect(counts[4].pendingAnimationFrames).toBeLessThanOrEqual(counts[0].pendingAnimationFrames);
});
