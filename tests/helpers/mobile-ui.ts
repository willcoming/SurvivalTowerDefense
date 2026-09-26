import { expect, type Locator, type Page } from '@playwright/test';
export const phoneSizes = [{width:320,height:500},{width:375,height:548},{width:320,height:640},{width:375,height:667},{width:390,height:844},{width:430,height:932}];
export async function ready(page: Page) {
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.goto('/');
  await page.waitForFunction(() => !!window.__game);
}
export async function fitsScreen(page: Page) {
  expect(await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('main, section.content-screen')!;
    return { document: document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1,
      main: main.scrollHeight <= main.clientHeight + 1 };
  })).toEqual({document:true,main:true});
}
/** Check before click(), whose automatic scrolling can hide real touch occlusion. */
export async function reachable(control: Locator) {
  await expect(control).toBeVisible();
  await expect.poll(() => control.evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = [r.top+2, r.top+r.height/2, r.bottom-2].every(y => el.contains(document.elementFromPoint(r.left+r.width/2,y)));
    return r.width >= 43.9 && r.height >= 43.9 && r.top >= -1 && r.left >= -1 && r.right <= innerWidth+1 && r.bottom <= innerHeight+1 && hit;
  }), {message:(await control.textContent()) ?? '',timeout:3000}).toBe(true);
}
export async function finishWave(page: Page) {
  await page.evaluate(async () => {
    const combat='/src/sim/combat.ts', engine='/src/sim/engine.ts';
    const {hitEnemy}=await import(combat),{stepRun}=await import(engine);
    const run=window.__game.state()!;
    for(let i=0;i<10000&&!run.draft&&!run.outcome;i++) {
      for(const enemy of run.enemies) if(enemy.hp>0) hitEnemy(run,enemy,{source:'C01',skill:'layout-test',raw:1e9,damageType:'plasma',armorIgnore:1,shieldMultiplier:1});
      stepRun(run);
    }
    window.__game.ticks(0);
  });
  await expect(page.locator('.wave-allocation')).toBeVisible();
}
export async function startBattle(page: Page) {
  await page.locator('[data-action=start]').click();
  await page.locator('#battle-loading').waitFor({state:'detached'});
  await page.locator('[data-action=tutorial-done]').first().click();
}
