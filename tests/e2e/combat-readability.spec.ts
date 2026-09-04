import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { StageId } from '../../src/sim/types';

const dir = process.env.VALIDATION_OUTPUT_DIR ?? 'artifacts/validation/combat-readability/browser';
mkdirSync(`${dir}/screenshots`, { recursive: true });
async function boot(page: Page, stageId: StageId = 'S03', speed = 3) {
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.goto('/'); await page.waitForFunction(() => !!window.__game);
  await page.evaluate(stageId => window.__game.start({ stageId, squadIds: ['C01','C02','C03','C04','C05'], captainId: 'C05', seed: 101 }), stageId);
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  await page.locator('[data-action="tutorial-done"]').first().click();
  while (await page.locator('#speed-button').innerText() !== `${speed}×`) await page.locator('#speed-button').click();
}
async function isolate(page: Page) {
  await page.evaluate(() => {
    const s = window.__game.state()!; s.enemies = []; s.projectiles = []; s.fields = []; s.scheduled = [];
    s.spawnCursor = s.spawnPlan.length; s.wallHp = s.wallMaxHp = 100000; s.tacticalReadyAt = 999999;
    s.weapons.forEach(w => w.nextAttack = 999999);
  });
}
async function triggerBoss(page: Page) {
  await isolate(page);
  return page.evaluate(() => new Promise<{ duration: number; ticks: number[]; cooldowns: number[]; snapshots: unknown[] }>(resolve => {
    const s = window.__game.state()!; s.tick = 10799; s.bossSpawned = false;
    let began = 0; const ticks: number[] = [], cooldowns: number[] = [], snapshots: unknown[] = [];
    const frame = (now: number) => {
      if (s.bossIntro) {
        if (!began) began = now;
        ticks.push(s.tick); cooldowns.push(s.tacticalReadyAt);
        if (snapshots.length < 3 && now - began >= snapshots.length * 400) snapshots.push(structuredClone(window.__game.presentation().bossIntro));
      } else if (began) { resolve({ duration: now - began, ticks, cooldowns, snapshots }); return; }
      requestAnimationFrame(frame);
    }; requestAnimationFrame(frame);
  }));
}
for (const stage of ['S01','S02','S03'] as const) for (const speed of [1, 3]) test(`READABILITY ${stage} ${speed}×: entrance holds simulation for 1.5 real seconds`, async ({page}, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page, stage, speed);
  const measurement = triggerBoss(page);
  await page.waitForFunction(() => (window.__game.state()!.bossIntro?.remainingMs ?? 0) < 1000 && !!window.__game.presentation().bossIntro);
  await page.screenshot({ path: `${dir}/screenshots/${info.project.name}-${stage}-${speed}x-entrance.png` });
  const result = await measurement;
  expect(result.duration).toBeGreaterThanOrEqual(1450); expect(result.duration).toBeLessThan(1800);
  expect([...new Set(result.ticks)]).toEqual([10800]); expect([...new Set(result.cooldowns)]).toEqual([999999]);
  expect(await page.evaluate(() => window.__game.state()!.phase)).toBe('running');
  expect(errors).toEqual([]);
  writeFileSync(`${dir}/${info.project.name}-${stage}-${speed}x-entrance.json`, JSON.stringify({ result, errors, evidence: 'Synthetic setup at 05:59.97; real stepRun spawns the Boss and the normal RAF advances the entrance.' }, null, 2));
});

test('READABILITY: portrait range selection, waiting, build access and responsive controls', async ({page}, info) => {
  await boot(page); await isolate(page);
  await page.evaluate(async () => { const path = '/src/sim/combat.ts'; const { createEnemy } = await import(path); const s = window.__game.state()!; const e = createEnemy(s,'E01',195,20,0); e.hp=e.maxHp=100000; e.speed=0; });
  await page.locator('#range-C02').click(); await expect(page.locator('#range-C02')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#range-info')).toContainText('等待敵人進入射程');
  expect(await page.evaluate(() => window.__game.presentation().range?.radius)).toBe(335);
  await page.locator('#range-C03').click(); await expect(page.locator('#range-info')).toContainText('射程內有目標');
  await expect(page.locator('#range-C02')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#range-C03').click(); await expect(page.locator('#range-info')).toHaveText('點選角色查看射程');
  await page.locator('.range-toolbar [data-action="view-build"]').click(); await expect(page.locator('.inline-build')).toBeVisible();
  await page.locator('[data-action="resume"]').click(); await page.locator('#range-C02').click();
  const layouts = [];
  for (const width of [320, 768, 1024, 1440]) {
    // A portrait touch screen at small widths, desktop viewport at large widths.
    await page.setViewportSize({ width, height: width > 900 ? 1600 : width === 320 ? 720 : 1024 });
    const layout = await page.evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, buttons: [...document.querySelectorAll<HTMLElement>('.range-toolbar button, #weapon-strip button')].map(e => ({ width: e.offsetWidth, height: e.offsetHeight })) }));
    expect(layout.overflow).toBe(false); expect(layout.buttons.every(b => b.width >= 44 && b.height >= 44)).toBe(true); layouts.push(layout);
    await page.screenshot({ path: `${dir}/screenshots/${info.project.name}-range-${width}.png`, fullPage: true });
  }
  writeFileSync(`${dir}/${info.project.name}-range-layouts.json`, JSON.stringify(layouts, null, 2));
});

test('READABILITY: real AoE victims, attached status cues, actual burn numbers and field expiry', async ({page}, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page); await isolate(page);
  const ids = await page.evaluate(async () => {
    const path = '/src/sim/combat.ts'; const { createEnemy } = await import(path); const s = window.__game.state()!;
    const enemies = [150,195,240,330].map(x => { const e=createEnemy(s,'E03',x,260,0);e.speed=0;e.hp=e.maxHp=100000;return e; });
    s.weapons.find(w=>w.id==='C04')!.nextAttack=s.tick;
    return enemies.map(e=>e.id);
  });
  await page.waitForFunction(() => window.__game.state()!.events.some(e=>e.kind==='explosion'&&e.source==='C04'));
  await page.evaluate(() => { const s=window.__game.state()!;s.weapons.find(w=>w.id==='C04')!.nextAttack=999999;window.__game.command({type:'pause',reason:'user'}); });
  const impact = await page.evaluate(() => ({event:window.__game.state()!.events.find(e=>e.kind==='explosion'&&e.source==='C04'), view:window.__game.presentation(), hp:window.__game.state()!.enemies.map(e=>({id:e.id,hp:e.hp}))}));
  expect(impact.event!.affectedIds).toEqual(ids.slice(0,2));
  expect(impact.view.hurtIds).toEqual(expect.arrayContaining(ids.slice(0,2)));
  expect(impact.hp.find(e=>e.id===ids[2])!.hp).toBe(100000);
  await page.locator('#battle-overlay').evaluate(e => { e.style.visibility = 'hidden'; });
  await page.screenshot({ path: `${dir}/screenshots/${info.project.name}-actual-aoe.png` });
  await page.locator('#battle-overlay').evaluate(e => { e.style.visibility = ''; });
  await page.evaluate(async () => {
    const path = '/src/sim/combat.ts'; const { applyEffect } = await import(path); const s=window.__game.state()!;
    for (const e of s.enemies) for (const kind of ['burn','slow','stun','exposure'] as const) applyEffect(s,e,{id:`qa-${kind}`,kind,source:'C05',value:kind==='burn'?8:kind==='slow'?.3:kind==='exposure'?.2:1,expires:s.tick+180,nextTick:s.tick+15,armorIgnore:.5});
    s.fields.push({id:s.nextEntityId++,source:'C05',kind:'fire',x:195,y:260,radius:80,expires:s.tick+90,nextTick:s.tick+9999,dps:8,damageType:'thermal',slow:0,slowDuration:0,pull:0,burnDuration:30,armorIgnore:.5});
  });
  await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(() => window.__game.presentation().burnNumbers.length > 0);
  const statuses = await page.evaluate(() => ({view:window.__game.presentation(),events:window.__game.state()!.events.filter(e=>e.kind==='hit'&&e.skill==='burn')}));
  expect(statuses.view.statuses.every(e=>(['burn','slow','stun','exposure'] as const).every(kind=>e.states.includes(kind)))).toBe(true);
  expect(statuses.view.enemyMotions.every(e=>e.mode==='stunned')).toBe(true);
  expect(statuses.view.burnNumbers[0].value).toBeCloseTo(statuses.events[0].value!);
  await page.screenshot({ path: `${dir}/screenshots/${info.project.name}-statuses-fire.png` });
  await page.waitForFunction(() => window.__game.state()!.fields.length === 0);
  expect(await page.evaluate(() => window.__game.presentation().statuses.some(e=>e.states.includes('burn')))).toBe(true);
  await page.waitForFunction(() => window.__game.presentation().statuses.length === 0);
  expect(errors).toEqual([]);
  writeFileSync(`${dir}/${info.project.name}-status-evidence.json`,JSON.stringify({impact,statuses,errors,evidence:'Isolated stationary high-HP targets. Real C04 attack selects victims. Status fixture feeds real stepEffects damage and expiry; no cosmetic damage is fabricated.'},null,2));
});

test('READABILITY: interrupted entrance saves remaining time, resumes once and keeps auto skill deferred', async ({page},info) => {
  await boot(page); await isolate(page);
  await page.locator('#auto-tactical-button').click();
  await page.evaluate(() => { const s=window.__game.state()!;s.tick=10799;s.bossSpawned=false;s.tacticalReadyAt=0; });
  await page.waitForFunction(() => !!window.__game.state()!.bossIntro);
  await page.locator('[data-action="pause"]').click();
  const saved = await page.evaluate(async () => { await window.__game.save(); const s=window.__game.state()!;return {remaining:s.bossIntro!.remainingMs,tick:s.tick,casts:s.stats.casts.length}; });
  await page.waitForTimeout(300); expect(await page.evaluate(() => window.__game.state()!.bossIntro!.remainingMs)).toBe(saved.remaining);
  await page.reload(); await page.waitForFunction(() => !!window.__game); await page.locator('[data-action="continue"]').click(); await page.locator('#battle-loading').waitFor({state:'detached'});
  expect(await page.evaluate(() => window.__game.state()!.bossIntro!.remainingMs)).toBe(saved.remaining);
  await expect(page.locator('#auto-tactical-button')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(() => !window.__game.state()!.bossIntro);
  await page.waitForFunction(() => window.__game.state()!.stats.casts.length > 0);
  const final=await page.evaluate(() => ({actions:window.__game.state()!.actions,casts:window.__game.state()!.stats.casts,view:window.__game.presentation()}));
  expect(saved.casts).toBe(0); expect(final.actions.filter(a=>a.command.type==='finish-boss-intro')).toHaveLength(1);
  writeFileSync(`${dir}/${info.project.name}-entrance-recovery.json`,JSON.stringify({saved,final},null,2));
});
