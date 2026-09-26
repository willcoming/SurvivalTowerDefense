import { test, expect, type Page } from '@playwright/test';
import { pathsTo } from '../../scripts/tactical-policy';
import { DEEP_NODE_MAP, deepTreesFor } from '../../src/data/deep-trees';
import type { RunConfig } from '../../src/sim/types';
test.use({isMobile:false,hasTouch:false});

async function boot(page:Page,challengeId?:RunConfig['challengeId']) {
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.goto('/'); await page.waitForFunction(() => !!window.__game);
  await page.evaluate(challengeId => {
    if(challengeId){
      const profile=window.__game.getSave().profile;
      profile.cleared=['S01'];profile.easyCleared=['S01'];profile.hardCleared=['S01'];
    }
    return window.__game.start({stageId:'S01',difficulty:'easy',challengeId,squadIds:['C01','C02','C03','C05','C06'],captainId:'C02',seed:101});
  },challengeId);
  await page.locator('#battle-loading').waitFor({state:'detached'});
  const tutorial=page.locator('[data-action="tutorial-done"]'); if(await tutorial.count())await tutorial.first().click();
  await expect(page.getByRole('button',{name:'存檔需要處理',exact:true})).toHaveCount(0);
}

async function clearToAllocation(page:Page) {
  return page.evaluate(async () => {
    const combatPath='/src/sim/combat.ts',enginePath='/src/sim/engine.ts';
    const {hitEnemy}=await import(combatPath),{stepRun}=await import(enginePath);
    const s=window.__game.state()!;
    for(let i=0;i<5000&&!s.draft&&!s.outcome;i++){
      for(const enemy of s.enemies)if(enemy.hp>0)hitEnemy(s,enemy,{source:'C01',skill:'e2e',raw:1e9,damageType:'plasma',armorIgnore:1,shieldMultiplier:1});
      stepRun(s);
    }
    window.__game.ticks(0);
    return {wave:s.waveFlow!.wave,earned:s.choicesEarned,spent:s.choicesSpent,tick:s.tick};
  });
}

for(const width of [320,768,1024,1440])test(`wave-end allocation supports partial spending and banking at ${width}px`,async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:width===320?640:900});await boot(page);
  await expect(page.locator('#wave-text')).toHaveText('WAVE 1 / 10');
  const first=await clearToAllocation(page);
  await expect(page.getByRole('heading',{name:new RegExp(`第 ${first.wave} 波完成`)})).toBeVisible();
  const confirm=page.locator('[data-action="buy-node"]'),bank=page.getByRole('button',{name:'保留全部點數並繼續',exact:true});
  await expect(confirm).toBeDisabled();await expect(bank).toBeInViewport();
  await page.locator('[data-action="deep-owner"][data-id="C01"]').click();
  const entry=page.locator('[data-action="deep-node"][data-id="C01-A4/0"]');
  await entry.focus();await entry.press('Enter');
  await expect(confirm).toBeEnabled();await expect(confirm).toBeInViewport();
  await expect(page.locator('.points-left')).toContainText(`保留 ${first.earned-1}`);
  await page.screenshot({path:info.outputPath(`wave-allocation-${width}.png`)});
  expect(await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,spent:window.__game.state()!.choicesSpent}))).toEqual({overflow:false,spent:0});
  await confirm.focus();await confirm.press('Space');
  await expect(page.locator('.wave-allocation')).toHaveCount(0);
  expect(await page.evaluate(()=>({spent:window.__game.state()!.choicesSpent,wave:window.__game.state()!.waveFlow!.wave}))).toEqual({spent:1,wave:first.wave+1});
  const second=await clearToAllocation(page);
  await bank.focus();await bank.press('Enter');
  expect(await page.evaluate(()=>({spent:window.__game.state()!.choicesSpent,wave:window.__game.state()!.waveFlow!.wave}))).toEqual({spent:1,wave:second.wave+1});
  await expect(page.locator('.wave-allocation')).toHaveCount(0);
  await page.locator('[data-action="view-build"]').first().click();
  await expect(page.locator('.deep-panel')).toBeVisible();await expect(confirm).toBeDisabled();
  await page.keyboard.press('Escape');await expect(page.locator('.deep-panel')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('one wave allocation enforces the ultimate limit across pending characters',async({page})=>{
  await boot(page,'two-evolutions');
  await page.evaluate(()=>{const s=window.__game.state()!;s.xp=540;s.choicesEarned=18;});
  await clearToAllocation(page);
  let blocked='';
  for(const owner of ['C01','C02','C03'] as const){
    await page.locator(`[data-action="deep-owner"][data-id="${owner}"]`).click();
    const ultimate=deepTreesFor(owner).flatMap(t=>t.nodes).find(n=>n.kind==='ultimate')!;
    const path=pathsTo(ultimate.id).find(path=>path.length===5)!;
    for(const id of path){
      const node=page.locator(`[data-action="deep-node"][data-id="${id}"]`);
      await node.focus();await node.press('Enter');
    }
    if(owner==='C03')blocked=ultimate.id;
  }
  const pending=await page.evaluate(()=>window.__game.state()!.draft!.pendingNodeIds!);
  expect(pending).not.toContain(blocked);
  expect(pending.filter(id=>DEEP_NODE_MAP[id].kind==='ultimate')).toHaveLength(2);
  await expect(page.locator('.skill-selection')).toContainText('全隊終極名額已滿');
  await page.locator('[data-action="buy-node"]').click();
  expect(await page.evaluate(()=>window.__game.state()!.evolvedCount)).toBe(2);
  await expect(page.locator('.wave-allocation')).toHaveCount(0);
});

test('allocation freezes 1×/2×/3× and survives hidden/user pause without advancing a wave',async({page})=>{
  await boot(page);
  for(const speed of [1,2,3]){
    if(speed>1)await page.locator('#speed-button').click();
    await expect(page.locator('#speed-button')).toHaveText(`${speed}×`);
    await clearToAllocation(page);
    const frozen=await page.evaluate(()=>{
      const s=window.__game.state()!;window.__game.ticks(90);
      return {tick:s.tick,wave:s.waveFlow!.wave,cooldowns:s.weapons.map(w=>w.ultimateReadyAt)};
    });
    await page.evaluate(()=>window.__game.command({type:'pause',reason:'hidden'}));
    await expect(page.locator('.pause-dialog')).toBeVisible();
    await page.locator('[data-action="resume"]').click();
    await expect(page.locator('.wave-allocation')).toBeVisible();
    const after=await page.evaluate(()=>{
      const s=window.__game.state()!;window.__game.ticks(90);
      return {tick:s.tick,wave:s.waveFlow!.wave,cooldowns:s.weapons.map(w=>w.ultimateReadyAt)};
    });
    expect(after).toEqual(frozen);
    await page.evaluate(()=>window.__game.command({type:'pause',reason:'user'}));
    await page.getByRole('button',{name:'保留全部點數並繼續',exact:true}).click();
    await expect(page.locator('.pause-dialog')).toBeVisible();
    await page.locator('[data-action="resume"]').click();
    await expect(page.locator('.wave-allocation')).toHaveCount(0);
  }
});

test.describe('touch controls',()=>{
  test.use({isMobile:true,hasTouch:true,viewport:{width:390,height:844}});
  test('selects a skill and banks the next wave using touch',async({page})=>{
    await boot(page);await clearToAllocation(page);
    await page.locator('[data-action="deep-owner"][data-id="C01"]').tap();
    await page.locator('[data-action="deep-node"][data-id="C01-A4/0"]').tap();
    await expect(page.locator('[data-action="buy-node"]')).toBeEnabled();
    await page.locator('[data-action="buy-node"]').tap();
    expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(1);
    await clearToAllocation(page);
    await page.getByRole('button',{name:'保留全部點數並繼續',exact:true}).tap();
    await expect(page.locator('.wave-allocation')).toHaveCount(0);
  });
});
