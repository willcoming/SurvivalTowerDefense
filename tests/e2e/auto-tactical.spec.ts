// Immediate-captain compatibility tests for saved 0.2 campaigns; current cold start is in free-skills.spec.ts.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const dir=process.env.VALIDATION_OUTPUT_DIR??'artifacts/validation/enemy-motion';
test('AUTO: toggle casts on cooldown, waits for targets, pauses, saves and keeps manual control',async({page},info)=>{
  await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  await page.evaluate(()=>window.__game.start({stageId:'S01',squadIds:['C06'],captainId:'C06',seed:101},'0.2.0-dev.1'));
  await page.locator('#battle-loading').waitFor({state:'detached'});await page.locator('[data-action="tutorial-done"]').first().click();
  const auto=page.getByRole('button',{name:'自動施放隊長技能',exact:true});await expect(auto).toHaveAttribute('aria-pressed','false');
  while(await page.locator('#speed-button').innerText()!=='3×')await page.locator('#speed-button').click();
  await page.evaluate(()=>{const s=window.__game.state()!;s.enemies=[];s.projectiles=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;for(const w of s.weapons)w.nextAttack=s.tick+90000;});
  await auto.click();await expect(auto).toHaveAttribute('aria-pressed','true');await page.waitForTimeout(150);expect(await page.evaluate(()=>window.__game.state()!.stats.casts.length)).toBe(0);
  await page.evaluate(async()=>{const path='/src/sim/combat.ts';const {createEnemy}=await import(path);const s=window.__game.state()!;const e=createEnemy(s,'E03',195,150);e.speed=0;e.hp=e.maxHp=100000;});
  await page.waitForFunction(()=>window.__game.state()!.stats.casts.length===1);
  const first=await page.evaluate(()=>({tick:window.__game.state()!.stats.casts[0],ready:window.__game.state()!.tacticalReadyAt}));
  await page.waitForTimeout(200);expect(await page.evaluate(()=>window.__game.state()!.stats.casts.length)).toBe(1);
  await page.locator('[data-action="pause"]').click();const paused=await page.evaluate(async()=>{await window.__game.save();return structuredClone(window.__game.state()!);});
  await page.waitForTimeout(200);expect(await page.evaluate(()=>window.__game.state()!.stats.casts)).toEqual(paused.stats.casts);
  await page.reload();await page.waitForFunction(()=>!!window.__game);await page.locator('[data-action="continue"]').click();await page.locator('#battle-loading').waitFor({state:'detached'});
  await expect(auto).toHaveAttribute('aria-pressed','true');expect(await page.evaluate(()=>window.__game.state()!.tacticalReadyAt)).toBe(first.ready);
  await page.locator('[data-action="resume"]').click();
  // Shorten only the fixture deadline, then let the real input/RAF loop perform the next cast.
  const due=await page.evaluate(()=>{const s=window.__game.state()!;s.tacticalReadyAt=s.tick+12;return s.tacticalReadyAt;});
  await page.waitForFunction(()=>window.__game.state()!.stats.casts.length===2);expect(await page.evaluate(()=>window.__game.state()!.stats.casts[1])).toBe(due);
  await auto.click();await expect(auto).toHaveAttribute('aria-pressed','false');await page.evaluate(()=>{window.__game.state()!.tacticalReadyAt=window.__game.state()!.tick;});await page.waitForTimeout(200);
  expect(await page.evaluate(()=>window.__game.state()!.stats.casts.length)).toBe(2);await page.locator('[data-action="cast"]').click();expect(await page.evaluate(()=>window.__game.state()!.stats.casts.length)).toBe(3);
  // Synthetic earned count exercises the real upgrade pause boundary.
  await auto.click();await page.evaluate(()=>{const s=window.__game.state()!;s.xp=40;s.choicesEarned=1;s.tacticalReadyAt=s.tick+9;});await page.locator('.upgrade-dialog').waitFor();
  const draft=await page.evaluate(()=>({tick:window.__game.state()!.tick,casts:[...window.__game.state()!.stats.casts]}));await page.waitForTimeout(200);expect(await page.evaluate(()=>({tick:window.__game.state()!.tick,casts:[...window.__game.state()!.stats.casts]}))).toEqual(draft);
  await page.evaluate(()=>{const s=window.__game.state()!;s.xp=0;s.choicesEarned=0;s.draft=null;s.pauseReasons=[];s.phase='running';s.config.challengeId='no-skill';s.tacticalReadyAt=s.tick;});await page.waitForTimeout(200);expect(await page.evaluate(()=>window.__game.state()!.stats.casts)).toEqual(draft.casts);
  mkdirSync(`${dir}/screenshots`,{recursive:true});
  const evidence=await page.evaluate(()=>({preferences:window.__game.getSave().preferences,casts:window.__game.state()!.stats.casts}));
  writeFileSync(`${dir}/${info.project.name}-auto-tactical.json`,JSON.stringify({first,due,draft,evidence},null,2));
});

test('AUTO: all six captains cast through normal gameplay; preference carries into a skill-disabled challenge',async({page},info)=>{
  await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  const casts=[];
  for(const captainId of ['C01','C02','C03','C04','C05','C06'] as const){
    await page.evaluate(captainId=>window.__game.start({stageId:'S01',squadIds:[captainId],captainId,seed:101},'0.2.0-dev.1'),captainId);
    await page.locator('#battle-loading').waitFor({state:'detached'});
    if(await page.locator('[data-action="tutorial-done"]').count())await page.locator('[data-action="tutorial-done"]').first().click();
    const auto=page.getByRole('button',{name:'自動施放隊長技能',exact:true});if(await auto.getAttribute('aria-pressed')==='false')await auto.click();
    await page.waitForFunction(()=>window.__game.state()!.stats.casts.length>0);
    await page.waitForFunction(id=>window.__game.presentation().skills.includes(id),captainId);
    casts.push(await page.evaluate(()=>({captain:window.__game.state()!.config.captainId,ticks:window.__game.state()!.stats.casts,skill:window.__game.presentation().cutin})));
  }
  mkdirSync(`${dir}/screenshots`,{recursive:true});await page.screenshot({path:`${dir}/screenshots/${info.project.name}-auto-tactical.png`});
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const toggle=await page.locator('#auto-tactical-button').boundingBox();expect(toggle!.height).toBeGreaterThanOrEqual(44);expect(toggle!.width).toBeGreaterThanOrEqual(44);}
  await page.evaluate(()=>window.__game.start({stageId:'S01',squadIds:['C06'],captainId:'C06',seed:101,challengeId:'no-skill'},'0.2.0-dev.1'));
  await page.locator('#battle-loading').waitFor({state:'detached'});await expect(page.locator('#auto-tactical-button')).toBeDisabled();await expect(page.locator('#tactical-button')).toBeDisabled();await page.waitForTimeout(300);expect(await page.evaluate(()=>window.__game.state()!.stats.casts)).toEqual([]);
  writeFileSync(`${dir}/${info.project.name}-all-auto-captains.json`,JSON.stringify({evidence:'Real initial battles, real auto input policy and skills, no combat field edits. Preference persists across starting another battle; fresh no-skill challenge enforces prohibition.',casts},null,2));
});
