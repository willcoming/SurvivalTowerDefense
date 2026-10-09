import {test,expect} from '@playwright/test';
import {ready,reachable,fitsScreen} from '../helpers/mobile-ui';

for (const viewport of [{width:320,height:500},{width:390,height:844},{width:1440,height:900}]) test.describe(`formation workspace ${viewport.width}`,()=>{
  test.use({viewport,isMobile:viewport.width<800,hasTouch:viewport.width<800});
  test('edits members, captain and outfit on one page and confirms atomically',async({page},info)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await ready(page);
    await page.evaluate(async()=>{window.__game.getSave().collection.owned.push('C01-summer');await window.__game.save();window.__game.route('roster');});
    const before=await page.evaluate(()=>structuredClone(window.__game.getSave()));
    await expect(page.locator('.formation-member')).toHaveCount(8);
    await expect(page.locator('.mobile-page-picker,.squad-lobby')).toHaveCount(0);
    await page.locator('#roster-card-C01').click();
    await page.locator('[data-action=toggle-character]').click();
    await page.locator('#roster-card-C03').click();
    await page.locator('[data-action=toggle-character]').click();
    await page.locator('.formation-controls [data-action=captain]').click();
    await page.locator('#roster-card-C01').click();
    await page.locator('#formation-outfit').selectOption('C01-summer');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(()=>window.__game.getSave())).toEqual(before);
    await expect(page.locator('.formation-footer')).toContainText('有未確認的變更');
    await fitsScreen(page);await reachable(page.locator('[data-action=roster-commit]'));
    await page.locator('[data-action=roster-commit]').click();
    await expect(page.locator('.formation-footer')).toContainText('編隊已儲存');
    await expect(page.locator('#app')).toHaveAttribute('data-page','roster');
    await page.screenshot({path:info.outputPath('formation-saved.png')});
    await page.reload();await page.waitForFunction(()=>!!window.__game);
    const after=await page.evaluate(()=>window.__game.getSave());
    expect(after.preferences.squadIds).toContain('C03');expect(after.preferences.squadIds).not.toContain('C01');
    expect(after.preferences.captainId).toBe('C03');expect(after.collection.equipped.C01).toBe('C01-summer');
    expect(errors).toEqual([]);
  });
});

test('locked members, full teams, reset, empty squads and four-person challenge stay valid',async({page})=>{
  await ready(page);await page.evaluate(()=>window.__game.route('roster'));
  await page.locator('#roster-card-C07').click();await expect(page.locator('[data-action=toggle-character]')).toBeDisabled();
  await page.locator('#roster-card-C03').click();await expect(page.locator('[data-action=toggle-character]')).toBeDisabled();
  await page.locator('#roster-card-C02').click();await page.locator('[data-action=toggle-character]').click();
  await expect(page.locator('.formation-lineup .is-captain')).toHaveCount(1);
  await page.locator('[data-action=roster-reset]').click();
  await expect(page.locator('.formation-count')).toContainText('5 / 5');
  for(const id of ['C01','C02','C04','C05','C06']) {await page.locator(`#roster-card-${id}`).click();await page.locator('[data-action=toggle-character]').click();}
  await expect(page.locator('[data-action=roster-commit]')).toBeDisabled();
  await expect(page.locator('.formation-footer')).toContainText('至少選擇 1 位');
  await page.locator('[data-action=roster-reset]').click();
  await page.evaluate(()=>{const save=window.__game.getSave();save.profile.cleared.push('S01');save.profile.hardCleared=['S01'];window.__game.route('home');});
  await page.locator('[data-action=command-panel][data-id=challenges]').click();
  await page.locator('[data-action=challenge][data-id=four]').click();await page.evaluate(()=>window.__game.route('roster'));
  await expect(page.locator('.formation-count')).toContainText('5 / 4');
  await page.locator('#roster-card-C01').click();await page.locator('[data-action=toggle-character]').click();
  await expect(page.locator('[data-action=roster-commit]')).toBeEnabled();
});
