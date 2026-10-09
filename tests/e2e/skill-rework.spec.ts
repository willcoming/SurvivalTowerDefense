import {test,expect} from '@playwright/test';
import {finishWave} from '../helpers/mobile-ui';
import {DEEP_NODE_MAP} from '../../src/data/deep-trees';
import {resolveSkillNode} from '../../src/data/reworked-skills';
test('summer preview replaces skills without changing the equipped collection',async({page},info)=>{
 await page.goto('/');await page.waitForFunction(()=>!!window.__game);await page.evaluate(()=>window.__game.route('codex'));
 const before=await page.evaluate(()=>structuredClone(window.__game.getSave().collection));
 await page.getByRole('button',{name:'技能樹與節點',exact:true}).click();
 await expect(page.locator('.personnel-skills-dialog .ultimate')).toHaveCount(1);
 await page.locator('[data-action="personnel-skill-form"][data-id="C01-summer"]').click();
 await page.keyboard.press('Tab');await page.locator('[data-action="personnel-skill-node"][data-id="C01-A4/2"]').focus();await page.locator('[data-action="personnel-skill-node"][data-id="C01-A4/2"]').click();
 // Current tactical nodes specialize the summer variant into conditional bonuses.
 const summerNode=resolveSkillNode(DEEP_NODE_MAP['C01-A4/2'],'C01-summer');
 await expect(page.locator('[data-action="personnel-skill-node"][data-id="C01-A4/2"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.personnel-skill-detail')).toContainText(summerNode.name);
 await expect(page.locator('.personnel-skill-detail .node-effect')).toHaveText(summerNode.description);
 await page.keyboard.press('Tab');await page.locator('[data-action="personnel-skill-node"][data-id="C01-A4/4"]').focus();await page.locator('[data-action="personnel-skill-node"][data-id="C01-A4/4"]').click();
 await expect(page.locator('.personnel-skill-detail')).toContainText('熔浪覆蓋');
 await page.screenshot({path:info.outputPath('summer-skill-tree.png')});
 expect(await page.evaluate(()=>window.__game.getSave().collection)).toEqual(before);
});
test('battle exposes individual automatic cooldowns and requires confirmed prerequisites',async({page},info)=>{
 await page.goto('/');await page.waitForFunction(()=>!!window.__game);await page.locator('[data-action="start"]').click();await page.locator('#battle-loading').waitFor({state:'detached'});await page.locator('[data-action="tutorial-done"]').first().click();
 await expect(page.locator('[data-action="cast"],[data-action="auto-tactical"]')).toHaveCount(0);
 await page.locator('.battle-intel summary').click();
 await expect(page.locator('.ultimate-strip')).toBeVisible();
 await page.locator('.battle-intel summary').click();
 await page.evaluate(()=>{const s=window.__game.state()!;s.xp=60;s.choicesEarned=2;window.__game.ticks(1);});
 await finishWave(page);
 await page.locator('[data-action="deep-owner"][data-id="C01"]').click();
 for(const id of ['C01-A4/0','C01-A4/1']){await page.keyboard.press('Tab');await page.locator(`[data-action="deep-node"][data-id="${id}"]`).focus();await page.locator(`[data-action="deep-node"][data-id="${id}"]`).click();if(id==='C01-A4/1')await expect(page.locator('[data-action=buy-node]')).toBeDisabled();await page.getByRole('button',{name:'關閉',exact:true}).click();}
 expect(await page.evaluate(()=>window.__game.state()!.draft!.pendingNodeIds)).toEqual([]);
 await page.evaluate(async()=>{const path='/src/data/battle-experience.ts';const {battleXpAt}=await import(path);const s=window.__game.state()!;s.xp=battleXpAt(7);s.choicesEarned=6;s.draft!.pointTarget=6;window.__game.command({type:'confirm-node',offerId:s.draft!.id,nodeIds:['C01-A4/0','C01-A4/1','C01-A4/2','C01-A4/3','C01-A4/4']});});
 await expect(page.locator('.tactical-tree')).toHaveCount(0);await expect(page.locator('#ultimate-C01')).toHaveText(/\d+s/);await expect(page.locator('#ultimate-C02')).toHaveText('未取得');
 await page.screenshot({path:info.outputPath('automatic-ultimates.png')});
});
test('all character details show passive captain bonuses and the current skill network',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!window.__game);
 await page.locator('.game-dock [data-action="roster"]').click();

 for(const id of ['C01','C02','C03','C04','C05','C06','C07','C08']){
  const tile=page.locator(`.formation-member[data-id="${id}"]`),picker=page.getByRole('combobox',{name:'隊員',exact:true});
  for(const option of await picker.locator('option').all()){await picker.selectOption((await option.getAttribute('value'))!);if(await tile.isVisible())break;}
  await tile.click();await page.locator(`[data-action="roster-open"][data-id="${id}"]`).click();
  const details=page.getByRole('dialog');
  await expect(details).toContainText('隊長加成');
  await expect(details).toContainText('開場生效 · 不消耗技能點');
  await expect(details).not.toContainText('隊長技能');
  await expect(details.locator('[data-action="personnel-skills"]')).toHaveText('24 節點技能樹 ↗');
  await page.getByRole('button',{name:'關閉隊員詳情',exact:true}).click();
 }
 await page.evaluate(()=>window.__game.route('codex'));
 for(const id of ['C01','C02','C03','C04','C05','C06','C07','C08']){
  const picker=page.getByRole('combobox',{name:'圖鑑角色',exact:true});if(await picker.count())await picker.selectOption(id);else await page.locator(`.character-tabs [data-id="${id}"]`).click();
  await expect(page.locator('.skill-definitions')).toContainText('隊長加成');
  await expect(page.locator('.skill-definitions')).not.toContainText('隊長技能');
 }
});
