import { expect, test } from '@playwright/test';
import { finishWave, ready, startBattle } from '../helpers/mobile-ui';

for(const width of [320,390,767,768,1024,1440])test.describe(`viewport ${width}`,()=>{
  test.use({isMobile:width<768,hasTouch:width<768});
  test('allocation opens the 24-node map directly and confirms one skill at a time',async({page},info)=>{
    await page.setViewportSize({width,height:width===320?500:width<768?844:1000});
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await ready(page);await startBattle(page);await finishWave(page);
    await expect(page.locator('.build-cards-view,[data-action=quick-build],[data-action=toggle-expert-constellation]')).toHaveCount(0);
    await expect(page.locator('.skill-configuration')).toBeVisible();
    await expect(page.locator('.skill-network .deep-node')).toHaveCount(24);
    const before=await page.evaluate(()=>({spent:window.__game.state()!.choicesSpent,tick:window.__game.state()!.tick}));
    const node=page.locator('[data-action=deep-node][data-id="C01-A4/0"]');
    const activate=()=>width<768?node.tap():node.click();
    const popup=page.locator('.skill-bottom-sheet');
    await expect(page.locator('.skill-description-dialog')).toHaveCount(0);
    await activate();await expect(popup).toBeVisible();await expect(popup).toHaveAttribute('data-open','true');
    expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(before.spent);
    await popup.getByRole('button',{name:'關閉',exact:true}).click();await expect(popup).toHaveAttribute('data-open','false');
    await activate();await page.keyboard.press('Escape');await expect(popup).toHaveAttribute('data-open','false');
    expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(before.spent);
    await activate();
    // A resize must retain the inspected node, with no mobile card interception.
    await page.setViewportSize({width:width<768?1024:390,height:1366});
    await expect(popup).toBeVisible();await expect(page.locator('.skill-network .deep-node')).toHaveCount(24);
    await popup.getByRole('button',{name:'確認配置',exact:true}).click();
    await expect(popup).toHaveAttribute('data-open','true');await expect(popup.locator('.node-status')).toHaveText('已取得');
    await expect(popup.getByRole('button',{name:'確認配置',exact:true})).toBeDisabled();
    expect(await page.evaluate(()=>window.__game.state()!.treeNodes)).toEqual(['C01-A4/0']);
    expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(before.spent+1);
    expect(await page.evaluate(()=>window.__game.state()!.tick)).toBe(before.tick);
    await page.setViewportSize({width,height:width===320?500:width<768?844:1000});
    await page.screenshot({path:info.outputPath(`restored-map-${width}.png`)});
    await page.getByRole('button',{name:/^開始下一波/}).click();await finishWave(page);
    await expect(page.locator('.skill-configuration')).toBeVisible();await expect(page.locator('.skill-network .deep-node')).toHaveCount(24);
    await expect(page.locator('.build-cards-view')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  });
});

for(const reduced of [false,true])test(`four reactions render, expire and respect reduced motion (${reduced})`,async({page},info)=>{
  await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
  await ready(page);await startBattle(page);
  await page.evaluate(async()=>{
    const path='/src/sim/combat.ts';const {createEnemy,hitEnemy,applyEffect}=await import(path);
    const s=window.__game.state()!;s.enemies=[];s.spawnCursor=s.spawnPlan.length;s.projectiles=[];s.scheduled=[];
    s.weapons.forEach(w=>{w.nextAttack=999999;w.ultimateReadyAt=999999;});
    const a=createEnemy(s,'E01',100,210,0,s.waveFlow!.wave),b=createEnemy(s,'E01',290,320,0,s.waveFlow!.wave);
    for(const e of [a,b]){e.hp=e.maxHp=100000;e.shield=10000;e.speed=0;e.abilityAt=999999;}
    applyEffect(s,a,{id:'thermal',kind:'burn',source:'C05',damageType:'thermal',value:10,expires:s.tick+300,nextTick:s.tick+15,armorIgnore:0});
    applyEffect(s,a,{id:'gravity',kind:'slow',source:'C04',damageType:'gravity',value:.2,expires:s.tick+300,nextTick:0,armorIgnore:0});
    const p={skill:'weapon',raw:10,damageType:'plasma',armorIgnore:0,shieldMultiplier:1};
    hitEnemy(s,a,{...p,source:'C04'});hitEnemy(s,a,{...p,source:'C01'});
    hitEnemy(s,b,{...p,source:'C02'});hitEnemy(s,b,{...p,source:'C03'});
  });
  await page.waitForFunction(()=>window.__game.presentation().combos.labels.length===4);
  const display=await page.evaluate(()=>window.__game.presentation().combos);
  expect(display.labels.map(e=>e.text)).toEqual(expect.arrayContaining(['烈焰黑洞','超導貫穿','電磁引爆','等離子過載']));expect(display.drawCommands).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.__game.presentation().hitStopCount)).toBe(reduced?0:1);
  await page.screenshot({path:info.outputPath('elemental-reactions.png')});
  await expect.poll(()=>page.evaluate(()=>window.__game.presentation().combos.labels.length)).toBe(0);
  expect(await page.evaluate(()=>window.__game.presentation().combos.allocated)).toBeLessThanOrEqual(8);
});
