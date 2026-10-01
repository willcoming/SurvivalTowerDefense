import {expect,test} from '@playwright/test';
import {ready,startBattle,finishWave,reachable} from '../helpers/mobile-ui';
for(const viewport of [{width:320,height:500},{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900}]){
 test.describe(`refinements ${viewport.width}`,()=>{
 test.use({isMobile:viewport.width<=800,hasTouch:viewport.width<=800});
 test(`readable skills and explicit zero-point continuation ${viewport.width}`,async({page},info)=>{
  await page.setViewportSize(viewport);await ready(page);
  if(viewport.width<=800){
   await page.evaluate(()=>window.__game.route('roster'));await page.locator('[data-action=roster-edit]').click();
   const card=page.locator('.roster-tile').first();
   await expect(card).toBeVisible();
   const ratio=await card.evaluate(el=>el.querySelector('.roster-tile-art')!.getBoundingClientRect().width/el.getBoundingClientRect().width);
   expect(ratio).toBeGreaterThan(.3);
   await page.screenshot({path:info.outputPath(`roster-${viewport.width}.png`)});
   await page.evaluate(()=>window.__game.route('home'));
  }
  await startBattle(page);await finishWave(page);
  await page.evaluate(async()=>{const path='/src/data/battle-experience.ts';const {battleXpAt}=await import(path);const s=window.__game.state()!;s.xp=battleXpAt(2);s.choicesEarned=1;s.choicesSpent=0;s.draft!.pointTarget=1;window.__game.ticks(0);});
  await page.getByRole('button',{name:'技能列表',exact:true}).click();
  const list=page.getByRole('region',{name:'可讀技能列表'});
  await expect(list).toBeVisible();await expect(list.locator('.skill-list-node')).toHaveCount(24);
  const branch=page.getByRole('combobox',{name:'聚焦分支'});
  await branch.selectOption('C01-A4');
  await expect(list.locator('.skill-list-node:visible')).toHaveCount(8);
  const first=list.locator('[data-id="C01-A4/0"]');
  expect(await first.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
  expect(await first.locator('strong').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await reachable(first);await first.click();
  const popup=page.locator('.skill-description-dialog[open]');
  await popup.getByRole('button',{name:'關閉',exact:true}).click();await expect(first).toBeFocused();
  await first.press('Enter');await popup.locator('[data-action=buy-node]').click();
  await expect(page.locator('.points-left')).toContainText('可用 0 點');await expect(list).toBeVisible();
  await expect(branch).toHaveValue('C01-A4');
  const before=await page.evaluate(()=>({tick:window.__game.state()!.tick,wave:window.__game.state()!.waveFlow!.wave}));
  await page.evaluate(()=>window.__game.ticks(90));
  expect(await page.evaluate(()=>window.__game.state()!.tick)).toBe(before.tick);
  await first.click();await expect(popup.locator('[data-action=buy-node]')).toBeDisabled();await page.keyboard.press('Escape');
  await page.locator('[data-action=tree-exit]').click();await page.locator('[data-action=navigation-cancel]').click();await expect(list).toBeVisible();
  await page.screenshot({path:info.outputPath(`skills-zero-${viewport.width}.png`)});
  await page.getByRole('button',{name:'路線圖',exact:true}).click();
  const outside=page.locator('.outside-focused-branch');await expect(outside).toHaveCount(16);
  await page.screenshot({path:info.outputPath(`branch-${viewport.width}.png`)});
  const next=page.getByRole('button',{name:'開始下一波',exact:true});await reachable(next);await next.click();
  expect(await page.evaluate(()=>window.__game.state()!.waveFlow!.wave)).toBe(before.wave+1);
 });
 });
}
test('archive list and branch selection survive closing and reopening',async({page})=>{
 await ready(page);await page.evaluate(()=>window.__game.route('codex'));
 await page.getByRole('button',{name:'技能樹與節點',exact:true}).click();
 await page.getByRole('button',{name:'技能列表',exact:true}).click();await page.getByRole('combobox',{name:'聚焦分支'}).selectOption('C01-A4');
 await page.locator('[data-action=personnel-skills-close]').click();
 await page.getByRole('button',{name:'技能樹與節點',exact:true}).click();
 await expect(page.getByRole('region',{name:'可讀技能列表'})).toBeVisible();await expect(page.getByRole('combobox',{name:'聚焦分支'})).toHaveValue('C01-A4');
});
