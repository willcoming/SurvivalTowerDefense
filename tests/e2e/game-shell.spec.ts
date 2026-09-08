import { expect, test, type Page } from '@playwright/test';

async function load(page: Page) {
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game);
}
async function start(page: Page) {
  await page.locator('.deploy-button').click();
  await page.locator('#battle-loading').waitFor({state:'detached'});
  await page.locator('[data-action="tutorial-done"]').first().click();
}
async function panel(page: Page, id: string, desktop = false) {
  if (desktop) await page.locator(`.command-rail [data-id="${id}"]`).click();
  else {
    await page.getByRole('button', {name:'開啟快捷選單'}).click();
    await page.locator(`.command-menu-grid [data-id="${id}"]`).click();
  }
}

for (const viewport of [{width:320,height:500},{width:390,height:844},{width:1440,height:900}]) {
  test.describe(`game stage ${viewport.width}`, () => {
    test.use({viewport,isMobile:viewport.width<800,hasTouch:viewport.width<800});
    test('all destinations share a bounded stage, HUD and visible icon navigation', async ({page}, info) => {
      const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
      await load(page);
      const app=await page.locator('#app').boundingBox();
      expect(app!.width).toBe(Math.min(viewport.width,600));
      expect(app!.x).toBe((viewport.width-app!.width)/2);
      const deploy=await page.locator('.deploy-button').boundingBox();
      const dock=await page.locator('.game-dock').boundingBox();
      expect(deploy!.y+deploy!.height).toBeLessThanOrEqual(dock!.y);
      await expect(page.locator('.command-rail-left')).not.toBeVisible();
      await expect(page.locator('.mission-tools,.mission-kicker')).toHaveCount(0);
      await expect(page.getByRole('button',{name:'開啟快捷選單'})).not.toBeVisible();
      await expect(page.getByRole('button',{name:'作戰功能與說明'})).toBeVisible();
      await expect(page.locator('.difficulty-options button')).toHaveCount(3);
      await expect(page.locator('.hud-resources')).toHaveCount(0);
      await expect(page.locator('.mission-tools-right,.mission-rewards,.stage-picker-mount')).toHaveCount(0);
      for(const dest of ['roster','recruitment','home']) {
        await page.locator(`.game-dock [data-action="${dest}"]`).click();
        await expect(page.locator('#app')).toHaveAttribute('data-page',dest);
        await expect(page.locator('.game-dock .active')).toHaveAttribute('data-action',dest);
        await expect(page.locator('.game-dock .game-nav-icon:visible')).toHaveCount(3);
        await expect(page.locator('.game-dock .game-nav-label')).toHaveText(['作戰','編隊','招募']);
        await expect(page.locator('.game-hud')).toBeVisible();
        await expect(page.locator('.game-hud [data-action="command-panel"]')).toHaveCount(0);
        await expect(page.locator('.hud-resources')).toHaveCount(dest==='recruitment'?1:0);
        await expect(page.locator('.game-hud')).not.toContainText('戰區進度');
        expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height+1);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(viewport.width);
        const geometry=await page.locator('#app > main').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
        expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);
        const nav=await page.locator('.game-dock').boundingBox();
        expect(nav!.y+nav!.height).toBeLessThanOrEqual(viewport.height+1);
      }
      await page.screenshot({path:info.outputPath(`home-${viewport.width}.png`)});
      expect(errors).toEqual([]);
    });
  });
}

for(const desktop of [false,true]) {
  test.describe(desktop?'desktop command rails':'mobile command menu',()=>{
    test.use({viewport:desktop?{width:1440,height:900}:{width:390,height:844},isMobile:!desktop,hasTouch:!desktop});
    test('panels use live data, resume battle and protect navigation',async({page})=>{
      await load(page);await start(page);
      await expect(page.locator('.game-hud')).not.toBeVisible();
      await expect(page.locator('.game-dock')).not.toBeVisible();
      for(const id of ['intel','waves','squad']) {
        await panel(page,id,desktop);
        await expect(page.locator('.command-dialog')).toBeVisible();
        expect(await page.evaluate(()=>window.__game.state()!.phase)).toBe('paused');
        const tick=await page.evaluate(()=>window.__game.state()!.tick);
        await page.evaluate(()=>window.__game.ticks(30));
        expect(await page.evaluate(()=>window.__game.state()!.tick)).toBe(tick);
        await page.keyboard.press('Escape');
        expect(await page.evaluate(()=>window.__game.state()!.phase)).toBe('running');
      }
      await panel(page,'auto',desktop);
      await page.locator('[data-action="command-auto"]').click();
      await expect(page.locator('[data-action="command-auto"]')).toHaveAttribute('aria-pressed','true');
      await page.keyboard.press('Escape');
      await expect(page.locator('#auto-tactical-button')).toHaveAttribute('aria-pressed','true');
      await panel(page,'weapons',desktop);
      await expect(page.locator('.command-weapons button')).toHaveCount(5);
      await page.locator('.command-weapons [data-id="C01"]').click();
      await expect(page.locator('.command-dialog')).toHaveCount(0);
      await expect(page.locator('#range-info')).toContainText('璃音');
      expect(await page.evaluate(()=>window.__game.state()!.phase)).toBe('running');
      await panel(page,'skills',desktop);
      await expect(page.locator('.tactical-tree')).toBeVisible();
      await page.keyboard.press('Escape');
      expect(await page.evaluate(()=>window.__game.state()!.phase)).toBe('running');
      await panel(page,'squad',desktop);
      await page.locator('.command-dialog [data-action="roster"]').click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.locator('[data-action="navigation-cancel"]').click();
      await expect(page.locator('.command-dialog')).toBeVisible();
      expect(await page.evaluate(()=>window.__game.state()!.phase)).toBe('paused');
      await page.keyboard.press('Escape');
      expect(await page.evaluate(()=>window.__game.state()!.phase)).toBe('running');
      await panel(page,'pause',desktop);
      await expect(page.locator('.pause-dialog')).toBeVisible();
      await page.locator('[data-action="resume"]').click();
      await panel(page,'squad',desktop);
      await page.locator('.command-dialog [data-action="roster"]').click();
      await page.locator('[data-action="navigation-confirm"]').click();
      await expect(page.locator('#app')).toHaveAttribute('data-page','roster');
      await expect(page.locator('.game-hud')).toBeVisible();
      await expect(page.locator('.game-dock')).toBeVisible();
      expect(await page.evaluate(()=>window.__game.getSave().profile.recentRuns[0].outcome)).toBe('abandoned');
      await expect(page.locator('.command-dialog')).toHaveCount(0);
    });
  });
}

test('commander name persists and recruitment notification reflects saved resources',async({page})=>{
  await load(page);
  await page.locator('.hud-controls [data-action="settings"]').click();
  await page.getByLabel('指揮官名稱').fill('晨星');
  await page.getByLabel('指揮官名稱').press('Tab');
  await expect(page.locator('.commander-profile strong')).toHaveText('晨星');
  await page.evaluate(()=>window.__game.save());await page.reload();
  await page.waitForFunction(()=>!!window.__game);
  await expect(page.locator('.commander-profile strong')).toHaveText('晨星');
  await expect(page.locator('.nav-notification')).toHaveCount(0);
  await page.evaluate(()=>{const s=window.__game.getSave();s.collection.tickets=2;s.profile.cleared=['S01'];s.profile.commander!.xp=100;window.__game.route('home');});
  await expect(page.locator('[data-hud="tickets"]')).toHaveCount(0);
  await expect(page.locator('.commander-profile > b')).toHaveText('Lv.2');
  await expect(page.locator('.game-dock [data-action="stories"],.game-dock [data-action="codex"]')).toHaveCount(0);
  await expect(page.locator('.game-dock [data-action="recruitment"] .nav-notification')).toHaveCount(1);
  await page.locator('.game-dock [data-action="recruitment"]').click();
  await expect(page.locator('[data-hud="tickets"]')).toHaveText('2');
});
