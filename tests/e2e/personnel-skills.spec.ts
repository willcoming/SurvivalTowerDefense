import {test,expect} from '@playwright/test';
import {deepTreesFor} from '../../src/data/deep-trees';
import {CHARACTER_MAP} from '../../src/data/content';

for(const viewport of [{width:320,height:500},{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900}]){
  test(`full-screen personnel opens only their skill branches at ${viewport.width}`,async({page},info)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setViewportSize(viewport);await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
    await page.locator('.game-dock [data-action="roster"]').click();
    await page.locator('[data-action="roster-edit"]').click();
    const before=await page.evaluate(()=>structuredClone(window.__game.getSave()));
    for(const owner of ['C06','C08'] as const){
      await page.locator(`[data-action="roster-open"][data-id="${owner}"]`).first().click();
      const details=page.getByRole('dialog',{name:`${CHARACTER_MAP[owner].name}・隊員詳情`,exact:true});
      const b=await details.boundingBox();expect(b!.x).toBe(0);expect(b!.y).toBe(0);expect(Math.abs(b!.width-viewport.width)).toBeLessThan(1);expect(Math.abs(b!.height-viewport.height)).toBeLessThan(1);
      const trigger=page.locator(`[data-action="personnel-skills"][data-id="${owner}"]`);await trigger.scrollIntoViewIfNeeded();
      const parentScroll=await page.locator('.roster-panel-body').evaluate(e=>e.scrollTop);
      if(owner==='C06')await page.screenshot({path:info.outputPath(`personnel-${viewport.width}.png`)});
      await trigger.focus();await page.keyboard.press('Enter');
      const modal=page.getByRole('dialog',{name:`${CHARACTER_MAP[owner].name}・技能樹`,exact:true});await expect(modal).toBeVisible();
      await expect(page.locator('#app')).toHaveAttribute('data-page','roster');
      await expect(page.getByRole('dialog')).toHaveCount(1);await expect(modal.locator('select,.tree-characters,.common-codex')).toHaveCount(0);
      await expect(modal.getByRole('tab')).toHaveText(deepTreesFor(owner).map(t=>t.name));
      for(const tree of deepTreesFor(owner)){
        await modal.getByRole('tab',{name:tree.name,exact:true}).click();
        await expect(modal.locator('[data-action="personnel-skill-node"]')).toHaveCount(tree.nodes.length);
        expect(await modal.locator('[data-action="personnel-skill-node"]').evaluateAll(es=>es.map(e=>(e as HTMLElement).dataset.id))).toEqual(tree.nodes.map(n=>n.id));
        const last=tree.nodes.at(-1)!;await modal.locator(`[data-action="personnel-skill-node"][data-id="${last.id}"]`).click();
        await expect(modal.locator('.personnel-skill-detail')).toContainText(last.description);
      }
      const tabs=modal.getByRole('tab');await tabs.last().focus();await page.keyboard.press('Home');await expect(tabs.first()).toHaveAttribute('aria-selected','true');
      await page.keyboard.press('ArrowRight');await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');await expect(tabs.nth(1)).toBeFocused();
      expect(await modal.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
      const close=page.getByRole('button',{name:'關閉技能樹',exact:true});await expect(close).toBeInViewport();
      if(owner==='C06')await page.screenshot({path:info.outputPath(`personnel-skills-${viewport.width}.png`)});
      await close.focus();await page.keyboard.press('Shift+Tab');expect(await modal.evaluate(e=>e.contains(document.activeElement))).toBe(true);
      await page.keyboard.press('Escape');await expect(details).toBeVisible();await expect(trigger).toBeFocused();
      expect(await page.locator('.roster-panel-body').evaluate(e=>e.scrollTop)).toBe(parentScroll);
      await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    expect(await page.evaluate(()=>window.__game.getSave())).toEqual(before);expect(errors).toEqual([]);
  });
}
test('codex skill button opens the same owner-only tabbed dialog',async({page})=>{
  await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  await page.evaluate(()=>window.__game.route('codex'));await page.locator('.character-tabs [data-id="C06"]').click();
  const trigger=page.getByRole('button',{name:'技能樹與節點',exact:true});await trigger.click();
  await expect(page.getByRole('dialog',{name:'希雅・技能樹',exact:true})).toBeVisible();await expect(page.getByRole('tab')).toHaveText(deepTreesFor('C06').map(t=>t.name));
  await page.getByRole('button',{name:'關閉技能樹',exact:true}).click();await expect(trigger).toBeFocused();
  await expect(page.locator('#app')).toHaveAttribute('data-page','codex');
});
