import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildPlan, pathTo, playDeep } from '../helpers/deep-build';
import { DEEP_NODE_MAP, CHARACTER_TREES } from '../../src/data/deep-trees';
import type { RunConfig } from '../../src/sim/types';
const dir=process.env.VALIDATION_OUTPUT_DIR??'artifacts/validation/free-skills/browser';
mkdirSync(`${dir}/screenshots`,{recursive:true});
async function boot(page:Page,previous=false){
  await page.routeWebSocket('**/*',socket=>socket.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  if(previous)await page.evaluate(()=>window.__game.start({stageId:'S01',squadIds:['C01','C02','C03','C05','C06'],captainId:'C02',seed:101},'0.2.0-dev.1'));
  else{await page.locator('[data-action="intel"]').click();await page.locator('.action-bar [data-action="roster"]').click();await page.locator('[data-action="start"]').click();}
  await page.locator('#battle-loading').waitFor({state:'detached'});await page.locator('[data-action="tutorial-done"]').first().click();
}
async function milestone(page:Page,points?:number){
  await page.evaluate(points=>{if(points){const s=window.__game.state()!;s.xp=points*30;s.choicesEarned=points;}window.__game.ticks(points?1:4000);},points);
  await expect(page.locator('.deep-panel')).toBeVisible();
}
async function inspect(page:Page,id:string){
  const n=DEEP_NODE_MAP[id];await page.locator(`[data-action="deep-owner"][data-id="${n.ownerId}"]`).click();
  await page.locator(`[data-action="deep-tab"][data-id="${n.treeId}"]`).click();await page.locator(`[data-action="deep-node"][data-id="${id}"]`).click();
}
async function take(page:Page,id:string){await inspect(page,id);await page.locator('[data-action="buy-node"]').click();}

test('FREE: real XP pauses for two explicit purchases; partial allocation survives leave/reload with identical enemies',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);
  await page.locator('#speed-button').click();await page.locator('#speed-button').click();await page.locator('#auto-tactical-button').click();
  expect(await page.evaluate(()=>window.__game.state()!.stats.casts)).toHaveLength(0);await milestone(page);
  const before=await page.evaluate(()=>structuredClone(window.__game.state()!));expect(before.contentVersion).toBe('0.3.0-dev.1');expect(before.xp).toBeGreaterThanOrEqual(60);expect(before.stats.casts).toHaveLength(0);
  await expect(page.locator('.upgrade-card')).toHaveCount(0);await expect(page.locator('[data-action="reroll"]')).toHaveCount(0);await expect(page.locator('[data-action="tree-close"]')).toHaveCount(0);
  await expect(page.locator('.operation-intel')).toContainText('護盾');await expect(page.locator('.boss-intel')).toContainText('反制');
  await inspect(page,'C02-A/0');expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(0);
  await page.locator('[data-action="buy-node"]').click();await expect(page.locator('.points-left')).toContainText('1');
  await page.keyboard.press('Escape');await expect(page.locator('.deep-panel')).toBeVisible();
  const saved=await page.evaluate(async()=>{await window.__game.save();return structuredClone(window.__game.state()!);});
  expect(saved.tick).toBe(before.tick);expect(saved.rng).toEqual(before.rng);
  await page.locator('[data-action="tree-save-home"]').click();await page.reload();await page.waitForFunction(()=>!!window.__game);await page.locator('[data-action="continue"]').click();
  await expect(page.locator('.deep-panel')).toBeVisible();
  const restored=await page.evaluate(()=>window.__game.state()!);expect(restored.treeNodes).toEqual(saved.treeNodes);expect(restored.draft).toEqual(saved.draft);expect(restored.rng).toEqual(saved.rng);expect(restored.wavePlan).toEqual(saved.wavePlan);expect(restored.tick).toBe(saved.tick);
  await take(page,'TEAM/0');await expect(page.locator('.deep-panel')).toHaveCount(0);await expect(page.locator('.pause-dialog')).toBeVisible();await page.locator('[data-action="resume"]').click();
  await expect(page.locator('#speed-button')).toHaveText('3×');await expect(page.locator('#auto-tactical-button')).toHaveAttribute('aria-pressed','true');expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(2);
  await page.screenshot({path:`${dir}/screenshots/${info.project.name}-resumed-battle.png`});expect(errors).toEqual([]);
});

test('FREE: connected five-point ultimate, character exclusivity and cross-tree ordinary skills',async({page},info)=>{
  await boot(page);await milestone(page,6);const terminal='C05-A/8';
  for(const id of pathTo(terminal))await take(page,id);
  const other=CHARACTER_TREES.find(t=>t.id==='C05-B')!.nodes.find(n=>n.kind==='ultimate')!.id;
  await inspect(page,other);await expect(page.locator('.node-preview')).toContainText('本角色已取得終極');await expect(page.locator('[data-action="buy-node"]')).toBeDisabled();
  await page.screenshot({path:`${dir}/screenshots/${info.project.name}-terminal-lock.png`});
  await inspect(page,'C05-B/0');await expect(page.locator('[data-action="buy-node"]')).toBeEnabled();await page.locator('[data-action="buy-node"]').click();
  expect(await page.evaluate(()=>window.__game.state()!.treeNodes)).toHaveLength(6);expect(await page.evaluate(()=>window.__game.state()!.evolvedCount)).toBe(1);await expect(page.locator('.deep-panel')).toHaveCount(0);
});

test('FREE: read-only tree freezes 3×, preserves pause and contains keyboard focus',async({page})=>{
  await boot(page);await page.locator('#speed-button').click();await page.locator('#speed-button').click();await page.locator('#auto-tactical-button').click();
  await page.locator('.range-toolbar [data-action="view-build"]').click();const before=await page.evaluate(()=>window.__game.state()!.tick);
  await page.waitForTimeout(250);await page.evaluate(()=>window.__game.ticks(300));expect(await page.evaluate(()=>window.__game.state()!.tick)).toBe(before);
  await inspect(page,'C01-A/0');await expect(page.locator('[data-action="buy-node"]')).toBeDisabled();
  await page.locator('[data-action="tree-close"]').focus();await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('.deep-panel'))).toBe(true);
  await page.keyboard.press('Escape');expect(await page.evaluate(()=>window.__game.state()!.phase)).toBe('running');
  await page.locator('[data-action="pause"]').click();await page.locator('[data-action="view-build"]').last().click();await page.keyboard.press('Escape');await expect(page.locator('.pause-dialog')).toBeVisible();
  await page.locator('[data-action="view-build"]').last().click();await page.evaluate(()=>window.__game.save());await page.reload();await page.waitForFunction(()=>!!window.__game);await page.locator('[data-action="continue"]').click();await page.locator('[data-action="resume"]').click();
  expect(await page.evaluate(()=>window.__game.state()!.pauseReasons)).not.toContain('tree');await expect(page.locator('#speed-button')).toHaveText('3×');
});

test('FREE: 320–1440 layouts, asymmetric graphs and all common routes stay accessible',async({page},info)=>{
  await boot(page);await milestone(page,2);
  for(const [width,height] of [[320,720],[768,1024],[1024,1400],[1440,1600]]){
    await page.setViewportSize({width,height});await inspect(page,'C01-A/0');
    if(await page.locator('.operation-intel').getAttribute('open')!==null)await page.locator('.operation-intel>summary').click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    expect(await page.locator('.deep-node')).toHaveCount(11);expect(await page.locator('.deep-connections path').count()).toBeGreaterThan(10);
    const button=await page.locator('[data-action="buy-node"]').boundingBox();expect(button!.y+button!.height).toBeLessThanOrEqual(height);expect(button!.width).toBeGreaterThanOrEqual(44);expect(button!.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('.tree-scroll').evaluate(e=>e.clientHeight)).toBeGreaterThan(180);
    await page.screenshot({path:`${dir}/screenshots/${info.project.name}-tree-${width}.png`});
  }
  await inspect(page,'C06-A/11');await expect(page.locator('.deep-node')).toHaveCount(12);await expect(page.locator('.deep-node.inspecting')).toBeInViewport();
  await inspect(page,'TEAM/11');await expect(page.locator('.deep-node')).toHaveCount(12);await expect(page.locator('.common-route-labels b')).toHaveCount(3);await expect(page.locator('.deep-node.ultimate')).toHaveCount(0);
  await page.screenshot({path:`${dir}/screenshots/${info.project.name}-shared-tree.png`});
});

test('FREE: three full legal browser playthroughs match simulation and unlock stages',async({page},info)=>{
  test.setTimeout(90000);await page.routeWebSocket('**/*',socket=>socket.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const rows=[];const {squad,owner,plan}=buildPlan('C02-A/9',7);
  for(const stageId of ['S01','S02','S03'] as const){
    const config:RunConfig={stageId,squadIds:squad,captainId:owner,seed:101};const expected=playDeep(config,plan).s;expect(expected.outcome).toBe('victory');
    await page.evaluate(async config=>{const loading=window.__game.start(config);window.__game.command({type:'pause',reason:'user'});await loading;},config);
    await page.locator('#battle-loading').waitFor({state:'detached'});if(await page.locator('[data-action="tutorial-done"]').count())await page.locator('[data-action="tutorial-done"]').first().click();
    const actual=await page.evaluate(async actions=>{
      const api=window.__game,s=api.state()!;api.command({type:'resume',reason:'user'});let cursor=0;
      for(let guard=0;guard<17000&&!s.outcome;guard++){
        while(actions[cursor]?.tick===s.tick)if(!api.command(actions[cursor++].command))throw new Error('Browser replay rejected action');
        if(s.outcome)break;if(s.pauseReasons.length)throw new Error(`Unexpected pause ${s.pauseReasons}`);api.ticks(Math.max(1,(actions[cursor]?.tick??14400)-s.tick));
      }
      await api.save();return {outcome:s.outcome,tick:s.tick,wallHp:s.wallHp,nodes:s.treeNodes,stats:s.stats,rng:s.rng,cleared:api.getSave().profile.cleared,active:api.getSave().activeRun};
    },expected.actions);
    expect(actual.outcome).toBe('victory');expect(actual.tick).toBe(expected.tick);expect(actual.wallHp).toBe(expected.wallHp);expect(actual.nodes).toEqual(expected.treeNodes);expect(actual.stats).toEqual(expected.stats);expect(actual.rng).toEqual(expected.rng);
    await expect(page.locator('.result-screen')).toBeVisible();await expect(page.locator('.choice-history li')).toHaveCount(24);expect(actual.cleared).toContain(stageId);expect(actual.active).toBeNull();rows.push({stageId,tick:actual.tick,wallHp:actual.wallHp,nodes:actual.nodes});
    await page.locator('.result-actions [data-action="home"]').click();
  }
  expect(errors).toEqual([]);writeFileSync(`${dir}/${info.project.name}-playthroughs.json`,JSON.stringify({rows,errors},null,2));
});

test('FREE: previous 70-node saved campaign retains three-card rules',async({page})=>{
  await boot(page,true);await page.evaluate(()=>window.__game.ticks(1600));await expect(page.locator('.tree-upgrade')).toBeVisible();await expect(page.locator('.upgrade-card')).toHaveCount(3);
  await page.evaluate(()=>window.__game.save());await page.reload();await page.waitForFunction(()=>!!window.__game);await page.locator('[data-action="continue"]').click();await page.locator('[data-action="resume"]').click();
  await expect(page.locator('.upgrade-card')).toHaveCount(3);await page.locator('[data-action="select-card"]').first().click();await page.locator('[data-action="confirm-card"]').click();
  expect(await page.evaluate(()=>window.__game.state()!.contentVersion)).toBe('0.2.0-dev.1');expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(1);
});

test('FREE: all six captain animations cast after real initial cooldown at 1× and 3×',async({page},info)=>{
  test.setTimeout(90000);await page.routeWebSocket('**/*',socket=>socket.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);const rows=[];
  for(const captainId of ['C01','C02','C03','C04','C05','C06'] as const)for(const speed of [1,3]){
    await page.evaluate(async captainId=>{const loading=window.__game.start({stageId:'S01',squadIds:[captainId],captainId,seed:101});window.__game.command({type:'pause',reason:'user'});await loading;},captainId);
    await page.locator('#battle-loading').waitFor({state:'detached'});if(await page.locator('[data-action="tutorial-done"]').count())await page.locator('[data-action="tutorial-done"]').first().click();
    const initial=await page.evaluate(async()=>{
      const api=window.__game,s=api.state()!,deadline=s.tacticalReadyAt;const rejected=api.command({type:'cast'});
      const path='/src/sim/deep-tree.ts';const {deepLegalNodes}=await import(path);
      api.command({type:'resume',reason:'user'});
      while(s.tick<deadline){if(s.draft)api.command({type:'buy-node',offerId:s.draft.id,nodeId:deepLegalNodes(s)[0]});else api.ticks(1);}
      while(s.draft)api.command({type:'buy-node',offerId:s.draft.id,nodeId:deepLegalNodes(s)[0]});api.command({type:'pause',reason:'user'});
      return {rejected,deadline,casts:s.stats.casts,earned:s.choicesEarned};
    });expect(initial.rejected).toBe(false);expect(initial.casts).toEqual([]);expect(initial.deadline).toBe(['C01','C03'].includes(captainId)?1350:1500);
    await page.locator('[data-action="resume"]').click();while(await page.locator('#speed-button').innerText()!==`${speed}×`)await page.locator('#speed-button').click();
    const auto=page.locator('#auto-tactical-button');if(await auto.getAttribute('aria-pressed')==='true')await auto.click();
    if(speed===1)await page.locator('[data-action="cast"]').click();else await auto.click();
    await expect.poll(async()=>page.evaluate(async id=>{
      // A kill from the skill can earn XP and pause its animation; finish that legal allocation first.
      const api=window.__game,s=api.state()!;if(s.draft){const path='/src/sim/deep-tree.ts';const {deepLegalNodes}=await import(path);while(s.draft)api.command({type:'buy-node',offerId:s.draft.id,nodeId:deepLegalNodes(s)[0]});}
      const view=api.presentation();return view.cutin.visible&&view.cutin.age>=650&&view.skills.includes(id);
    },captainId),{timeout:7000,intervals:[50]}).toBe(true);
    const view=await page.evaluate(()=>({first:window.__game.state()!.stats.casts[0],view:window.__game.presentation()}));expect(view.first).toBeGreaterThanOrEqual(initial.deadline);expect(view.view.cutin.duration).toBe(1200);expect(view.view.warnings.depth).toBeGreaterThan(view.view.cutin.depth);
    await page.screenshot({path:`${dir}/screenshots/${info.project.name}-${captainId}-cold-skill-${speed}x.png`});rows.push({captainId,speed,initial,first:view.first,cutin:view.view.cutin});
    if(speed===3)await auto.click();
  }
  writeFileSync(`${dir}/${info.project.name}-cold-captains.json`,JSON.stringify({method:'Normal initial cooldown, real XP and legal purchases via simulation ticks; subsequent UI manual/auto cast and real-time rendering. No HP, enemy, cooldown or XP mutations.',rows},null,2));
});
