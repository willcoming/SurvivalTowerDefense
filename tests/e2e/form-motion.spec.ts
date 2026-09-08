import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { ALLY_MOTION } from '../../src/data/character-motion';
import { formMotion } from '../../src/data/forms';
import type { CharacterId, FormId } from '../../src/sim/types';

const output = process.env.VALIDATION_OUTPUT_DIR || 'artifacts/validation/form-motion';
mkdirSync(output, { recursive: true });
test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });
for (const theme of ['original', 'summer'] as const) for (const group of [
  ['C01','C05','C06','C07','C08'], ['C02','C03','C04'],
] as CharacterId[][]) test(`${theme}: ${group.join(',')} use Q sprites and actual attacks`, async ({ page }, info) => {
  const errors: string[] = [], loaded: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    if (response.url().includes('/assets/animations/')) loaded.push(new URL(response.url()).pathname);
  });
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.goto('/'); await page.waitForFunction(() => !!window.__game);
  await page.evaluate(async ({ group, theme }) => {
    window.__game.getSave().preferences.autoTactical = false;
    await window.__game.start({ stageId:'S01', squadIds:group, captainId:group[0], seed:101,
      forms:Object.fromEntries(group.map(id=>[id, `${id}-${theme}` as FormId])) });
  }, { group, theme });
  await page.locator('#battle-loading').waitFor({ state:'detached' });
  // Visual fixture: durable stationary targets, real cooldowns, attacks, mines and heat.
  await page.evaluate(async () => {
    const path = '/src/sim/combat.ts'; const { createEnemy } = await import(path);
    const s = window.__game.state()!;
    s.enemies=[]; s.spawnCursor=s.spawnPlan.length; s.tacticalReadyAt=999999;
    for (const x of [85,195,305]) { const enemy=createEnemy(s,'E03',x,385); enemy.hp=enemy.maxHp=1000000; enemy.speed=0; }
    for (const w of s.weapons) w.nextAttack=s.tick+18;
  });
  await page.locator('[data-action="tutorial-done"]').first().click();
  const samples = await page.evaluate(async () => {
    const poses: Record<string, number[]> = {}, skills = new Set<string>(), cooling = new Set<boolean>();
    let mismatch = false, maxMines = 0;
    const until = performance.now()+7200;
    while (performance.now()<until) {
      const view=window.__game.presentation(), s=window.__game.state()!;
      for (const [id, p] of Object.entries(view.poses) as [string,{frame:number;renderedFrame:number}][]) {
        if (p.frame!==p.renderedFrame) mismatch=true;
        const frames=poses[id]??(poses[id]=[]); if(!frames.includes(p.renderedFrame))frames.push(p.renderedFrame);
      }
      for (const event of s.events) if(event.source)skills.add(`${event.source}:${event.skill??event.kind}`);
      maxMines=Math.max(maxMines,s.mines?.length??0);
      const rotary=s.weapons.find(w=>w.id==='C08'); if(rotary)cooling.add(!!rotary.cooling);
      await new Promise(resolve=>setTimeout(resolve,16));
    }
    return { poses, skills:[...skills], cooling:[...cooling], mismatch, maxMines, view:window.__game.presentation() };
  });
  expect(samples.mismatch).toBe(false);
  for (const id of group) {
    expect(samples.view.textureFrames[id]).toBe(6);
    expect(samples.poses[id]).toEqual(expect.arrayContaining([3,4,5]));
    expect(samples.view.poses[id].texture).toBe(`motion-${id}`);
    expect(samples.view.poses[id].width).toBe(ALLY_MOTION.displaySize);
    expect(loaded).toContain(formMotion(`${id}-${theme}`));
  }
  expect(new Set(loaded).size).toBe(group.length);
  if (group.includes('C07')) { expect(samples.skills).toContain('C07:mine-deploy'); expect(samples.skills).toContain('C07:mine'); expect(samples.maxMines).toBeGreaterThan(0); }
  if (group.includes('C08')) expect(samples.cooling).toEqual(expect.arrayContaining([false,true]));
  await page.screenshot({ path:`${output}/${info.project.name}-${theme}-${group[0]}-390x844.png` });
  await page.locator('[data-action="pause"]').click();
  const before=await page.evaluate(()=>({tick:window.__game.state()!.tick,clock:window.__game.presentation().clock,poses:window.__game.presentation().poses}));
  await page.waitForTimeout(180);
  expect(await page.evaluate(()=>({tick:window.__game.state()!.tick,clock:window.__game.presentation().clock,poses:window.__game.presentation().poses}))).toEqual(before);
  await page.locator('[data-action="resume"]').click();
  while(await page.locator('#speed-button').innerText()!=='3×')await page.locator('#speed-button').click();
  await page.waitForTimeout(600);
  expect(await page.evaluate(()=>window.__game.state()!.tick)).toBeGreaterThan(before.tick);
  // Desktop layout uses the same sprite contract, with camera aspect compensation.
  await page.setViewportSize({width:1280,height:900});
  await page.screenshot({path:`${output}/${info.project.name}-${theme}-${group[0]}-desktop.png`});
  expect(errors).toEqual([]);
});
