import { chromium } from '@playwright/test';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { CHARACTER_IDS } from '../src/data/content';

const dir = process.env.VALIDATION_OUTPUT_DIR ?? 'artifacts/validation/captain-presence/demo';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir, size: { width: 390, height: 844 } } });
const page = await context.newPage(), errors: string[] = [], samples = [];
page.on('pageerror', error => errors.push(error.message));
await page.routeWebSocket('**/*', socket => socket.close());
try {
  await page.goto('http://127.0.0.1:5173'); await page.waitForFunction(() => !!window.__game);
  for (const id of CHARACTER_IDS) {
    await page.evaluate(id => window.__game.start({ stageId: 'S03', squadIds: [id], captainId: id, seed: 101 }), id);
    await page.locator('#battle-loading').waitFor({ state: 'detached' });
    if (await page.locator('[data-action="tutorial-done"]').count()) await page.locator('[data-action="tutorial-done"]').first().click();
    while (await page.locator('#speed-button').innerText() !== '3×') await page.locator('#speed-button').click();
    await page.evaluate(async () => {
      const path = '/src/sim/combat.ts'; const { createEnemy } = await import(path); const s = window.__game.state()!;
      s.enemies = []; s.projectiles = []; s.fields = []; s.scheduled = []; s.spawnCursor = s.spawnPlan.length; s.bossSpawned = true;
      for (let i = 0; i < 6; i++) { const e = createEnemy(s, 'E03', 105 + i % 3 * 90, 185 + Math.floor(i / 3) * 60); e.hp = e.maxHp = 100000; e.speed = 0; }
    });
    if (id === 'C06') await page.getByRole('button', { name: '自動施放隊長技能', exact: true }).click();
    else await page.locator('[data-action="cast"]').click();
    await page.waitForFunction(() => window.__game.presentation().cutin.visible && window.__game.presentation().cutin.age >= 550);
    const view = await page.evaluate(() => window.__game.presentation());
    await page.screenshot({ path: `${dir}/${id}-3x.png` }); samples.push({ id, automatic: id === 'C06', view });
    await page.waitForFunction(() => !window.__game.presentation().visibleEffects.some((effect: { kind: string }) => effect.kind === 'tactical'));
    await page.waitForTimeout(250);
  }
  await page.locator('[data-action="pause"]').click();
  const widths = [];
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    widths.push({ width, overflow }); if (overflow) throw new Error(`Overflow at ${width}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  writeFileSync(`${dir}/capture.json`, JSON.stringify({ evidence: 'Real 3× simulation and captain inputs, with durable stationary targets to isolate each visual. C06 uses automatic input. Desktop browser only.', samples, widths, errors }, null, 2));
} finally {
  const video = page.video(); await context.close();
  if (video) renameSync(await video.path(), `${dir}/six-captain-skills-3x.webm`);
  await browser.close();
}
