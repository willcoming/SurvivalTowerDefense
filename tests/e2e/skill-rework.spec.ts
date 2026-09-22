import {test,expect} from '@playwright/test';
test('summer preview replaces skills without changing the equipped collection',async({page},info)=>{
 await page.goto('/');await page.waitForFunction(()=>!!window.__game);await page.evaluate(()=>window.__game.route('codex'));
 const before=await page.evaluate(()=>structuredClone(window.__game.getSave().collection));
 await page.getByRole('button',{name:'技能樹與節點',exact:true}).click();
 await expect(page.locator('.personnel-skills-dialog .ultimate')).toHaveCount(1);
 await page.locator('[data-action="personnel-skill-form"][data-id="C01-summer"]').click();
 await page.locator('[data-action="personnel-skill-node"][data-id="C01-A3/2"]').focus();await page.locator('[data-action="personnel-skill-node"][data-id="C01-A3/2"]').click();
 await expect(page.locator('.personnel-skill-detail')).toContainText('餘熱彈道');
 await page.locator('[data-action="personnel-skill-node"][data-id="C01-A3/4"]').focus();await page.locator('[data-action="personnel-skill-node"][data-id="C01-A3/4"]').click();
 await expect(page.locator('.personnel-skill-detail')).toContainText('熔浪覆蓋');
 await page.screenshot({path:info.outputPath('summer-skill-tree.png')});
 expect(await page.evaluate(()=>window.__game.getSave().collection)).toEqual(before);
});
test('battle exposes individual automatic cooldowns and prunes dependent pending nodes',async({page},info)=>{
 await page.goto('/');await page.waitForFunction(()=>!!window.__game);await page.locator('[data-action="start"]').click();await page.locator('#battle-loading').waitFor({state:'detached'});await page.locator('[data-action="tutorial-done"]').first().click();
 await expect(page.locator('[data-action="cast"],[data-action="auto-tactical"]')).toHaveCount(0);
 await expect(page.locator('.ultimate-strip')).toBeVisible();
 await page.evaluate(()=>{const s=window.__game.state()!;s.xp=60;s.choicesEarned=2;window.__game.ticks(1);});
 await page.locator('[data-action="deep-owner"][data-id="C01"]').click();
 for(const id of ['C01-A3/0','C01-A3/1','C01-A3/0']){await page.locator(`[data-action="deep-node"][data-id="${id}"]`).focus();await page.locator(`[data-action="deep-node"][data-id="${id}"]`).click();}
 expect(await page.evaluate(()=>window.__game.state()!.draft!.pendingNodeIds)).toEqual([]);
 await page.evaluate(()=>{const s=window.__game.state()!;s.xp=180;s.choicesEarned=6;for(const nodeId of ['C01-A3/0','C01-A3/1','C01-A3/2','C01-A3/3','C01-A3/4'])window.__game.command({type:'buy-node',offerId:s.draft!.id,nodeId});});
 await expect(page.locator('.tactical-tree')).toHaveCount(0);await expect(page.locator('#ultimate-C01')).toHaveText(/\d+s/);await expect(page.locator('#ultimate-C02')).toHaveText('未取得');
 await page.screenshot({path:info.outputPath('automatic-ultimates.png')});
});
