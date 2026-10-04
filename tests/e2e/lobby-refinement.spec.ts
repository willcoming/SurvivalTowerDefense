import {CHARACTER_MAP} from '../../src/data/content';
import {expect,test} from '@playwright/test';
import {ready,reachable,fitsScreen} from '../helpers/mobile-ui';
for(const viewport of [{width:320,height:500},{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900}])test.describe(`captain ${viewport.width}`,()=>{
 test.use({viewport,isMobile:viewport.width<=800,hasTouch:viewport.width<=800});
 test('captain selection is direct, reflects the bonus, and persists',async({page},info)=>{
  await ready(page);await expect(page.getByText('開發模式',{exact:true})).toHaveCount(0);await expect(page.locator('.offline-summary')).toBeHidden();
  await page.locator('.game-dock [data-action=roster]').click();await fitsScreen(page);
  const status=page.locator('.squad-status');await reachable(status.getByRole('button',{name:'編隊',exact:true}));
  await page.screenshot({path:info.outputPath(`roster-overview-${viewport.width}.png`)});
  await page.locator('.squad-strip[data-id=C01]').click();
  const bonus=await page.evaluate(async()=>{const path='/src/data/reworked-skills.ts';const {CAPTAIN_BONUSES}=await import(path);return CAPTAIN_BONUSES.C01.description;});
  await expect(page.locator('.squad-captain-bonus')).toContainText(bonus);
  const appoint=page.getByRole('button',{name:'設定隊長',exact:true});await reachable(appoint);await appoint.click();
  await expect(page.getByRole('button',{name:'目前隊長',exact:true})).toBeDisabled();await expect(status).toContainText(`隊長 ${CHARACTER_MAP.C01.name}`);
  await page.evaluate(()=>window.__game.save());await page.reload();await page.waitForFunction(()=>!!window.__game);
  expect(await page.evaluate(()=>window.__game.getSave().preferences.captainId)).toBe('C01');
  await page.locator('.game-dock [data-action=roster]').click();await page.locator('.squad-status [data-action=roster-edit]').click();
  await page.getByRole('combobox',{name:'設定編隊隊長',exact:true}).selectOption('C04');
  // Team edits remain a draft until the user confirms the formation.
  expect(await page.evaluate(()=>window.__game.getSave().preferences.captainId)).toBe('C01');
  await fitsScreen(page);await reachable(page.getByRole('combobox',{name:'設定編隊隊長',exact:true}));
  await page.getByRole('button',{name:'確認編隊',exact:true}).click();
  await expect(status).toContainText(`隊長 ${CHARACTER_MAP.C04.name}`);await expect(page.locator('.squad-strip[data-id=C04]')).toHaveClass(/is-captain/);
  await page.locator('.squad-strip[data-id=C04]').click();await expect(page.getByRole('button',{name:'目前隊長',exact:true})).toBeDisabled();
  await page.screenshot({path:info.outputPath(`captain-${viewport.width}.png`)});
  await page.evaluate(()=>window.__game.save());await page.reload();await page.waitForFunction(()=>!!window.__game);
  expect(await page.evaluate(()=>window.__game.getSave().preferences.captainId)).toBe('C04');
 });
});
