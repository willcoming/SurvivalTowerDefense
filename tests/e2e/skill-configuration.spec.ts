import { expect, test, type Locator } from '@playwright/test';
import { finishWave, ready, reachable, startBattle } from '../helpers/mobile-ui';

for (const viewport of [{width:320,height:500},{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900}]) {
  test.describe(`skill allocation ${viewport.width}`, () => {
    test.use({isMobile:viewport.width<=800,hasTouch:viewport.width<=800});
    test('node taps open a two-action popup and preserve points until confirmation', async ({page}, info) => {
      const activate=(control:Locator)=>viewport.width<=800?control.tap():control.click();
      const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
      await page.setViewportSize(viewport);await ready(page);await startBattle(page);await finishWave(page);
      await page.evaluate(async()=>{const path='/src/data/battle-experience.ts';const {battleXpAt}=await import(path);const s=window.__game.state()!;s.xp=battleXpAt(5);s.choicesEarned=4;s.draft!.pointTarget=4;window.__game.ticks(0);});
      const firstOwner=await page.evaluate(()=>window.__game.state()!.config.squadIds[0]);
      await expect(page.locator('[data-action=deep-owner][aria-pressed=true]')).toHaveAttribute('data-id',firstOwner);
      await expect(page.locator('[data-action=deep-tab],.tree-tabs,.network-discipline,.allocation-budget,.skill-selection')).toHaveCount(0);
      await expect(page.getByRole('button',{name:'效果／前置',exact:true})).toHaveCount(0);
      await expect(page.locator('.skill-configuration')).toHaveCSS('background-color','rgb(13, 27, 37)');
      expect(await page.locator('.character-avatar').first().evaluate(el=>el.clientWidth)).toBeGreaterThanOrEqual(46);
      expect(await page.locator('.points-left small').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
      await expect(page.locator('.deep-node.locked small')).not.toContainText(['未解鎖']);
      const first=page.locator('[data-action=deep-node][data-id="C01-A4/0"]');
      const second=page.locator('[data-action=deep-node][data-id="C01-A4/1"]');
      const popup=page.locator('.skill-description-dialog[open]');
      const confirm=popup.locator('[data-action=buy-node]');
      const close=popup.getByRole('button',{name:'關閉',exact:true});
      const before=await page.evaluate(()=>({spent:window.__game.state()!.choicesSpent,tick:window.__game.state()!.tick}));
      await reachable(first);await activate(first);
      await expect(popup).toBeVisible();
      expect(await popup.evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(viewport.height-60);
      await expect(popup.getByRole('button')).toHaveText(['確認配置','關閉']);
      await expect(popup).toContainText('待確認');await expect(popup).not.toContainText('本次使用');
      const effect=await page.evaluate(async()=>{const path='/src/data/deep-trees.ts';const {DEEP_NODE_MAP}=await import(path);return DEEP_NODE_MAP['C01-A4/0'].description;});
      await expect(popup.locator('.node-effect')).toHaveText(effect);await reachable(confirm);await reachable(close);
      expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(before.spent);
      await activate(close);await expect(popup).toHaveCount(0);await expect(first).toBeFocused();
      expect(await page.evaluate(()=>window.__game.state()!.draft!.pendingNodeIds)).toEqual([]);
      await reachable(page.locator('[data-action=bank-wave-points]'));
      const box=(await first.boundingBox())!;
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+35,box.y+box.height/2-20,{steps:5});await page.mouse.up();
      expect(await page.evaluate(()=>window.__game.state()!.draft!.pendingNodeIds)).toEqual([]);await expect(popup).toHaveCount(0);
      await page.getByRole('button',{name:'起點',exact:true}).click();
      await activate(first);await expect(confirm).toBeEnabled();await close.click();
      await page.keyboard.press('Tab');await second.focus();await reachable(second);await activate(second);
      await expect(popup.locator('.node-prerequisites')).toContainText('分流槍機 未取得');await expect(confirm).toBeDisabled();
      expect(await page.evaluate(()=>window.__game.state()!.draft!.pendingNodeIds)).toEqual([]);
      await page.keyboard.press('Escape');await expect(popup).toHaveCount(0);await expect(second).toBeFocused();
      await page.locator('[data-action=tree-exit]').click();await expect(page.getByRole('alertdialog')).toContainText('結束本局');await page.locator('[data-action=navigation-cancel]').click();
      await page.keyboard.press('Tab');await first.focus();await activate(first);await expect(confirm).toBeEnabled();
      await activate(confirm);await expect(popup).toHaveCount(0);await expect(first).toBeFocused();
      expect(await page.evaluate(()=>window.__game.state()!.treeNodes)).toEqual(['C01-A4/0']);
      expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(before.spent+1);
      await expect(page.locator('.points-left')).toContainText('可用 3 點');await expect(page.locator('.wave-allocation')).toBeVisible();
      await activate(first);await expect(confirm).toBeDisabled();await close.click();
      await second.focus();await second.press('Enter');await expect(confirm).toBeEnabled();
      await expect(popup.locator('.node-prerequisites')).toContainText('分流槍機 ✓ 已取得');
      await page.screenshot({path:info.outputPath(`allocation-popup-${viewport.width}.png`)});await activate(confirm);
      await expect(popup).toHaveCount(0);await expect(page.locator('.wave-allocation')).toBeVisible();
      expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(before.spent+2);
      expect(await page.evaluate(()=>window.__game.state()!.treeNodes)).toEqual(['C01-A4/0','C01-A4/1']);
      expect(await page.evaluate(()=>window.__game.state()!.draft!.pendingNodeIds)).toEqual([]);
      await expect(page.locator('.points-left')).toContainText('可用 2 點');
      await page.locator('[data-action=bank-wave-points]').click();await expect(page.locator('.wave-allocation')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });
}

test('single confirmation charges the ultimate cost and preserves a valid remaining-point snapshot',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await ready(page);await startBattle(page);await finishWave(page);
  await page.evaluate(async()=>{const path='/src/data/battle-experience.ts';const {battleXpAt}=await import(path);const s=window.__game.state()!;s.xp=battleXpAt(9);s.choicesEarned=8;s.draft!.pointTarget=8;window.__game.ticks(0);});
  const popup=page.locator('.skill-description-dialog[open]');
  for(const id of ['C01-A4/0','C01-A4/1','C01-A4/2','C01-A4/3']){
    const target=page.locator(`[data-action=deep-node][data-id="${id}"]`);await target.focus();await target.press('Enter');
    await popup.locator('[data-action=buy-node]').click();await expect(popup).toHaveCount(0);
  }
  const ultimate=page.locator('[data-action=deep-node][data-id="C01-A4/4"]');await ultimate.focus();await ultimate.press('Enter');
  await expect(popup.locator('[data-action=buy-node]')).toBeEnabled();await expect(page.locator('.points-left small')).toHaveText('已選 2 · 保留 2');
  expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(4);
  await page.screenshot({path:info.outputPath('single-ultimate-confirmation.png')});
  await popup.locator('[data-action=buy-node]').click();
  expect(await page.evaluate(()=>({spent:window.__game.state()!.choicesSpent,nodes:window.__game.state()!.treeNodes,pending:window.__game.state()!.draft!.pendingNodeIds,evolved:window.__game.state()!.evolvedCount}))).toEqual({spent:6,nodes:['C01-A4/0','C01-A4/1','C01-A4/2','C01-A4/3','C01-A4/4'],pending:[],evolved:1});
  await expect(page.locator('.points-left')).toContainText('可用 2 點');await expect(popup).toHaveCount(0);
  const restored=await page.evaluate(async()=>{const path='/src/sim/engine.ts';const {restoreRun}=await import(path);const s=restoreRun(JSON.parse(JSON.stringify(window.__game.state())));return {spent:s.choicesSpent,earned:s.choicesEarned,pending:s.draft!.pendingNodeIds};});
  expect(restored).toEqual({spent:6,earned:8,pending:[]});
  expect(errors).toEqual([]);
});

test('an ultimate cannot be confirmed with one point remaining',async({page})=>{
  await ready(page);await startBattle(page);await finishWave(page);
  await page.evaluate(async()=>{
    const path='/src/data/battle-experience.ts';const {battleXpAt}=await import(path);const s=window.__game.state()!;s.xp=battleXpAt(6);s.choicesEarned=5;s.draft!.pointTarget=5;
    for(const nodeId of ['C01-A4/0','C01-A4/1','C01-A4/2','C01-A4/3'])window.__game.command({type:'buy-node',offerId:s.draft!.id,nodeId});
  });
  const ultimate=page.locator('[data-action=deep-node][data-id="C01-A4/4"]');await ultimate.focus();await ultimate.press('Enter');
  await expect(page.locator('.skill-description-dialog')).toContainText('剩餘點數不足');await expect(page.locator('[data-action=buy-node]')).toBeDisabled();
  expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(4);
});

test('archive retains outfit switching and all nodes without branch tabs', async ({page}) => {
  await ready(page); await page.evaluate(()=>window.__game.route('codex'));
  await page.getByRole('button',{name:'技能樹與節點',exact:true}).click();
  await expect(page.locator('.personnel-skill-tabs,[data-action=personnel-skill-tab]')).toHaveCount(0);
  await expect(page.locator('.personnel-skills-dialog .deep-node')).toHaveCount(24);
  await page.getByRole('button',{name:'夏日換裝',exact:true}).click();
  await expect(page.getByRole('button',{name:'夏日換裝',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.personnel-skills-dialog .deep-node')).toHaveCount(24);
});

test('new players start muted and their chosen volume survives reload', async ({page}) => {
  await ready(page);
  expect(await page.evaluate(()=>(window.__game as typeof window.__game & {audio():{musicVolume:number;sfxVolume:number}}).audio())).toMatchObject({musicVolume:0,sfxVolume:0});
  await page.getByRole('button',{name:'設定',exact:true}).click();
  await page.getByRole('button',{name:'音量與設定說明',exact:true}).click();
  await page.getByRole('slider',{name:'音樂音量',exact:true}).press('ArrowRight');
  expect(await page.evaluate(()=>(window.__game as typeof window.__game & {audio():{musicVolume:number;sfxVolume:number}}).audio())).toMatchObject({musicVolume:0.05,sfxVolume:0});
  await page.evaluate(()=>window.__game.save());await page.reload();await page.waitForFunction(()=>!!window.__game);
  expect(await page.evaluate(()=>(window.__game as typeof window.__game & {audio():{musicVolume:number;sfxVolume:number}}).audio())).toMatchObject({musicVolume:0.05,sfxVolume:0});
});

test('dark skill map and compact popup render current effects and an acquired prerequisite', async ({page}, info) => {
  await page.setViewportSize({width:390,height:844});await ready(page);await startBattle(page);await finishWave(page);
  // Deterministic visual fixture: wave 5, four available points, acquired entry.
  await page.evaluate(async()=>{
    const path='/src/data/battle-experience.ts';const {battleXpAt}=await import(path);const s=window.__game.state()!;
    s.waveFlow!.wave=5;s.xp=battleXpAt(6);s.choicesEarned=5;s.choicesSpent=1;s.treeNodes=['C01-A4/0'];s.draft!.pointTarget=5;s.draft!.pendingNodeIds=[];
    window.__game.ticks(0);
  });
  await page.locator('[data-action=deep-owner][data-id=C01]').click();
  await page.locator('[data-action=deep-node][data-id="C01-A4/1"]').click();
  await expect(page.locator('.skill-description-dialog')).toContainText('分流槍機 ✓ 已取得');
  await expect(page.locator('.allocation-budget')).toHaveCount(0);
  await expect(page.locator('.points-left')).toContainText('可用 4 點');
  await page.screenshot({path:info.outputPath('skill-popup-390.png')});
  await page.getByRole('button',{name:'關閉',exact:true}).click();
  await page.screenshot({path:info.outputPath('skill-map-390.png')});
});


test('the current skill cost stays in the header and the ultimate has a distinct frame',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await ready(page);await startBattle(page);await finishWave(page);
  await page.evaluate(async()=>{
    const path='/src/data/battle-experience.ts';const {battleXpAt}=await import(path);const s=window.__game.state()!;
    s.waveFlow!.wave=5;s.xp=battleXpAt(9);s.choicesEarned=8;s.choicesSpent=4;s.treeNodes=['C01-A4/0','C01-A4/1','C01-A4/2','C01-A4/3'];s.draft!.pointTarget=8;s.draft!.pendingNodeIds=['C01-A4/4'];window.__game.ticks(0);
  });
  await expect(page.locator('.points-left small')).toHaveText('已選 2 · 保留 2');
  const nodes=await page.locator('.skill-network .deep-node').evaluateAll(elements=>elements.map(el=>({x:Number((el as HTMLElement).dataset.x),y:Number((el as HTMLElement).dataset.y),size:(el as HTMLElement).offsetWidth})));
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)expect(Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y)-(nodes[i].size+nodes[j].size)/2).toBeGreaterThan(20);
  await page.screenshot({path:info.outputPath('header-count-390.png')});
  const ultimate=page.locator('.deep-node.ultimate');await ultimate.focus();await ultimate.press('Enter');await page.getByRole('button',{name:'關閉',exact:true}).click();
  await expect(ultimate).toHaveCSS('border-radius','18px');await expect(ultimate.locator('.node-symbol')).toHaveCSS('width','42px');
  expect(await ultimate.evaluate(el=>getComputedStyle(el,'::before').content)).toBe('"終極技"');
  await page.screenshot({path:info.outputPath('ultimate-390.png')});
});
