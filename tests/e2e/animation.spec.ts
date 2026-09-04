import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { CHARACTER_IDS } from '../../src/data/content';
import type { CharacterId, EnemyId, StageId } from '../../src/sim/types';

const dir = process.env.VALIDATION_OUTPUT_DIR ?? 'artifacts/validation/animation-update';
mkdirSync(`${dir}/screenshots`, { recursive: true });
test.beforeEach(async ({ page }) => { await page.routeWebSocket('**/*', socket => socket.close()); });
async function boot(page: Page) { await page.goto('/'); await page.waitForFunction(() => !!window.__game); }
async function start(page: Page, id: CharacterId, stageId: StageId = 'S01') {
  await page.evaluate(async ({ id, stageId }) => {
    const all: CharacterId[] = ['C01','C02','C03','C04','C05','C06'];
    await window.__game.start({ stageId, squadIds: [id, ...all.filter(c => c !== id)].slice(0,5), captainId: id, seed: 101 });
  }, { id, stageId });
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  if (await page.locator('[data-action="tutorial-done"]').count()) await page.locator('[data-action="tutorial-done"]').first().click();
}
async function speed3(page: Page) {
  while (await page.locator('#speed-button').innerText() !== '3×') await page.locator('#speed-button').click();
}

for (const id of CHARACTER_IDS) test(`ANIM ${id}: six real sprite poses, skill at 1× and 3×`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page); await start(page, id);
  // Observe all poses through real gameplay instead of assuming a fixed startup delay.
  await page.waitForFunction(id => window.__game.presentation().poses[id]?.seen.length === 6, id, { timeout: 12000 });
  const poses = await page.evaluate(id => window.__game.presentation().poses[id], id);
  expect(poses.seen).toEqual([0,1,2,3,4,5]); expect(poses.texture).toBe(`motion-${id}`);
  expect(await page.evaluate(id => window.__game.presentation().textureFrames[id], id)).toBe(6);
  const samples = [];
  for (const speed of [1,3]) {
    if (speed === 3) { await speed3(page); await start(page, id); }
    await expect(page.locator('[data-action="cast"]')).toBeEnabled();
    await page.locator('[data-action="cast"]').click();
    await page.waitForFunction(id => window.__game.presentation().cutin.visible && window.__game.presentation().cutin.age >= 80 && window.__game.presentation().skills.includes(id), id);
    const before = await page.evaluate(() => ({ tick: window.__game.state()!.tick, ...window.__game.presentation() }));
    await page.screenshot({ path: `${dir}/screenshots/${info.project.name}-${id}-skill-${speed}x.png` });
    await page.waitForTimeout(550);
    const after = await page.evaluate(() => ({ tick: window.__game.state()!.tick, ...window.__game.presentation() }));
    expect(before.cutin.duration).toBe(500); expect(before.cutin.top).toBeGreaterThan(before.warnings.bottom);
    expect(before.warnings.depth).toBeGreaterThan(before.cutin.depth);
    expect(after.cutin.visible).toBe(false); expect(after.tick).toBeGreaterThan(before.tick);
    samples.push({ speed, before, after });
  }
  writeFileSync(`${dir}/${info.project.name}-${id}-skills.json`, JSON.stringify({ evidence: 'Real-time legal initial battles and DOM skill casts; no combat fixture edits.', samples, errors }, null, 2));
  expect(errors).toEqual([]);
});

test('ANIM: pause freezes animation and refresh does not replay an old skill', async ({ page }, info) => {
  await boot(page); await start(page, 'C06'); await speed3(page);
  await page.locator('[data-action="cast"]').click();
  await page.waitForFunction(() => window.__game.presentation().cutin.visible);
  await page.locator('[data-action="pause"]').click();
  await page.waitForTimeout(50);
  const before = await page.evaluate(async () => { await window.__game.save(); return { tick: window.__game.state()!.tick, view: window.__game.presentation() }; });
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ tick: window.__game.state()!.tick, view: window.__game.presentation() }));
  expect(after.tick).toBe(before.tick); expect(after.view.clock).toBe(before.view.clock); expect(after.view.poses).toEqual(before.view.poses); expect(after.view.cutin.age).toBe(before.view.cutin.age);
  await page.reload(); await page.waitForFunction(() => !!window.__game);
  await page.locator('[data-action="continue"]').click(); await page.locator('#battle-loading').waitFor({ state: 'detached' });
  expect(await page.locator('#speed-button').innerText()).toBe('3×');
  expect(await page.evaluate(() => window.__game.state()!.tick)).toBe(before.tick);
  const restored = await page.evaluate(() => window.__game.presentation()); expect(restored.skills).toEqual([]); expect(restored.cutin.visible).toBe(false);
  await page.locator('[data-action="resume"]').click(); await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__game.presentation().skills)).toEqual([]);
  writeFileSync(`${dir}/${info.project.name}-pause-recovery.json`, JSON.stringify({ before, after, restored }, null, 2));
});

for (const id of CHARACTER_IDS) for (const branch of ['A','B'] as const) test(`ANIM ${id}-${branch}: evolution form rendered at 1×/3×`, async ({ page }, info) => {
  // Presentation fixture isolates each form. It is not evidence of earning the evolution or balance.
  await boot(page); await start(page, id, 'S03');
  await page.evaluate(async ({ id, branch }) => {
    const path = '/src/sim/weapons.ts', combatPath = '/src/sim/combat.ts';
    const { applyUpgrade } = await import(path), { createEnemy } = await import(combatPath);
    const state = window.__game.state()!;
    state.enemies = []; state.projectiles = []; state.fields = [];
    for (let i=0;i<8;i++) { const e = createEnemy(state, 'E03', 75+i%4*65, 165+Math.floor(i/4)*55); e.hp = e.maxHp = 100000; e.speed = 0; }
    for (const w of state.weapons) w.nextAttack = state.tick + 9000;
    for (let rank=1;rank<=3;rank++) applyUpgrade(state, `${id}-${branch}-${rank}`);
    state.weapons.find(w=>w.id===id)!.nextAttack = state.tick;
  }, { id, branch });
  await page.waitForFunction(form => window.__game.presentation().forms.includes(form), `${id}-${branch}`);
  const samples = [];
  for (const speed of [1,3]) {
    if (speed===3) await speed3(page);
    // Trigger the next normal attack in the fixture, then let the normal RAF/simulation render it.
    const count = await page.evaluate(id => { const s=window.__game.state()!, w=s.weapons.find(w=>w.id===id)!;w.nextAttack=s.tick;return w.attacks; }, id);
    await page.waitForFunction(({ id, count }) => window.__game.state()!.weapons.find(w=>w.id===id)!.attacks > count, { id, count });
    await page.screenshot({ path: `${dir}/screenshots/${info.project.name}-${id}-${branch}-${speed}x.png` });
    const view = await page.evaluate(() => window.__game.presentation()); expect(view.forms).toContain(`${id}-${branch}`); samples.push({ speed, view });
  }
  writeFileSync(`${dir}/${info.project.name}-${id}-${branch}.json`, JSON.stringify({ evidence: 'Synthetic presentation fixture with explicit evolution/target setup; normal combat/render loop drives the effects.', samples }, null, 2));
});

test('ANIM: all eight enemy types and three bosses react and collapse', async ({ page }, info) => {
  await boot(page); const samples = [];
  const groups: [StageId, EnemyId[]][] = [['S03',['E01','E02','E03','E04','E05','E06','E07','E08','B03']],['S01',['B01']],['S02',['B02']]];
  for (const [stage, types] of groups) {
    await start(page, 'C01', stage);
    await page.evaluate(() => { const s=window.__game.state()!;s.enemies=[];s.projectiles=[];s.scheduled=[];for(const w of s.weapons)w.nextAttack=s.tick+9000; });
    for (const defId of types) {
      const targetId = await page.evaluate(async defId => { const path='/src/sim/combat.ts';const {createEnemy,hitEnemy}=await import(path);const s=window.__game.state()!;const e=createEnemy(s,defId,195,230);e.speed=0;hitEnemy(s,e,{source:'C01',skill:'animation-fixture',raw:1,damageType:'plasma',armorIgnore:0,shieldMultiplier:1});return e.id; }, defId);
      await page.waitForFunction(targetId=>window.__game.presentation().hurtIds.includes(targetId), targetId);
      await page.screenshot({path:`${dir}/screenshots/${info.project.name}-${defId}-hit.png`});
      await page.evaluate(async targetId => { const path='/src/sim/combat.ts';const {hitEnemy}=await import(path);const s=window.__game.state()!,e=s.enemies.find(e=>e.id===targetId)!;hitEnemy(s,e,{source:'C01',skill:'animation-fixture',raw:100000,damageType:'plasma',armorIgnore:1,shieldMultiplier:1}); },targetId);
      await page.waitForFunction(targetId=>window.__game.presentation().corpseIds.includes(targetId),targetId);
      const view=await page.evaluate(()=>window.__game.presentation());expect(view.activeCorpses).toBeGreaterThan(0);
      await page.screenshot({path:`${dir}/screenshots/${info.project.name}-${defId}-death.png`});
      await page.waitForTimeout(720);
      expect(await page.evaluate(targetId=>window.__game.presentation().corpseIds.includes(targetId),targetId)).toBe(false);
      samples.push({defId,view});
    }
  }
  writeFileSync(`${dir}/${info.project.name}-enemies.json`,JSON.stringify({evidence:'Synthetic presentation fixtures with explicit nonlethal/lethal hit commands for every enemy skin; not a balance result.',samples},null,2));
});

test('ANIM: 3× pressure and reduced effects preserve charging warnings above skills',async({page},info)=>{
  await boot(page);await start(page,'C05','S03');await speed3(page);
  await page.evaluate(async()=>{ const path='/src/sim/combat.ts';const {createEnemy}=await import(path);const s=window.__game.state()!;s.enemies=[];s.projectiles=[];for(const w of s.weapons)w.nextAttack=s.tick+9000;
    for(let i=0;i<80;i++){const e=createEnemy(s,i===0?'B03':'E03',25+i%10*37,105+Math.floor(i/10)*35);e.speed=0;e.hp=e.maxHp=100000;}
    const boss=s.enemies[0];boss.chargeKind='boss';boss.chargeUntil=s.tick+90;boss.chargeCancelled=false;
  });
  await page.locator('[data-action="cast"]').click();
  await page.waitForFunction(()=>window.__game.presentation().cutin.visible&&window.__game.presentation().warnings.visible);
  const view=await page.evaluate(()=>window.__game.presentation());expect(view.detail).toBe('compact');expect(view.warnings.bottom).toBeLessThan(view.cutin.top);expect(view.warnings.depth).toBeGreaterThan(view.cutin.depth);expect(view.activeEffects).toBeLessThanOrEqual(34);
  await page.screenshot({path:`${dir}/screenshots/${info.project.name}-3x-warning-cutin.png`});
  await page.locator('[data-action="pause"]').click();await page.locator('#reduced').check();await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(()=>window.__game.presentation().detail==='compact');
  expect(await page.evaluate(()=>window.__game.presentation().warnings.visible)).toBe(true);
  writeFileSync(`${dir}/${info.project.name}-warning-priority.json`,JSON.stringify({evidence:'80-enemy presentation fixture with an actual 3× clock and a live captain skill.',view},null,2));
});

for (const reload of [false, true]) test(`ANIM: final boss collapse ${reload ? 'can be interrupted by reload without losing the win' : 'plays before the victory result'}`, async ({ page }, info) => {
  await boot(page); await start(page, 'C03'); await speed3(page);
  const target = await page.evaluate(async () => {
    const path = '/src/sim/combat.ts'; const { createEnemy } = await import(path);
    const s = window.__game.state()!;
    // Isolate the final-hit boundary; the normal weapon/stepRun must cause victory.
    s.enemies = []; s.projectiles = []; s.fields = []; s.scheduled = [];
    s.spawnCursor = s.spawnPlan.length; s.bossSpawned = true;
    for (const w of s.weapons) w.nextAttack = s.tick + 9000;
    const boss = createEnemy(s, 'B01', 195, 230); boss.hp = 1; boss.shield = 0;
    s.weapons.find(w => w.id === 'C03')!.nextAttack = s.tick;
    return boss.id;
  });
  await page.waitForFunction(target => window.__game.state()!.outcome === 'victory' && window.__game.presentation()?.corpseIds.includes(target), target);
  const before = await page.evaluate(() => ({ tick: window.__game.state()!.tick, view: window.__game.presentation(), profile: window.__game.getSave().profile }));
  expect(before.profile.cleared).toContain('S01');
  expect(before.view.activeCorpses).toBeGreaterThan(0);
  await expect(page.locator('.result-screen')).toHaveCount(0);
  await page.waitForTimeout(180);
  expect(await page.evaluate(() => window.__game.state()!.tick)).toBe(before.tick);
  expect(await page.evaluate(target => window.__game.presentation().corpseIds.includes(target), target)).toBe(true);
  await page.screenshot({ path: `${dir}/screenshots/${info.project.name}-final-boss-mid-collapse${reload ? '-reload' : ''}.png` });
  if (reload) {
    await page.evaluate(() => window.__game.save()); await page.reload(); await page.waitForFunction(() => !!window.__game);
    expect(await page.evaluate(() => window.__game.getSave().activeRun)).toBeNull();
    expect(await page.evaluate(() => window.__game.getSave().profile.cleared)).toContain('S01');
    expect(await page.evaluate(() => window.__game.getSave().profile.recentRuns.length)).toBe(1);
    await expect(page.locator('[data-action="stage"][data-id="S02"]')).toBeEnabled();
  } else {
    await expect(page.locator('.result-screen')).toBeVisible();
    expect(await page.evaluate(() => window.__game.getSave().activeRun)).toBeNull();
    expect(await page.evaluate(() => window.__game.getSave().profile.recentRuns.length)).toBe(1);
  }
  writeFileSync(`${dir}/${info.project.name}-final-boss${reload ? '-reload' : ''}.json`, JSON.stringify({ evidence: 'Synthetic final-hit setup; the actual weapon and simulation trigger victory, with normal immediate completion persistence.', before, reload, passed: true }, null, 2));
});
