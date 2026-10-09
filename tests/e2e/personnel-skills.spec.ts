import {test,expect} from '@playwright/test';
import {deepTreesFor} from '../../src/data/deep-trees';
import {CHARACTER_MAP} from '../../src/data/content';

for(const viewport of [{width:320,height:500},{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900}]){
  test.describe(`personnel viewport ${viewport.width}`,()=>{
  test.use({isMobile:viewport.width<=800,hasTouch:viewport.width<=800});
  test(`personnel opens the complete owner skill network at ${viewport.width}`,async({page},info)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setViewportSize(viewport);await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
    await page.locator('.game-dock [data-action="roster"]').click();

    const before=await page.evaluate(()=>structuredClone(window.__game.getSave()));
    for(const owner of ['C06','C08'] as const){
      const picker=page.getByRole('combobox',{name:'隊員',exact:true});
      if(await picker.count()) {
        for(const option of await picker.locator('option').all()) {
          await picker.selectOption((await option.getAttribute('value'))!);
          if(await page.locator(`.formation-member[data-id="${owner}"]`).isVisible()) break;
        }
      }
      await page.locator(`.formation-member[data-id="${owner}"]`).click();
      await page.locator(`[data-action="roster-open"][data-id="${owner}"]`).click();
      const details=page.getByRole('dialog',{name:`${CHARACTER_MAP[owner].name}・隊員詳情`,exact:true});
      const b=(await details.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x+b.width).toBeLessThanOrEqual(viewport.width+1);expect(b.y+b.height).toBeLessThanOrEqual(viewport.height+1);
      const trigger=page.locator(`[data-action="personnel-skills"][data-id="${owner}"]`);await trigger.scrollIntoViewIfNeeded();
      const parentScroll=await page.locator('.roster-panel-body').evaluate(e=>e.scrollTop);
      if(owner==='C06')await page.screenshot({path:info.outputPath(`personnel-${viewport.width}.png`)});
      await trigger.focus();await page.keyboard.press('Enter');
      const modal=page.getByRole('dialog',{name:`${CHARACTER_MAP[owner].name}・技能樹`,exact:true});await expect(modal).toBeVisible();
      await expect(page.locator('#app')).toHaveAttribute('data-page','roster');
      await expect(page.getByRole('dialog')).toHaveCount(1);await expect(modal.locator('.tree-characters,.common-codex')).toHaveCount(0);
      await expect(modal.getByRole('tab')).toHaveCount(0);
      let selectedId='';
      for(const tree of deepTreesFor(owner)){
        await expect(modal.locator('[data-action="personnel-skill-node"]')).toHaveCount(deepTreesFor(owner).flatMap(t=>t.nodes).length);
        const last=tree.nodes.at(-1)!;selectedId=last.id;await page.keyboard.press('Tab');await modal.locator(`[data-action="personnel-skill-node"][data-id="${last.id}"]`).focus();await modal.locator(`[data-action="personnel-skill-node"][data-id="${last.id}"]`).click();
        await expect(modal.locator('.personnel-skill-detail')).toContainText(last.description);
      }
      expect(await modal.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
      const close=page.getByRole('button',{name:'關閉技能樹',exact:true});await expect(close).toBeInViewport();
      if(owner==='C06')await page.screenshot({path:info.outputPath(`personnel-skills-${viewport.width}.png`)});
      await close.focus();await page.keyboard.press('Shift+Tab');expect(await modal.evaluate(e=>e.contains(document.activeElement))).toBe(true);
      await page.keyboard.press('Escape');await expect(modal).toBeVisible();await expect(modal.locator('.skill-bottom-sheet')).toHaveAttribute('data-open','false');
      await expect(modal.locator(`[data-action="personnel-skill-node"][data-id="${selectedId}"]`)).toBeFocused();
      await page.keyboard.press('Escape');await expect(details).toBeVisible();await expect(trigger).toBeFocused();
      expect(await page.locator('.roster-panel-body').evaluate(e=>e.scrollTop)).toBe(parentScroll);
      await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    expect(await page.evaluate(()=>window.__game.getSave())).toEqual(before);expect(errors).toEqual([]);
  });
  });
}
test('codex skill button opens the same complete owner-only dialog',async({page})=>{
  await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  await page.evaluate(()=>window.__game.route('codex'));await page.getByRole('combobox',{name:'圖鑑角色',exact:true}).selectOption('C06');
  const trigger=page.getByRole('button',{name:'技能樹與節點',exact:true});await trigger.click();
  await expect(page.getByRole('dialog',{name:'希雅・技能樹',exact:true})).toBeVisible();await expect(page.getByRole('tab')).toHaveCount(0);await expect(page.locator('[data-action=personnel-skill-node]')).toHaveCount(24);
  await page.getByRole('button',{name:'關閉技能樹',exact:true}).click();await expect(trigger).toBeFocused();
  await expect(page.locator('#app')).toHaveAttribute('data-page','codex');
});
