import {test,expect} from '@playwright/test';
import {ready,reachable,fitsScreen} from '../helpers/mobile-ui';
for(const viewport of [{width:320,height:500},{width:390,height:844},{width:1440,height:900}])for(const safeBottom of [0,34])test.describe(`hundred-only dock ${viewport.width} safe ${safeBottom}`,()=>{
 test.use({viewport,isMobile:viewport.width<800,hasTouch:viewport.width<800});
 test('challenge dock opens hundred directly and keeps return navigation correct',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
  if(safeBottom)await page.evaluate(bottom=>{const styles=[...document.querySelectorAll('style')].map(e=>e.textContent??'').filter(s=>s.includes('env(safe-area-inset-bottom)'));const sheet=document.createElement('style');sheet.textContent=styles.join('\n').replaceAll('env(safe-area-inset-bottom)',`${bottom}px`);document.head.append(sheet);},safeBottom);
  const dock=page.locator('.game-dock');await expect(dock.locator('button')).toHaveCount(4);await expect(dock.locator('.game-nav-label')).toHaveText(['作戰','百波挑戰','編隊','招募']);await expect(page.locator('.difficulty-options button')).toHaveCount(3);
  await expect(page.locator('.mission-challenge-entries,.campaign-challenge-entry,[data-action=challenge]')).toHaveCount(0);await expect(page.locator('.difficulty-options [data-id=challenges]')).toBeDisabled();for(const button of await dock.locator('button').all())await reachable(button);await fitsScreen(page);
  await page.screenshot({path:info.outputPath(`hundred-only-home-${viewport.width}-safe-${safeBottom}.png`)});
  await dock.locator('[data-action=hundred]').click();await expect(page.locator('#app')).toHaveAttribute('data-page','hundred');await expect(dock.locator('[data-action=hundred]')).toHaveAttribute('aria-current','page');await expect(page.locator('.hundred-screen h1')).toHaveText('百波挑戰');await expect(page.locator('.challenge-screen,.campaign-challenge-entry,[data-action=challenge]')).toHaveCount(0);await expect(page.locator('.hundred-screen')).not.toContainText('關卡挑戰');await expect(page.locator('.hundred-rules')).toContainText('40 經驗');await fitsScreen(page);await reachable(page.locator('[data-action=start-hundred]'));
  await page.screenshot({path:info.outputPath(`hundred-only-page-${viewport.width}-safe-${safeBottom}.png`)});
  await page.locator('.hundred-screen [data-action=home]').click();await expect(page.locator('.mission-lobby')).toBeVisible();await expect(dock.locator('[data-action=home]')).toHaveAttribute('aria-current','page');
  for(const action of ['roster','recruitment','hundred','home','hundred']){await dock.locator(`[data-action=${action}]`).click();await expect(page.locator('#app')).toHaveAttribute('data-page',action);await expect(dock.locator(`[data-action=${action}]`)).toHaveAttribute('aria-current','page');}
  await page.locator('[data-action=start-hundred]').click();await page.locator('#battle-loading').waitFor({state:'detached'});expect(await page.evaluate(()=>({mode:window.__game.state()!.config.mode,challenge:window.__game.state()!.config.challengeId,version:window.__game.state()!.experienceVersion}))).toEqual({mode:'hundred',challenge:undefined,version:4});expect(errors).toEqual([]);
 });
});
test('regular missions retain their own curve and original permanent balances',async({page})=>{
 await ready(page);const before=await page.evaluate(()=>({collection:structuredClone(window.__game.getSave().collection),profile:structuredClone(window.__game.getSave().profile)}));await page.locator('[data-action=start]').click();await page.locator('#battle-loading').waitFor({state:'detached'});
 const after=await page.evaluate(async()=>{const e='/src/sim/experience.ts';const {battleExperience}=await import(e);return {state:window.__game.state(),required:battleExperience(window.__game.state()!).required,collection:window.__game.getSave().collection,profile:window.__game.getSave().profile};});
 expect(after.state!.config.mode).not.toBe('hundred');expect(after.state!.experienceVersion).toBe(4);expect(after.required).toBe(30);expect(after.collection).toEqual(before.collection);expect(after.profile.commander).toEqual(before.profile.commander);
});


test('original upper campaign challenge keeps its position and battle restriction',async({page})=>{
 await ready(page);await page.evaluate(()=>{const save=window.__game.getSave();save.profile.cleared=['S01'];save.profile.easyCleared=['S01'];save.profile.hardCleared=['S01'];window.__game.route('home');});
 const top=page.locator('.difficulty-options [data-action=command-panel][data-id=challenges]');await reachable(top);await top.click();await page.locator('[data-action=challenge][data-id=no-skill]').click();await page.locator('.command-dialog [data-action=command-close]').first().click();await expect(top).toHaveAttribute('aria-pressed','true');await expect(page.locator('.mission-start')).toContainText('禁止取得終極技');
 await page.locator('.game-dock [data-action=hundred]').click();await expect(page.locator('.hundred-screen')).not.toContainText('關卡挑戰');await page.locator('.hundred-screen [data-action=home]').click();await expect(top).toHaveAttribute('aria-pressed','false');await expect(page.locator('[data-action=difficulty][data-id=hard]')).toHaveAttribute('aria-pressed','true');
 await top.click();await page.locator('[data-action=challenge][data-id=no-skill]').click();await page.locator('.command-dialog [data-action=start]').click();await page.locator('#battle-loading').waitFor({state:'detached'});expect(await page.evaluate(()=>({mode:window.__game.state()!.config.mode,challenge:window.__game.state()!.config.challengeId,difficulty:window.__game.state()!.config.difficulty,version:window.__game.state()!.experienceVersion}))).toEqual({mode:undefined,challenge:'no-skill',difficulty:'hard',version:4});
});
