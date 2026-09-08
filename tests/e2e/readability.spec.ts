import { test,expect } from '@playwright/test';

for(const viewport of [{width:320,height:500},{width:390,height:844},{width:600,height:1300},{width:1440,height:900}]){
  test.describe(`${viewport.width} readable layout`,()=>{
    test.use({viewport,isMobile:viewport.width<800,hasTouch:viewport.width<800});
    test('home stays in one screen and information pages retain large, scrollable copy',async({page})=>{
      const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
      const columns=viewport.width>=560?3:2;
      await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);
      const stage=await page.locator('.mission-theater').boundingBox(),difficulty=await page.locator('.mission-difficulty').boundingBox(),rewards=await page.locator('.durability-rewards').boundingBox(),start=await page.locator('.mission-start').boundingBox(),dock=await page.locator('.game-dock').boundingBox();
      expect(difficulty!.y+difficulty!.height).toBeLessThanOrEqual(stage!.y);
      expect(stage!.y+stage!.height).toBeLessThanOrEqual(rewards!.y);
      expect(start!.y+start!.height).toBeLessThanOrEqual(dock!.y);
      const launch=await page.locator('.mission-launch').boundingBox();
      expect(Math.abs((rewards!.y+start!.y+start!.height)/2-(launch!.y+launch!.height/2))).toBeLessThanOrEqual(1);
      expect(Math.abs((start!.x+start!.width/2)-(launch!.x+launch!.width/2))).toBeLessThanOrEqual(1);
      await page.getByRole('button',{name:'作戰功能與說明'}).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const title=page.getByRole('heading',{name:'戰術指揮台',exact:true});
      for(const tab of ['情報','波次','敵情']){
        await page.getByRole('tab',{name:tab,exact:true}).click();
        const content=page.getByRole('tabpanel');
        const bounds=await content.boundingBox();expect(bounds!.height).toBeGreaterThan(120);
        expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(dock!.y);
        await content.evaluate(e=>{e.scrollTop=e.scrollHeight;});
        await expect(title).toBeInViewport();await expect(page.getByRole('tab',{name:tab,exact:true})).toBeInViewport();
        const body=content.locator(tab==='波次'?'.tactical-wave-units':'p').first();
        expect(await body.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
        expect(await content.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
        if(tab==='敵情') expect(await page.locator('.tactical-enemy-list').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(columns);
      }
      await page.evaluate(()=>window.__game.route('codex'));
      await expect(page.locator('.codex-screen .dossier')).toHaveCSS('grid-template-columns',/^[\d.]+px$/);
      await page.locator('.game-dock [data-action="roster"]').click();await page.locator('[data-action="roster-edit"]').click();
      const cards=await page.locator('.roster-tile').evaluateAll(items=>items.map(item=>{const r=item.getBoundingClientRect(),art=item.querySelector('.roster-tile-art')!.getBoundingClientRect(),name=item.querySelector('strong')!.getBoundingClientRect(),forms=item.querySelector('.roster-tile-forms')!.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,artBottom:art.bottom,nameTop:name.top,formsBottom:forms.bottom};}));
      expect(await page.locator('.roster-overview').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(columns);
      for(const [i,card] of cards.entries()){
        expect(card.height).toBeGreaterThanOrEqual(220);
        expect(card.nameTop).toBeGreaterThanOrEqual(card.artBottom);
        expect(card.formsBottom).toBeLessThanOrEqual(card.bottom);
        if(i%columns){expect(Math.abs(card.top-cards[i-1].top)).toBeLessThan(1);expect(card.left-cards[i-1].right).toBeGreaterThanOrEqual(11);}
        if(i>=columns)expect(card.top-cards[i-columns].bottom).toBeGreaterThanOrEqual(11);
      }
      await page.locator('#roster-card-C08').click();
      await expect(page.locator('.roster-dialog')).toContainText('熾夏');
      await page.locator('[data-action="roster-close"]').click();
      await page.locator('.game-dock [data-action="recruitment"]').click();
      await expect(page.locator('.recruit-v2-tabs button')).toHaveText(['招募','兌換']);
      expect(await page.locator('.recruit-card-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(columns);
      expect(await page.locator('.recruit-item-copy p').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
      await page.locator('[data-action="recruit-tab"][data-id="exchange"]').click();
      expect(await page.locator('.recruit-card-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(columns);
      await page.locator('.recruit-item').last().scrollIntoViewIfNeeded();
      await expect(page.locator('.recruit-item').last()).toBeInViewport();
      expect(await page.locator('.recruit-v2-catalog').evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(viewport.width);
      expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height+1);
      expect(errors).toEqual([]);
    });
  });
}
