import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`ultimate shortcut reveals two independent entrances without spending points at ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:width===390?844:1000});await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
 await page.evaluate(()=>window.__game.route('codex'));await page.getByRole('button',{name:'技能樹與節點',exact:true}).click();
 const before=await page.evaluate(()=>JSON.stringify(window.__game.getSave()));
 await page.getByRole('button',{name:'定位終極技',exact:true}).click();const ult=page.locator('.constellation-node.ultimate');await expect(ult).toBeInViewport();await expect(ult).toBeFocused();
 await expect(page.locator('.network-edges .focus-direct')).toHaveCount(2);await expect(page.locator('.path-parent')).toHaveCount(2);
 await ult.press('Enter');await expect(page.locator('.personnel-skill-detail')).toContainText('或');await expect(page.locator('.personnel-skill-detail')).toContainText('此角色先投入 4 點');
 await page.locator('[data-action="personnel-skill-form"][data-id="C01-summer"]').click();await expect(page.locator('.personnel-skill-detail')).toContainText('熔浪覆蓋');await expect(ult).toBeInViewport();
 expect(await page.evaluate(()=>JSON.stringify(window.__game.getSave()))).toBe(before);
 await page.screenshot({path:info.outputPath(`dual-ultimate-${width}.png`)});
});
