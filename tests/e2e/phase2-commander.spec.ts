import { test, expect, type Page } from '@playwright/test';
import { ready, startBattle } from '../helpers/mobile-ui';

async function setup(page: Page) {
  await ready(page); await startBattle(page);
  await page.evaluate(async () => {
    const path='/src/sim/combat.ts';const {createEnemy}=await import(path);
    const s=window.__game.state()!;s.enemies=[];s.projectiles=[];s.fields=[];s.scheduled=[];
    s.spawnCursor=s.spawnPlan.length;s.weapons.forEach(w=>{w.nextAttack=999999;w.ultimateReadyAt=999999;});
    const e=createEnemy(s,'E03',195,260,0,s.waveFlow!.wave);e.hp=e.maxHp=100000;e.speed=0;e.abilityAt=999999;
  });
}
for(const width of [320,375,390,430,768,1024,1440]) test.describe(`passive crisis ${width}`,()=>{
  test.use({hasTouch:width<768,isMobile:width<768});
  test('no manual skills; critical glow and one automatic EMP remain',async({page},info)=>{
    await page.setViewportSize({width,height:width===320?568:width<768?844:1000});
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);
    await expect(page.locator('.commander-tactical-hud,#cmd-barrier,#cmd-orbital,#commander-aim-hint,[data-action=cast]')).toHaveCount(0);
    await page.evaluate(()=>{window.__game.state()!.wallHp=300;window.__game.ticks(0);});
    await expect(page.locator('.battle-phone')).not.toHaveClass(/threat-critical/);
    await page.evaluate(()=>{window.__game.state()!.wallHp=299;window.__game.ticks(0);});
    await expect(page.locator('.battle-phone')).toHaveClass(/threat-critical/);
    expect(await page.locator('.battle-phone').evaluate(e=>getComputedStyle(e,'::after').animationName)).toBe('threat-heartbeat');
    await page.evaluate(async()=>{const path='/src/sim/combat.ts';const {hitWall}=await import(path);const s=window.__game.state()!;s.wallHp=201;s.enemies[0].y=350;hitWall(s,2,'E01');});
    await expect.poll(()=>page.evaluate(()=>window.__game.presentation().crisis.pulseCount)).toBe(1);
    expect(await page.evaluate(()=>window.__game.state()!.enemies[0].y)).toBe(150);
    expect(await page.evaluate(()=>window.__game.state()!.enemies[0].effects.some(f=>f.id==='emp-stun'))).toBe(true);
    await page.screenshot({path:info.outputPath(`passive-crisis-${width}.png`)});
    await page.evaluate(async()=>{const path='/src/sim/combat.ts';const {hitWall}=await import(path);const s=window.__game.state()!;s.wallHp=500;hitWall(s,301,'E01');});
    expect(await page.evaluate(()=>window.__game.state()!.events.filter(e=>e.kind==='emp_wave').length)).toBe(1);
    expect(await page.evaluate(()=>window.__game.state()!.actions.some(a=>a.command.type==='commander-skill'))).toBe(false);
    // Clicking or pressing Enter on the battlefield remains enemy focus only.
    await page.locator('#battle-canvas canvas').focus();await page.keyboard.press('Enter');
    expect(await page.evaluate(()=>window.__game.state()!.focusTargetId)).toBeGreaterThan(0);
    expect(await page.evaluate(()=>window.__game.state()!.scheduled.some(h=>h.packet?.skill==='orbital'))).toBe(false);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  });
});
test('reduced motion retains passive EMP feedback without heartbeat animation',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await setup(page);
  await page.evaluate(async()=>{const path='/src/sim/combat.ts';const {hitWall}=await import(path);const s=window.__game.state()!;s.wallHp=201;s.enemies[0].y=350;hitWall(s,2,'E01');});
  await expect(page.locator('.battle-phone')).toHaveClass(/threat-critical/);
  expect(await page.locator('.battle-phone').evaluate(e=>getComputedStyle(e,'::after').animationName)).toBe('none');
  await expect.poll(()=>page.evaluate(()=>window.__game.presentation().crisis.active)).toBe(1);
  expect(await page.evaluate(()=>window.__game.presentation().crisis.drawCommands)).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>window.__game.presentation().crisis.active)).toBe(0);
});
